from __future__ import annotations

from collections import defaultdict

from app.core.exceptions import ReconciliationError
from app.models.common import SourceLanguage
from app.models.ingestion import EXPECTED_PART_TOTALS
from app.models.reconciliation import (
    EvidenceState,
    ReconciliationBatch,
    ReconciliationResult,
    ReconciliationSource,
    ReconciliationStatus,
    StructuredEvidence,
)


def _evidence(left: object | None, right: object | None) -> EvidenceState:
    if left is None or right is None:
        return EvidenceState.UNAVAILABLE
    return EvidenceState.AGREE if left == right else EvidenceState.CONFLICT


def reconcile_part_sources(
    part_number: int,
    records: list[ReconciliationSource],
) -> ReconciliationBatch:
    if part_number not in EXPECTED_PART_TOTALS:
        raise ReconciliationError(part_number=part_number)
    observed: dict[tuple[int, SourceLanguage], list[ReconciliationSource]] = defaultdict(list)
    unlinked = []
    for record in records:
        if (
            record.part_number != part_number
            or record.serial_number is None
            or record.serial_number > EXPECTED_PART_TOTALS[part_number]
        ):
            unlinked.append(record.source_record_id)
            continue
        observed[(record.serial_number, record.source_language)].append(record)

    results: list[ReconciliationResult] = []
    for serial_number in sorted({key[0] for key in observed}):
        english = observed.get((serial_number, SourceLanguage.ENGLISH), [])
        telugu = observed.get((serial_number, SourceLanguage.TELUGU), [])
        empty_evidence = StructuredEvidence(
            epic=EvidenceState.UNAVAILABLE,
            house_number=EvidenceState.UNAVAILABLE,
            age=EvidenceState.UNAVAILABLE,
            gender=EvidenceState.UNAVAILABLE,
        )

        if len(english) > 1 or len(telugu) > 1:
            results.append(
                ReconciliationResult(
                    part_number=part_number,
                    serial_number=serial_number,
                    english_record_ids=[record.source_record_id for record in english],
                    telugu_record_ids=[record.source_record_id for record in telugu],
                    status=ReconciliationStatus.DUPLICATE_SOURCE,
                    safe_to_link=False,
                    evidence=empty_evidence,
                    reasons=["duplicate language source for the same Part and serial"],
                )
            )
            continue

        if not english or not telugu:
            results.append(
                ReconciliationResult(
                    part_number=part_number,
                    serial_number=serial_number,
                    english_record_ids=[record.source_record_id for record in english],
                    telugu_record_ids=[record.source_record_id for record in telugu],
                    status=ReconciliationStatus.SOURCE_MISSING,
                    safe_to_link=False,
                    evidence=empty_evidence,
                    reasons=["English or Telugu source representation is missing"],
                )
            )
            continue

        en = english[0]
        te = telugu[0]
        evidence = StructuredEvidence(
            epic=_evidence(en.normalized_epic, te.normalized_epic),
            house_number=_evidence(en.normalized_house_number, te.normalized_house_number),
            age=_evidence(en.age, te.age),
            gender=_evidence(en.normalized_gender, te.normalized_gender),
            names_compared_across_scripts=False,
        )
        conflicts = [
            field
            for field in ("epic", "house_number", "age", "gender")
            if getattr(evidence, field) == EvidenceState.CONFLICT
        ]
        results.append(
            ReconciliationResult(
                part_number=part_number,
                serial_number=serial_number,
                english_record_ids=[en.source_record_id],
                telugu_record_ids=[te.source_record_id],
                status=(
                    ReconciliationStatus.NEEDS_REVIEW
                    if conflicts
                    else ReconciliationStatus.RECONCILED
                ),
                safe_to_link=not conflicts,
                evidence=evidence,
                conflict_fields=conflicts,
                reasons=(
                    ["structured EN/TE fields require review"]
                    if conflicts
                    else ["Part and serial agree; available structured fields do not conflict"]
                ),
            )
        )

    counts = {status: 0 for status in ReconciliationStatus}
    for result in results:
        counts[result.status] += 1
    return ReconciliationBatch(
        part_number=part_number,
        evaluated_identity_count=len(results),
        reconciled_count=counts[ReconciliationStatus.RECONCILED],
        needs_review_count=counts[ReconciliationStatus.NEEDS_REVIEW],
        source_missing_count=counts[ReconciliationStatus.SOURCE_MISSING],
        duplicate_source_count=counts[ReconciliationStatus.DUPLICATE_SOURCE],
        unlinked_record_ids=sorted(unlinked, key=str),
        results=results,
    )

