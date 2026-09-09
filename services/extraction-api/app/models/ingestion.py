from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import Field, field_validator, model_validator

from app.models.common import PipelineVersions, SUPPORTED_PARTS, SourceLanguage, StrictModel
from app.models.field_regions import FieldType
from app.models.ocr import CardOcrResult
from app.models.segmentation import BoundingBox
from app.ocr.normalization import normalize_ocr_value


EXPECTED_PART_TOTALS = {227: 1014, 228: 973, 229: 888, 230: 579}


class IssueSeverity(StrEnum):
    CRITICAL = "critical"
    NEEDS_REVIEW = "needs_review"
    INFORMATIONAL = "informational"


class PagePersistenceStatus(StrEnum):
    PROCESSING = "processing"
    COMPLETED = "completed"
    COMPLETED_WITH_WARNINGS = "completed_with_warnings"
    REQUIRES_REVIEW = "requires_review"
    FAILED = "failed"


class SourceFieldValues(StrictModel):
    serial_number: str | None = None
    epic: str | None = None
    voter_name: str | None = None
    relation_name: str | None = None
    relation_type: str | None = None
    house_number: str | None = None
    age: str | None = None
    gender: str | None = None


FIELD_ATTRIBUTE_MAP: dict[FieldType, str] = {
    FieldType.SERIAL_NUMBER: "serial_number",
    FieldType.EPIC: "epic",
    FieldType.VOTER_NAME: "voter_name",
    FieldType.RELATION_NAME: "relation_name",
    FieldType.RELATION_TYPE: "relation_type",
    FieldType.HOUSE_NUMBER: "house_number",
    FieldType.AGE: "age",
    FieldType.GENDER: "gender",
}


class IngestionIssue(StrictModel):
    code: str = Field(min_length=1, max_length=80)
    severity: IssueSeverity
    field_type: FieldType | None = None
    message: str = Field(min_length=1, max_length=240)
    details: dict[str, Any] = Field(default_factory=dict)


class SourceRecordCandidate(StrictModel):
    source_record_id: UUID
    document_id: UUID
    revision_identifier: str = Field(min_length=1, max_length=160)
    part_number: int
    source_language: SourceLanguage
    physical_page_number: int = Field(ge=1)
    printed_page_number: int | None = Field(default=None, ge=1)
    card_index: int = Field(ge=1, le=30)
    card_bbox: BoundingBox
    original_card_text: str
    raw: SourceFieldValues
    normalized: SourceFieldValues
    serial_number: int | None = Field(default=None, ge=1)
    age: int | None = Field(default=None, ge=18, le=125)
    field_confidence: dict[FieldType, float | None] = Field(default_factory=dict)
    ocr_engine: str | None = None
    ocr_engine_version: str | None = None
    extraction_method: str = Field(default="ocr", min_length=1, max_length=80)
    versions: PipelineVersions
    issues: list[IngestionIssue] = Field(default_factory=list)
    requires_review: bool

    @field_validator("part_number")
    @classmethod
    def validate_part(cls, value: int) -> int:
        if value not in SUPPORTED_PARTS:
            raise ValueError("source records support only Parts 227–230")
        return value

    @field_validator("source_language")
    @classmethod
    def validate_ingestion_language(cls, value: SourceLanguage) -> SourceLanguage:
        if value not in {SourceLanguage.ENGLISH, SourceLanguage.TELUGU}:
            raise ValueError("Phase 3 source ingestion is enabled only for English and Telugu")
        return value

    @model_validator(mode="after")
    def validate_source_layers(self) -> "SourceRecordCandidate":
        for field_type, attribute in FIELD_ATTRIBUTE_MAP.items():
            raw_value = getattr(self.raw, attribute)
            expected = normalize_ocr_value(raw_value, field_type) if raw_value is not None else None
            if getattr(self.normalized, attribute) != expected:
                raise ValueError(f"normalized.{attribute} must be derived from raw.{attribute}")

        normalized_serial = self.normalized.serial_number
        valid_serial = None
        if normalized_serial is not None:
            parsed = int(normalized_serial)
            if 1 <= parsed <= EXPECTED_PART_TOTALS[self.part_number]:
                valid_serial = parsed
        if self.serial_number != valid_serial:
            raise ValueError("serial_number must contain only a valid in-range normalized serial")

        normalized_age = self.normalized.age
        valid_age = None
        if normalized_age is not None:
            parsed_age = int(normalized_age)
            if 18 <= parsed_age <= 125:
                valid_age = parsed_age
        if self.age != valid_age:
            raise ValueError("age must contain only a plausible normalized age")

        issue_codes = [issue.code for issue in self.issues]
        if len(issue_codes) != len(set(issue_codes)):
            raise ValueError("ingestion issue codes must be unique per card")
        expected_review = any(
            issue.severity in {IssueSeverity.CRITICAL, IssueSeverity.NEEDS_REVIEW}
            for issue in self.issues
        )
        if self.requires_review != expected_review:
            raise ValueError("requires_review must reflect critical and needs-review issues")
        return self


