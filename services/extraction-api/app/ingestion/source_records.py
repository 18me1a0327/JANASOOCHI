from __future__ import annotations

import re
from uuid import UUID, uuid5

from pydantic import ValidationError

from app.core.exceptions import ExtractionError, SourceRecordValidationError
from app.models.common import PipelineVersions, SUPPORTED_PARTS, SourceLanguage
from app.models.field_regions import FieldType
from app.models.ingestion import (
    EXPECTED_PART_TOTALS,
    FIELD_ATTRIBUTE_MAP,
    IngestionIssue,
    IssueSeverity,
    PageIngestionResult,
    SourceCardInput,
    SourceFieldValues,
    SourceRecordCandidate,
    SourceRecordFailure,
)
from app.models.ocr import CardOcrResult
from app.models.segmentation import BoundingBox


_EPIC_PATTERN = re.compile(r"^[A-Z]{3}[0-9]{7}$")


def _issue(
    code: str,
    severity: IssueSeverity,
    message: str,
    field_type: FieldType | None = None,
    **details: object,
) -> IngestionIssue:
    return IngestionIssue(
        code=code,
        severity=severity,
        field_type=field_type,
        message=message,
        details=details,
    )


def build_source_record(
    *,
    document_id: UUID,
    revision_identifier: str,
    part_number: int,
    source_language: SourceLanguage,
    card_bbox: BoundingBox,
    original_card_text: str,
    ocr_result: CardOcrResult,
    versions: PipelineVersions,
    printed_page_number: int | None = None,
    source_record_id: UUID | None = None,
) -> SourceRecordCandidate:
    if part_number not in SUPPORTED_PARTS:
        raise SourceRecordValidationError(
            "Source ingestion supports only Parts 227–230.",
            part_number=part_number,
        )
    if source_language not in {SourceLanguage.ENGLISH, SourceLanguage.TELUGU}:
        raise SourceRecordValidationError(
            "Phase 3 source ingestion is enabled only for English and Telugu.",
            source_language=source_language.value,
        )
    if ocr_result.source_language != source_language:
        raise SourceRecordValidationError(
            "OCR and source-record languages do not match.",
            physical_page_number=ocr_result.physical_page_number,
            card_index=ocr_result.card_index,
        )

    raw_values: dict[str, str | None] = {attribute: None for attribute in FIELD_ATTRIBUTE_MAP.values()}
    normalized_values = raw_values.copy()
    confidence: dict[FieldType, float | None] = {}
    for field in ocr_result.fields:
        attribute = FIELD_ATTRIBUTE_MAP[field.field_type]
        raw_values[attribute] = field.raw_value
        normalized_values[attribute] = field.normalized_value
        confidence[field.field_type] = field.field_confidence

    issues: list[IngestionIssue] = []
    for failure in ocr_result.failures:
        issues.append(
            _issue(
                f"ocr_failure_{failure.field_type.value}",
                IssueSeverity.NEEDS_REVIEW,
                "The field could not be extracted after its permitted attempts.",
                failure.field_type,
                error_code=failure.error_code,
                attempt_count=failure.attempt_count,
            )
        )

    normalized = SourceFieldValues(**normalized_values)
    normalized_serial = normalized.serial_number
    serial_number: int | None = None
    if normalized_serial is None:
        issues.append(
            _issue(
                "missing_serial_number",
                IssueSeverity.CRITICAL,
                "The source card has no usable electoral-roll serial number.",
                FieldType.SERIAL_NUMBER,
            )
        )
    else:
        parsed_serial = int(normalized_serial)
        if 1 <= parsed_serial <= EXPECTED_PART_TOTALS[part_number]:
            serial_number = parsed_serial
        else:
            issues.append(
                _issue(
                    "unexpected_serial_number",
                    IssueSeverity.CRITICAL,
                    "The extracted serial is outside the expected Part range.",
                    FieldType.SERIAL_NUMBER,
                    maximum=EXPECTED_PART_TOTALS[part_number],
                )
            )

    if normalized.epic is not None and not _EPIC_PATTERN.fullmatch(normalized.epic):
        issues.append(
            _issue(
                "invalid_epic_format",
                IssueSeverity.NEEDS_REVIEW,
                "The extracted EPIC does not match the supported format.",
                FieldType.EPIC,
            )
        )

    age: int | None = None
    if normalized.age is not None:
        parsed_age = int(normalized.age)
        if 18 <= parsed_age <= 125:
            age = parsed_age
        else:
            issues.append(
                _issue(
                    "implausible_age",
                    IssueSeverity.NEEDS_REVIEW,
                    "The extracted age is outside the accepted validation range.",
                    FieldType.AGE,
                )
            )

    if not original_card_text.strip():
        issues.append(
            _issue(
                "missing_original_card_text",
                IssueSeverity.NEEDS_REVIEW,
                "The source card has no preserved block-level OCR text.",
            )
        )

    engines = {(field.ocr_engine.value, field.ocr_engine_version) for field in ocr_result.fields}
    ocr_engine = next(iter(engines))[0] if len(engines) == 1 else None
    ocr_engine_version = next(iter(engines))[1] if len(engines) == 1 else None

    try:
        return SourceRecordCandidate(
            source_record_id=source_record_id
            or uuid5(
                document_id,
                (
                    f"{part_number}:{source_language.value}:"
                    f"{ocr_result.physical_page_number}:{ocr_result.card_index}"
                ),
            ),
            document_id=document_id,
            revision_identifier=revision_identifier,
            part_number=part_number,
            source_language=source_language,
            physical_page_number=ocr_result.physical_page_number,
            printed_page_number=printed_page_number,
            card_index=ocr_result.card_index,
            card_bbox=card_bbox,
            original_card_text=original_card_text,
            raw=SourceFieldValues(**raw_values),
            normalized=normalized,
            serial_number=serial_number,
            age=age,
            field_confidence=confidence,
            ocr_engine=ocr_engine,
            ocr_engine_version=ocr_engine_version,
            versions=versions,
            issues=issues,
            requires_review=any(
                issue.severity in {IssueSeverity.CRITICAL, IssueSeverity.NEEDS_REVIEW}
                for issue in issues
            ),
        )
    except ValidationError as exc:
        raise SourceRecordValidationError(
            "The source layers or derived values are inconsistent.",
            physical_page_number=ocr_result.physical_page_number,
            card_index=ocr_result.card_index,
        ) from exc


