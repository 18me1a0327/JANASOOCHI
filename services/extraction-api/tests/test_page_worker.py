from __future__ import annotations

from uuid import uuid4

import pytest

from app.core.exceptions import (
    DatabasePersistenceError,
    EmptyOcrResultError,
    PageRenderError,
    PipelineSelectionBlockedError,
    UnsupportedPageLayoutError,
)
from app.db.supabase_contracts import (
    AtomicPagePersistenceRequest,
    AtomicPagePersistenceResult,
)
from app.models.common import PipelineVersions, SourceLanguage
from app.models.field_regions import FieldRegion, FieldType
from app.models.ingestion import PagePersistenceStatus
from app.models.ocr import OcrEngine, OcrFieldResult
from app.models.worker import PageWorkRequest
from app.ocr.normalization import normalize_ocr_value
from app.vision.segmentation import segment_page
from app.worker.page_processor import PageIngestionWorker
from segmentation_fixtures import synthetic_non_voter_page, synthetic_voter_page


VERSIONS = PipelineVersions(
    pipeline_version="3.1.0",
    preprocessing_version="1.3.0",
    parser_version="2.0.0",
    ocr_engine="tesseract",
    ocr_engine_version="5.3.0",
)
VALUES = {
    FieldType.SERIAL_NUMBER: "145",
    FieldType.EPIC: "ABC1234567",
    FieldType.VOTER_NAME: "Ananda Rao",
    FieldType.RELATION_NAME: "Krishna Rao",
    FieldType.RELATION_TYPE: "Father",
    FieldType.HOUSE_NUMBER: "1-25",
    FieldType.AGE: "48",
    FieldType.GENDER: "Male",
}


class _Renderer:
    def __init__(self, *, failures: int = 0, non_voter: bool = False) -> None:
        self.failures = failures
        self.non_voter = non_voter
        self.calls = 0

    def render_page(self, _: bytes, physical_page: int, dpi: int):
        self.calls += 1
        if self.calls <= self.failures:
            raise PageRenderError(physical_page=physical_page)
        page = (
            synthetic_non_voter_page(physical_page=physical_page)
            if self.non_voter
            else synthetic_voter_page(
                physical_page=physical_page,
                populated_cards=1,
            )
        )
        return page.model_copy(update={"dpi": dpi})


class _Adapter:
    engine = OcrEngine.TESSERACT
    engine_version = "5.3.0"

    def __init__(
        self,
        *,
        fail_field: FieldType | None = None,
        unexpected_field: FieldType | None = None,
    ) -> None:
        self.fail_field = fail_field
        self.unexpected_field = unexpected_field
        self.calls = 0

    def recognize(
        self,
        field: FieldRegion,
        source_language: SourceLanguage,
        processing_version: str,
    ) -> OcrFieldResult:
        self.calls += 1
        if field.field_type == self.unexpected_field:
            raise RuntimeError("private engine failure")
        if field.field_type == self.fail_field:
            raise EmptyOcrResultError()
        raw = VALUES[field.field_type]
        return OcrFieldResult(
            field_type=field.field_type,
            source_language=source_language,
            page_bbox=field.page_bbox,
            raw_value=raw,
            normalized_value=normalize_ocr_value(raw, field.field_type),
            ocr_engine=self.engine,
            ocr_engine_version=self.engine_version,
            field_confidence=0.95,
            processing_version=processing_version,
        )


class _Repository:
    def __init__(self, *, failures: int = 0) -> None:
        self.failures = failures
        self.calls = 0
        self.requests: list[AtomicPagePersistenceRequest] = []

    async def persist_page(
        self,
        request: AtomicPagePersistenceRequest,
    ) -> AtomicPagePersistenceResult:
        self.calls += 1
        self.requests.append(request)
        if self.calls <= self.failures:
            raise DatabasePersistenceError()
        return AtomicPagePersistenceResult(
            page_id=7,
            inserted_records=len(request.records),
            idempotent_records=0,
            inserted_review_issues=len(request.review_issues),
        )


def _request(*, physical_page: int = 4) -> PageWorkRequest:
    return PageWorkRequest(
        document_id=uuid4(),
        processing_run_id=uuid4(),
        revision_identifier="pallerlamudi-2026-draft-r1",
        part_number=227,
        source_language=SourceLanguage.ENGLISH,
        physical_page_number=physical_page,
        total_pdf_pages=40,
        printed_page_number=2,
        pdf_bytes=b"%PDF-synthetic-worker-fixture",
        render_dpi=300,
    )


def _worker(
    *,
    renderer: _Renderer | None = None,
    adapter: _Adapter | None = None,
    repository: _Repository | None = None,
    segmenter=segment_page,
) -> tuple[PageIngestionWorker, _Renderer, _Adapter, _Repository]:
    selected_renderer = renderer or _Renderer()
    selected_adapter = adapter or _Adapter()
    selected_repository = repository or _Repository()
    return (
        PageIngestionWorker(
            repository=selected_repository,
            ocr_adapter=selected_adapter,
            versions=VERSIONS,
            renderer=selected_renderer,
            segmenter=segmenter,
        ),
        selected_renderer,
        selected_adapter,
        selected_repository,
    )