class SourceCardInput(StrictModel):
    ocr_result: CardOcrResult
    card_bbox: BoundingBox
    original_card_text: str
    printed_page_number: int | None = Field(default=None, ge=1)


class SourceRecordFailure(StrictModel):
    physical_page_number: int = Field(ge=1)
    card_index: int = Field(ge=1, le=30)
    error_code: str
    message: str
    retryable: bool


class PageIngestionResult(StrictModel):
    document_id: UUID
    part_number: int
    source_language: SourceLanguage
    physical_page_number: int = Field(ge=1)
    source_card_count: int = Field(ge=0, le=30)
    persisted_candidate_count: int = Field(ge=0, le=30)
    review_candidate_count: int = Field(ge=0, le=30)
    records: list[SourceRecordCandidate] = Field(default_factory=list, max_length=30)
    failures: list[SourceRecordFailure] = Field(default_factory=list, max_length=30)

    @field_validator("part_number")
    @classmethod
    def validate_part(cls, value: int) -> int:
        if value not in SUPPORTED_PARTS:
            raise ValueError("page ingestion supports only Parts 227–230")
        return value

    @field_validator("source_language")
    @classmethod
    def validate_language(cls, value: SourceLanguage) -> SourceLanguage:
        if value not in {SourceLanguage.ENGLISH, SourceLanguage.TELUGU}:
            raise ValueError("page ingestion is enabled only for English and Telugu")
        return value

    @model_validator(mode="after")
    def validate_counts(self) -> "PageIngestionResult":
        if self.source_card_count != len(self.records) + len(self.failures):
            raise ValueError("every source card must produce a record candidate or isolated failure")
        if self.persisted_candidate_count != len(self.records):
            raise ValueError("persisted_candidate_count must equal record candidates")
        if self.review_candidate_count != sum(record.requires_review for record in self.records):
            raise ValueError("review_candidate_count must equal review candidates")
        return self


class PageProcessingState(StrictModel):
    document_id: UUID
    processing_run_id: UUID
    physical_page_number: int = Field(ge=1)
    printed_page_number: int | None = Field(default=None, ge=1)
    status: PagePersistenceStatus
    attempts: int = Field(ge=1, le=3)
    records_detected: int = Field(ge=0, le=30)
    records_extracted: int = Field(ge=0, le=30)
    review_records: int = Field(ge=0, le=30)
    error_message: str | None = None
    cards: list[dict[str, Any]] = Field(default_factory=list)
    updated_at: datetime

    @model_validator(mode="after")
    def validate_page_counts(self) -> "PageProcessingState":
        if self.records_extracted > self.records_detected:
            raise ValueError("records_extracted cannot exceed detected cards")
        if self.review_records > self.records_extracted:
            raise ValueError("review_records cannot exceed extracted records")
        return self

