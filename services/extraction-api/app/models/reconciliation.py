from __future__ import annotations

from enum import StrEnum
from uuid import UUID

from pydantic import Field, field_validator, model_validator

from app.models.common import SUPPORTED_PARTS, SourceLanguage, StrictModel


class EvidenceState(StrEnum):
    AGREE = "agree"
    CONFLICT = "conflict"
    UNAVAILABLE = "unavailable"


class ReconciliationStatus(StrEnum):
    RECONCILED = "reconciled"
    NEEDS_REVIEW = "needs_review"
    SOURCE_MISSING = "source_missing"
    DUPLICATE_SOURCE = "duplicate_source"


class ReconciliationSource(StrictModel):
    source_record_id: UUID
    part_number: int
    serial_number: int | None = Field(default=None, ge=1)
    source_language: SourceLanguage
    normalized_epic: str | None = None
    normalized_house_number: str | None = None
    age: int | None = None
    normalized_gender: str | None = None

    @field_validator("part_number")
    @classmethod
    def validate_part(cls, value: int) -> int:
        if value not in SUPPORTED_PARTS:
            raise ValueError("reconciliation supports only Parts 227–230")
        return value

    @field_validator("source_language")
    @classmethod
    def validate_language(cls, value: SourceLanguage) -> SourceLanguage:
        if value not in {SourceLanguage.ENGLISH, SourceLanguage.TELUGU}:
            raise ValueError("reconciliation is enabled only for English and Telugu")
        return value


class StructuredEvidence(StrictModel):
    epic: EvidenceState
    house_number: EvidenceState
    age: EvidenceState
    gender: EvidenceState
    names_compared_across_scripts: bool = False


class ReconciliationResult(StrictModel):
    part_number: int
    serial_number: int
    english_record_ids: list[UUID] = Field(default_factory=list)
    telugu_record_ids: list[UUID] = Field(default_factory=list)
    status: ReconciliationStatus
    safe_to_link: bool
    evidence: StructuredEvidence
    conflict_fields: list[str] = Field(default_factory=list)
    reasons: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_result(self) -> "ReconciliationResult":
        if self.safe_to_link and (
            len(self.english_record_ids) != 1 or len(self.telugu_record_ids) != 1
        ):
            raise ValueError("safe links require exactly one English and one Telugu source")
        if self.status == ReconciliationStatus.RECONCILED and self.conflict_fields:
            raise ValueError("reconciled records cannot contain structured conflicts")
        return self


class ReconciliationBatch(StrictModel):
    part_number: int
    evaluated_identity_count: int = Field(ge=0)
    reconciled_count: int = Field(ge=0)
    needs_review_count: int = Field(ge=0)
    source_missing_count: int = Field(ge=0)
    duplicate_source_count: int = Field(ge=0)
    unlinked_record_ids: list[UUID] = Field(default_factory=list)
    results: list[ReconciliationResult] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_counts(self) -> "ReconciliationBatch":
        counts = (
            self.reconciled_count
            + self.needs_review_count
            + self.source_missing_count
            + self.duplicate_source_count
        )
        if counts != self.evaluated_identity_count or len(self.results) != counts:
            raise ValueError("reconciliation counts must account for every evaluated identity")
        return self


class LanguageCompleteness(StrictModel):
    source_language: SourceLanguage
    expected_serial_count: int = Field(ge=1)
    source_record_count: int = Field(ge=0)
    valid_record_count: int = Field(ge=0)
    distinct_expected_serial_count: int = Field(ge=0)
    missing_serials: list[int]
    duplicate_serials: dict[int, int]
    invalid_or_unexpected_record_ids: list[UUID]


class SuspiciousEpic(StrictModel):
    source_language: SourceLanguage
    normalized_epic: str
    serial_numbers: list[int]
    source_record_ids: list[UUID]


class PartQualityReport(StrictModel):
    part_number: int
    expected_serial_count: int
    languages: list[LanguageCompleteness]
    suspicious_epics: list[SuspiciousEpic]
    reconciliation: ReconciliationBatch

