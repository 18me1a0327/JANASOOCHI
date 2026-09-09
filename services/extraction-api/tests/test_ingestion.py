from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest
import httpx

from app.core.config import Settings
from app.core.exceptions import (
    DatabasePersistenceError,
    PersistenceConfigurationError,
    SourceRecordValidationError,
)
from app.db.ingestion import SupabasePageIngestionRepository
from app.db.supabase_contracts import (
    AtomicPagePersistenceRequest,
    PageProcessingUpsert,
    SourceRecordInsert,
    build_review_issue_rows,
)
from app.ingestion.source_records import build_page_source_records, build_source_record
from app.models.common import PipelineVersions, SourceLanguage
from app.models.field_regions import FieldType
from app.models.ingestion import PageProcessingState, SourceCardInput
from app.models.ocr import CardOcrResult, OcrEngine, OcrFieldFailure, OcrFieldResult
from app.models.segmentation import BoundingBox
from app.ocr.normalization import normalize_ocr_value


VERSIONS = PipelineVersions(
    pipeline_version="3.0.0",
    preprocessing_version="1.3.0",
    parser_version="2.0.0",
    ocr_engine="tesseract",
    ocr_engine_version="5.3.0",
)
BBOX = BoundingBox(x1=10, y1=20, x2=310, y2=180)
DEFAULT_VALUES = {
    FieldType.SERIAL_NUMBER: "145",
    FieldType.EPIC: "ABC1234567",
    FieldType.VOTER_NAME: "  Ananda Rao  ",
    FieldType.RELATION_NAME: "Krishna Rao",
    FieldType.RELATION_TYPE: "Father",
    FieldType.HOUSE_NUMBER: "1-25",
    FieldType.AGE: "48",
    FieldType.GENDER: "Male",
}


def _ocr_result(
    *,
    language: SourceLanguage = SourceLanguage.ENGLISH,
    physical_page: int = 4,
    card_index: int = 1,
    overrides: dict[FieldType, str] | None = None,
    failed: set[FieldType] | None = None,
) -> CardOcrResult:
    values = {**DEFAULT_VALUES, **(overrides or {})}
    failures = failed or set()
    fields = [
        OcrFieldResult(
            field_type=field_type,
            source_language=language,
            page_bbox=BBOX,
            raw_value=value,
            normalized_value=normalize_ocr_value(value, field_type),
            ocr_engine=OcrEngine.TESSERACT,
            ocr_engine_version="5.3.0",
            field_confidence=0.9,
            processing_version="3.0.0",
        )
        for field_type, value in values.items()
        if field_type not in failures
    ]
    field_failures = [
        OcrFieldFailure(
            field_type=field_type,
            error_code="empty_ocr_result",
            message="OCR did not return readable text.",
            retryable=True,
            attempt_count=3,
            retry_exhausted=True,
        )
        for field_type in sorted(failures, key=lambda item: item.value)
    ]
    return CardOcrResult(
        physical_page_number=physical_page,
        card_index=card_index,
        source_language=language,
        fields=fields,
        failures=field_failures,
    )


def _build(**overrides: object):
    values = {
        "document_id": uuid4(),
        "revision_identifier": "pallerlamudi-2026-draft-r1",
        "part_number": 227,
        "source_language": SourceLanguage.ENGLISH,
        "card_bbox": BBOX,
        "original_card_text": "ORIGINAL BLOCK TEXT",
        "ocr_result": _ocr_result(),
        "versions": VERSIONS,
        "printed_page_number": 2,
    }
    values.update(overrides)
    return build_source_record(**values)


def test_source_record_preserves_raw_and_derives_normalized_values() -> None:
    record = _build()

    assert record.raw.voter_name == "  Ananda Rao  "
    assert record.normalized.voter_name == "ananda rao"
    assert record.serial_number == 145
    assert record.age == 48
    assert record.original_card_text == "ORIGINAL BLOCK TEXT"
    assert not record.requires_review


