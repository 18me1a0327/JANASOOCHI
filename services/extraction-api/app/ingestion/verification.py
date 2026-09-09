from __future__ import annotations

from collections import defaultdict

from app.models.ingestion import EXPECTED_PART_TOTALS
from app.models.reconciliation import ReconciliationStatus
from app.models.verification import GoldenRevisionAssessment, LogicalSlotVerification


def _slot_key(part_number: int, serial_number: int) -> str:
    return f"{part_number}:{serial_number}"


def assess_golden_revision(
    slots: list[LogicalSlotVerification],
) -> GoldenRevisionAssessment:
    expected = {
        (part_number, serial_number)
        for part_number, maximum in EXPECTED_PART_TOTALS.items()
        for serial_number in range(1, maximum + 1)
    }
    grouped: dict[tuple[int, int], list[LogicalSlotVerification]] = defaultdict(list)
    for slot in slots:
        grouped[(slot.part_number, slot.serial_number)].append(slot)

    duplicate = sorted(key for key, group in grouped.items() if len(group) > 1)
    unique_slots = {key: group[0] for key, group in grouped.items() if len(group) == 1}
    missing = sorted(expected - set(grouped))

    incomplete_language = []
    unverified = []
    unreconciled = []
    fully_sourced_count = 0
    fully_verified_count = 0
    reconciled_count = 0
    critical_count = 0
    for key in sorted(expected & set(unique_slots)):
        slot = unique_slots[key]
        has_both_sources = (
            slot.english_source_record_id is not None
            and slot.telugu_source_record_id is not None
        )
        if has_both_sources:
            fully_sourced_count += 1
        else:
            incomplete_language.append(key)

        sources_verified = slot.english_source_verified and slot.telugu_source_verified
        if sources_verified:
            fully_verified_count += 1
        else:
            unverified.append(key)

        if slot.reconciliation_status == ReconciliationStatus.RECONCILED:
            reconciled_count += 1
        else:
            unreconciled.append(key)
        critical_count += slot.open_critical_issue_count

    blocker_codes = []
    if missing:
        blocker_codes.append("missing_logical_slots")
    if duplicate:
        blocker_codes.append("duplicate_logical_slots")
    if incomplete_language:
        blocker_codes.append("incomplete_language_sources")
    if unverified:
        blocker_codes.append("unverified_source_evidence")
    if unreconciled:
        blocker_codes.append("unreconciled_slots")
    if critical_count:
        blocker_codes.append("open_critical_review_issues")

    return GoldenRevisionAssessment(
        unique_expected_slot_count=len(expected & set(unique_slots)),
        fully_sourced_slot_count=fully_sourced_count,
        fully_verified_slot_count=fully_verified_count,
        reconciled_slot_count=reconciled_count,
        open_critical_issue_count=critical_count,
        missing_slots=[_slot_key(*key) for key in missing],
        duplicate_slots=[_slot_key(*key) for key in duplicate],
        incomplete_language_slots=[_slot_key(*key) for key in incomplete_language],
        unverified_slots=[_slot_key(*key) for key in unverified],
        unreconciled_slots=[_slot_key(*key) for key in unreconciled],
        blocker_codes=blocker_codes,
        ready_for_golden_revision=not blocker_codes,
    )


