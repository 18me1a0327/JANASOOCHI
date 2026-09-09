from __future__ import annotations

from uuid import UUID, uuid5

from app.ingestion.quality import analyze_part_quality
from app.ingestion.reconciliation import reconcile_part_sources
from app.models.common import SourceLanguage
from app.models.ingestion import EXPECTED_PART_TOTALS
from app.models.reconciliation import (
    EvidenceState,
    ReconciliationSource,
    ReconciliationStatus,
)


NAMESPACE = UUID("00000000-0000-0000-0000-000000000123")


def _record(
    label: str,
    language: SourceLanguage,
    serial: int | None,
    *,
    part: int = 230,
    epic: str | None = "ABC1234567",
    house: str | None = "1-25",
    age: int | None = 48,
    gender: str | None = "male",
) -> ReconciliationSource:
    return ReconciliationSource(
        source_record_id=uuid5(NAMESPACE, label),
        part_number=part,
        serial_number=serial,
        source_language=language,
        normalized_epic=epic,
        normalized_house_number=house,
        age=age,
        normalized_gender=gender,
    )


def test_part_and_serial_match_with_structured_agreement_reconciles() -> None:
    batch = reconcile_part_sources(
        230,
        [
            _record("en-1", SourceLanguage.ENGLISH, 1),
            _record("te-1", SourceLanguage.TELUGU, 1),
        ],
    )

    result = batch.results[0]
    assert result.status == ReconciliationStatus.RECONCILED
    assert result.safe_to_link
    assert result.evidence.epic == EvidenceState.AGREE
    assert result.evidence.names_compared_across_scripts is False
    assert batch.reconciled_count == 1


def test_structured_conflict_requires_review_and_is_not_auto_linked() -> None:
    batch = reconcile_part_sources(
        230,
        [
            _record("en-2", SourceLanguage.ENGLISH, 2),
            _record("te-2", SourceLanguage.TELUGU, 2, epic="XYZ7654321", age=49),
        ],
    )

    result = batch.results[0]
    assert result.status == ReconciliationStatus.NEEDS_REVIEW
    assert not result.safe_to_link
    assert result.conflict_fields == ["epic", "age"]


def test_missing_language_source_is_explicit() -> None:
    batch = reconcile_part_sources(
        230,
        [_record("en-3", SourceLanguage.ENGLISH, 3)],
    )

    assert batch.source_missing_count == 1
    assert batch.results[0].status == ReconciliationStatus.SOURCE_MISSING


def test_duplicate_language_source_blocks_reconciliation() -> None:
    batch = reconcile_part_sources(
        230,
        [
            _record("en-4a", SourceLanguage.ENGLISH, 4),
            _record("en-4b", SourceLanguage.ENGLISH, 4),
            _record("te-4", SourceLanguage.TELUGU, 4),
        ],
    )

    assert batch.duplicate_source_count == 1
    assert not batch.results[0].safe_to_link


def test_invalid_or_wrong_part_records_remain_unlinked() -> None:
    invalid = _record("invalid", SourceLanguage.ENGLISH, None)
    other_part = _record("other", SourceLanguage.ENGLISH, 1, part=229)
    batch = reconcile_part_sources(230, [invalid, other_part])

    assert batch.evaluated_identity_count == 0
    assert batch.unlinked_record_ids == sorted(
        [invalid.source_record_id, other_part.source_record_id], key=str
    )


def test_completeness_reports_missing_duplicates_and_invalid_records() -> None:
    invalid = _record("invalid-quality", SourceLanguage.ENGLISH, None)
    records = [
        _record("en-1", SourceLanguage.ENGLISH, 1),
        _record("en-1-duplicate", SourceLanguage.ENGLISH, 1),
        _record("te-1", SourceLanguage.TELUGU, 1),
        invalid,
    ]
    report = analyze_part_quality(230, records)
    english = report.languages[0]
    telugu = report.languages[1]

    assert english.source_record_count == 3
    assert english.valid_record_count == 2
    assert english.distinct_expected_serial_count == 1
    assert english.duplicate_serials == {1: 2}
    assert english.invalid_or_unexpected_record_ids == [invalid.source_record_id]
    assert english.missing_serials[0] == 2
    assert english.missing_serials[-1] == 579
    assert len(english.missing_serials) == 578
    assert len(telugu.missing_serials) == 578


def test_duplicate_epic_is_suspicious_only_across_different_serials() -> None:
    report = analyze_part_quality(
        230,
        [
            _record("en-10", SourceLanguage.ENGLISH, 10),
            _record("en-11", SourceLanguage.ENGLISH, 11),
            _record("te-10", SourceLanguage.TELUGU, 10),
        ],
    )

    assert len(report.suspicious_epics) == 1
    assert report.suspicious_epics[0].source_language == SourceLanguage.ENGLISH
    assert report.suspicious_epics[0].serial_numbers == [10, 11]


def test_quality_and_reconciliation_are_deterministic() -> None:
    records = [
        _record("en-20", SourceLanguage.ENGLISH, 20),
        _record("te-20", SourceLanguage.TELUGU, 20),
        _record("en-5", SourceLanguage.ENGLISH, 5),
    ]

    first = analyze_part_quality(230, records).model_dump(mode="json")
    second = analyze_part_quality(230, list(reversed(records))).model_dump(mode="json")

    assert first == second


def test_expected_part_totals_remain_the_current_revision_contract() -> None:
    assert EXPECTED_PART_TOTALS == {227: 1014, 228: 973, 229: 888, 230: 579}
    assert sum(EXPECTED_PART_TOTALS.values()) == 3454