def build_page_source_records(
    *,
    document_id: UUID,
    revision_identifier: str,
    part_number: int,
    source_language: SourceLanguage,
    physical_page_number: int,
    cards: list[SourceCardInput],
    versions: PipelineVersions,
) -> PageIngestionResult:
    records: list[SourceRecordCandidate] = []
    failures: list[SourceRecordFailure] = []
    for card in cards:
        try:
            if card.ocr_result.physical_page_number != physical_page_number:
                raise SourceRecordValidationError(
                    "The card OCR result belongs to a different physical page.",
                    expected_page=physical_page_number,
                    actual_page=card.ocr_result.physical_page_number,
                )
            records.append(
                build_source_record(
                    document_id=document_id,
                    revision_identifier=revision_identifier,
                    part_number=part_number,
                    source_language=source_language,
                    card_bbox=card.card_bbox,
                    original_card_text=card.original_card_text,
                    ocr_result=card.ocr_result,
                    versions=versions,
                    printed_page_number=card.printed_page_number,
                )
            )
        except ExtractionError as exc:
            failures.append(
                SourceRecordFailure(
                    physical_page_number=physical_page_number,
                    card_index=card.ocr_result.card_index,
                    error_code=exc.code,
                    message=exc.message,
                    retryable=exc.retryable,
                )
            )

    return PageIngestionResult(
        document_id=document_id,
        part_number=part_number,
        source_language=source_language,
        physical_page_number=physical_page_number,
        source_card_count=len(cards),
        persisted_candidate_count=len(records),
        review_candidate_count=sum(record.requires_review for record in records),
        records=records,
        failures=failures,
    )