@pytest.mark.anyio
async def test_worker_runs_source_raw_normalized_and_atomic_persistence() -> None:
    worker, _, adapter, repository = _worker()

    outcome = await worker.process_page(_request())

    assert outcome.persisted
    assert outcome.records_detected == 1
    assert outcome.records_extracted == 1
    assert outcome.status == PagePersistenceStatus.COMPLETED_WITH_WARNINGS
    assert adapter.calls == 8
    record = repository.requests[0].records[0]
    assert record.raw.voter_name == "Ananda Rao"
    assert record.normalized.voter_name == "ananda rao"
    assert record.serial_number == 145
    assert record.card_bbox == repository.requests[0].records[0].card_bbox


@pytest.mark.anyio
async def test_targeted_ocr_failure_is_persisted_for_review() -> None:
    worker, _, adapter, repository = _worker(
        adapter=_Adapter(fail_field=FieldType.EPIC)
    )

    outcome = await worker.process_page(_request())

    assert outcome.status == PagePersistenceStatus.REQUIRES_REVIEW
    assert outcome.review_records == 1
    assert adapter.calls == 10  # seven fields once plus three EPIC attempts
    assert repository.requests[0].records[0].raw.epic is None
    assert repository.requests[0].review_issues[0].resolution_metadata[
        "ingestion_issue_code"
    ] == "ocr_failure_epic"


@pytest.mark.anyio
async def test_unexpected_card_failure_is_isolated_and_sanitized() -> None:
    worker, _, _, repository = _worker(
        adapter=_Adapter(unexpected_field=FieldType.VOTER_NAME)
    )

    outcome = await worker.process_page(_request())

    assert outcome.persisted
    assert outcome.status == PagePersistenceStatus.REQUIRES_REVIEW
    assert outcome.records_detected == 1
    assert outcome.records_extracted == 0
    assert repository.requests[0].page.cards[0]["error_code"] == "unexpected_card_error"
    assert "private engine failure" not in str(repository.requests[0].page.cards)


@pytest.mark.anyio
async def test_database_retry_reuses_prepared_page_without_rerunning_ocr() -> None:
    worker, renderer, adapter, repository = _worker(
        repository=_Repository(failures=1)
    )

    outcome = await worker.process_page(_request())

    assert outcome.persisted
    assert outcome.persistence_attempts == 2
    assert repository.calls == 2
    assert renderer.calls == 1
    assert adapter.calls == 8
    assert repository.requests[0].model_dump() == repository.requests[1].model_dump()


@pytest.mark.anyio
async def test_retryable_page_failure_is_retried_twice_then_continues() -> None:
    worker, renderer, _, _ = _worker(renderer=_Renderer(failures=2))

    outcome = await worker.process_page(_request())

    assert outcome.persisted
    assert outcome.processing_attempts == 3
    assert renderer.calls == 3


@pytest.mark.anyio
async def test_non_voter_page_checkpoints_zero_records() -> None:
    worker, _, adapter, repository = _worker(renderer=_Renderer(non_voter=True))

    outcome = await worker.process_page(_request())

    assert outcome.status == PagePersistenceStatus.COMPLETED
    assert outcome.records_detected == 0
    assert outcome.records_extracted == 0
    assert adapter.calls == 0
    assert repository.requests[0].records == []


@pytest.mark.anyio
async def test_nonretryable_page_failure_is_checkpointed_and_batch_continues() -> None:
    def reject_first(page):
        if page.physical_page == 1:
            raise UnsupportedPageLayoutError()
        return segment_page(page)

    worker, _, _, repository = _worker(segmenter=reject_first)
    first = _request(physical_page=1)
    second = _request(physical_page=2).model_copy(
        update={
            "document_id": first.document_id,
            "processing_run_id": first.processing_run_id,
        }
    )

    outcomes = await worker.process_pages([first, second])

    assert len(outcomes) == 2
    assert outcomes[0].status == PagePersistenceStatus.REQUIRES_REVIEW
    assert outcomes[0].error_code == "unsupported_page_layout"
    assert outcomes[1].persisted
    assert repository.calls == 2


def test_worker_rejects_an_unselected_or_mismatched_ocr_pipeline() -> None:
    with pytest.raises(PipelineSelectionBlockedError):
        PageIngestionWorker(
            repository=_Repository(),
            ocr_adapter=_Adapter(),
            versions=VERSIONS.model_copy(update={"ocr_engine": None}),
            renderer=_Renderer(),
        )


def test_page_request_rejects_out_of_range_and_urdu_processing() -> None:
    with pytest.raises(ValueError):
        _request(physical_page=41)
    values = _request().model_dump()
    values["source_language"] = SourceLanguage.URDU
    with pytest.raises(ValueError):
        PageWorkRequest(**values)

