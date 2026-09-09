from __future__ import annotations

from collections import defaultdict

from app.core.exceptions import ReconciliationError
from app.ingestion.reconciliation import reconcile_part_sources
from app.models.common import SourceLanguage
from app.models.ingestion import EXPECTED_PART_TOTALS
from app.models.reconciliation import (
    LanguageCompleteness,
    PartQualityReport,
    ReconciliationSource,
    SuspiciousEpic,
)


def analyze_part_quality(
    part_number: int,
    records: list[ReconciliationSource],
) -> PartQualityReport:
    if part_number not in EXPECTED_PART_TOTALS:
        raise ReconciliationError(part_number=part_number)
    expected_total = EXPECTED_PART_TOTALS[part_number]
    expected = set(range(1, expected_total + 1))
    languages: list[LanguageCompleteness] = []

    for language in (SourceLanguage.ENGLISH, SourceLanguage.TELUGU):
        language_records = [
            record
            for record in records
            if record.part_number == part_number and record.source_language == language
        ]
        by_serial: dict[int, list[ReconciliationSource]] = defaultdict(list)
        invalid = []
        for record in language_records:
            if record.serial_number is None or record.serial_number not in expected:
                invalid.append(record.source_record_id)
            else:
                by_serial[record.serial_number].append(record)
        languages.append(
            LanguageCompleteness(
                source_language=language,
                expected_serial_count=expected_total,
                source_record_count=len(language_records),
                valid_record_count=sum(len(group) for group in by_serial.values()),
                distinct_expected_serial_count=len(by_serial),
                missing_serials=sorted(expected - set(by_serial)),
                duplicate_serials={
                    serial: len(group)
                    for serial, group in sorted(by_serial.items())
                    if len(group) > 1
                },
                invalid_or_unexpected_record_ids=sorted(invalid, key=str),
            )
        )

    epic_groups: dict[tuple[SourceLanguage, str], list[ReconciliationSource]] = defaultdict(list)
    for record in records:
        if record.part_number == part_number and record.normalized_epic:
            epic_groups[(record.source_language, record.normalized_epic)].append(record)
    suspicious_epics = []
    for (language, epic), group in sorted(epic_groups.items(), key=lambda item: (item[0][0].value, item[0][1])):
        serials = sorted({record.serial_number for record in group if record.serial_number is not None})
        if len(serials) > 1:
            suspicious_epics.append(
                SuspiciousEpic(
                    source_language=language,
                    normalized_epic=epic,
                    serial_numbers=serials,
                    source_record_ids=sorted(
                        (record.source_record_id for record in group), key=str
                    ),
                )
            )

    return PartQualityReport(
        part_number=part_number,
        expected_serial_count=expected_total,
        languages=languages,
        suspicious_epics=suspicious_epics,
        reconciliation=reconcile_part_sources(part_number, records),
    )