def test_source_record_id_is_stable_for_an_idempotent_page_card_retry() -> None:
    document_id = uuid4()
    first = _build(document_id=document_id)
    second = _build(document_id=document_id)

    assert first.source_record_id == second.source_record_id


def test_invalid_identity_and_fields_remain_unlinked_and_reviewable() -> None:
    result = _ocr_result(
        overrides={
            FieldType.SERIAL_NUMBER: "9999",
            FieldType.EPIC: "BAD-EPIC",
            FieldType.AGE: "9",
        }
    )
    record = _build(ocr_result=result)

    assert record.serial_number is None
    assert record.age is None
    assert record.requires_review
    assert {issue.code for issue in record.issues} == {
        "unexpected_serial_number",
        "invalid_epic_format",
        "implausible_age",
    }


def test_field_failure_is_preserved_as_review_issue_without_guessing() -> None:
    record = _build(ocr_result=_ocr_result(failed={FieldType.EPIC}))

    assert record.raw.epic is None
    assert record.normalized.epic is None
    assert record.requires_review
    assert "ocr_failure_epic" in {issue.code for issue in record.issues}


def test_urdu_ingestion_remains_blocked() -> None:
    with pytest.raises(SourceRecordValidationError):
        _build(
            source_language=SourceLanguage.URDU,
            ocr_result=_ocr_result(language=SourceLanguage.URDU),
        )


def test_one_bad_card_is_isolated_from_other_page_cards() -> None:
    page = build_page_source_records(
        document_id=uuid4(),
        revision_identifier="pallerlamudi-2026-draft-r1",
        part_number=227,
        source_language=SourceLanguage.ENGLISH,
        physical_page_number=4,
        cards=[
            SourceCardInput(
                ocr_result=_ocr_result(physical_page=4, card_index=1),
                card_bbox=BBOX,
                original_card_text="CARD ONE",
            ),
            SourceCardInput(
                ocr_result=_ocr_result(physical_page=5, card_index=2),
                card_bbox=BBOX,
                original_card_text="CARD TWO",
            ),
        ],
        versions=VERSIONS,
    )

    assert page.source_card_count == 2
    assert page.persisted_candidate_count == 1
    assert page.records[0].card_index == 1
    assert page.failures[0].card_index == 2
    assert page.failures[0].error_code == "source_record_validation_error"


def test_inconsistent_raw_and_normalized_layers_are_isolated() -> None:
    valid = _ocr_result(card_index=1)
    corrupt_serial = valid.fields[0].model_copy(update={"normalized_value": "999"})
    corrupt = valid.model_copy(update={"fields": [corrupt_serial, *valid.fields[1:]]})
    page = build_page_source_records(
        document_id=uuid4(),
        revision_identifier="pallerlamudi-2026-draft-r1",
        part_number=227,
        source_language=SourceLanguage.ENGLISH,
        physical_page_number=4,
        cards=[
            SourceCardInput(
                ocr_result=corrupt,
                card_bbox=BBOX,
                original_card_text="CARD WITH INCONSISTENT LAYERS",
            )
        ],
        versions=VERSIONS,
    )

    assert page.persisted_candidate_count == 0
    assert page.failures[0].error_code == "source_record_validation_error"


def test_supabase_mapper_never_promotes_candidate_to_verified() -> None:
    candidate = _build()
    row = SourceRecordInsert(**candidate.model_dump()).to_row()

    assert row["verification_status"] == "unverified"
    assert "logical_voter_id" not in row
    assert row["serial_number"] == "145"
    assert row["original_name"] == "  Ananda Rao  "
    assert row["normalized_name"] == "ananda rao"
    assert row["ocr_confidence"] == pytest.approx(90)
    assert row["name_confidence"] == pytest.approx(90)
    assert row["bounding_box"] == BBOX.model_dump()
    assert row["verification_evidence"]["revision_identifier"] == "pallerlamudi-2026-draft-r1"


