from __future__ import annotations

from uuid import UUID, uuid5

from app.ingestion.verification import assess_golden_revision
from app.models.ingestion import EXPECTED_PART_TOTALS
from app.models.reconciliation import ReconciliationStatus
from app.models.verification import LogicalSlotVerification


NAMESPACE = UUID("00000000-0000-0000-0000-000000000456")


def _slot(part_number: int, serial_number: int) -> LogicalSlotVerification:
    key = f"{part_number}:{serial_number}"
    return LogicalSlotVerification(
        part_number=part_number,
        serial_number=serial_number,
        english_source_record_id=uuid5(NAMESPACE, f"en:{key}"),
        telugu_source_record_id=uuid5(NAMESPACE, f"te:{key}"),
        english_source_verified=True,
        telugu_source_verified=True,
        reconciliation_status=ReconciliationStatus.RECONCILED,
        open_critical_issue_count=0,
    )


def _complete_revision() -> list[LogicalSlotVerification]:
    return [
        _slot(part_number, serial_number)
        for part_number, maximum in EXPECTED_PART_TOTALS.items()
        for serial_number in range(1, maximum + 1)
    ]


def test_exact_complete_verified_revision_passes_golden_gate() -> None:
    assessment = assess_golden_revision(_complete_revision())

    assert assessment.expected_logical_voter_count == 3454
    assert assessment.unique_expected_slot_count == 3454
    assert assessment.fully_sourced_slot_count == 3454
    assert assessment.fully_verified_slot_count == 3454
    assert assessment.reconciled_slot_count == 3454
    assert assessment.ready_for_golden_revision
    assert assessment.blocker_codes == []


def test_missing_slot_blocks_golden_revision_without_creating_a_record() -> None:
    slots = _complete_revision()
    removed = slots.pop()
    assessment = assess_golden_revision(slots)

    assert not assessment.ready_for_golden_revision
    assert "missing_logical_slots" in assessment.blocker_codes
    assert assessment.missing_slots == [f"{removed.part_number}:{removed.serial_number}"]


def test_duplicate_slot_blocks_golden_revision() -> None:
    slots = _complete_revision()
    slots.append(slots[0].model_copy())
    assessment = assess_golden_revision(slots)

    assert not assessment.ready_for_golden_revision
    assert assessment.duplicate_slots == ["227:1"]
    assert "duplicate_logical_slots" in assessment.blocker_codes


def test_missing_language_unverified_conflict_and_critical_issue_all_block() -> None:
    slots = _complete_revision()
    slots[0] = slots[0].model_copy(
        update={
            "telugu_source_record_id": None,
            "telugu_source_verified": False,
            "reconciliation_status": ReconciliationStatus.NEEDS_REVIEW,
            "open_critical_issue_count": 2,
        }
    )
    assessment = assess_golden_revision(slots)

    assert not assessment.ready_for_golden_revision
    assert assessment.incomplete_language_slots == ["227:1"]
    assert assessment.unverified_slots == ["227:1"]
    assert assessment.unreconciled_slots == ["227:1"]
    assert assessment.open_critical_issue_count == 2
    assert assessment.blocker_codes == [
        "incomplete_language_sources",
        "unverified_source_evidence",
        "unreconciled_slots",
        "open_critical_review_issues",
    ]


def test_golden_assessment_is_deterministic() -> None:
    slots = _complete_revision()
    first = assess_golden_revision(slots).model_dump(mode="json")
    second = assess_golden_revision(list(reversed(slots))).model_dump(mode="json")

    assert first == second