def test_review_candidate_maps_to_requires_review() -> None:
    candidate = _build(ocr_result=_ocr_result(failed={FieldType.SERIAL_NUMBER}))
    row = SourceRecordInsert(**candidate.model_dump()).to_row()

    assert row["serial_number"] is None
    assert row["verification_status"] == "requires_review"
    assert "missing_serial_number" in row["verification_evidence"]["issue_codes"]


def test_page_checkpoint_maps_to_resumable_page_processing_shape() -> None:
    state = PageProcessingUpsert(
        **PageProcessingState(
            document_id=uuid4(),
            processing_run_id=uuid4(),
            physical_page_number=8,
            printed_page_number=6,
            status="completed_with_warnings",
            attempts=2,
            records_detected=30,
            records_extracted=29,
            review_records=1,
            error_message=None,
            cards=[{"card_index": 7, "status": "requires_review"}],
            updated_at=datetime.now(UTC),
        ).model_dump()
    )

    row = state.to_row()
    assert row["pdf_page_number"] == 8
    assert row["printed_page_number"] == 6
    assert row["card_states"] == [{"card_index": 7, "status": "requires_review"}]
    assert row["retry_count"] == 1
    assert row["extraction_attempts"] == 2


def _persistence_request(candidate=None) -> AtomicPagePersistenceRequest:
    candidate = candidate or _build()
    record = SourceRecordInsert(**candidate.model_dump())
    page = PageProcessingUpsert(
        document_id=candidate.document_id,
        processing_run_id=uuid4(),
        physical_page_number=candidate.physical_page_number,
        printed_page_number=candidate.printed_page_number,
        status="completed_with_warnings" if candidate.requires_review else "completed",
        attempts=1,
        records_detected=1,
        records_extracted=1,
        review_records=1 if candidate.requires_review else 0,
        error_message=None,
        cards=[{"card_index": candidate.card_index, "status": "extracted"}],
        updated_at=datetime.now(UTC),
    )
    return AtomicPagePersistenceRequest(
        page=page,
        records=[record],
        review_issues=build_review_issue_rows(candidate),
    )


def test_atomic_rpc_contract_contains_only_unverified_source_rows() -> None:
    candidate = _build(ocr_result=_ocr_result(failed={FieldType.SERIAL_NUMBER}))
    request = _persistence_request(candidate)
    params = request.to_rpc_params()
    row = params["p_records"][0]

    assert row["verification_status"] == "requires_review"
    assert "logical_voter_id" not in row
    assert "verified_by" not in row
    assert params["p_review_issues"][0]["status"] == "open"
    assert all(issue["voter_id"] == row["id"] for issue in params["p_review_issues"])


@pytest.mark.anyio
async def test_supabase_repository_calls_atomic_rpc_with_backend_secret() -> None:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["apikey"] = request.headers["apikey"]
        captured["authorization"] = request.headers.get("authorization")
        return httpx.Response(
            200,
            json={
                "page_id": 7,
                "inserted_records": 1,
                "idempotent_records": 0,
                "inserted_review_issues": 0,
            },
        )

    settings = Settings(
        supabase_url="https://example.supabase.co",
        supabase_secret_key="sb_secret_server_test",
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        repository = SupabasePageIngestionRepository(settings, client)
        result = await repository.persist_page(_persistence_request())

    assert captured["url"].endswith("/rest/v1/rpc/persist_extracted_page_v1")
    assert captured["apikey"] == "sb_secret_server_test"
    assert captured["authorization"] is None
    assert result.inserted_records == 1


def test_unconfigured_supabase_repository_fails_safely() -> None:
    with pytest.raises(PersistenceConfigurationError):
        SupabasePageIngestionRepository(Settings())


@pytest.mark.anyio
async def test_supabase_error_does_not_expose_database_response() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="internal database detail")

    settings = Settings(
        supabase_url="https://example.supabase.co",
        supabase_secret_key="sb_secret_server_test",
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        repository = SupabasePageIngestionRepository(settings, client)
        with pytest.raises(DatabasePersistenceError) as caught:
            await repository.persist_page(_persistence_request())

    assert caught.value.message == "Database temporarily unavailable."
    assert "internal database detail" not in caught.value.message

