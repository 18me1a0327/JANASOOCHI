from __future__ import annotations

from uuid import UUID

from pydantic import Field, field_validator, model_validator

from app.models.common import SUPPORTED_PARTS, StrictModel
from app.models.ingestion import EXPECTED_PART_TOTALS
from app.models.reconciliation import ReconciliationStatus


class LogicalSlotVerification(StrictModel):
    part_number: int
    serial_number: int = Field(ge=1)
    english_source_record_id: UUID | None = None
    telugu_source_record_id: UUID | None = None
    english_source_verified: bool = False
    telugu_source_verified: bool = False
    reconciliation_status: ReconciliationStatus | None = None
    open_critical_issue_count: int = Field(default=0, ge=0)

    @field_validator("part_number")
    @classmethod
    def validate_part(cls, value: int) -> int:
        if value not in SUPPORTED_PARTS:
            raise ValueError("verification supports only Parts 227–230")
        return value

    @model_validator(mode="after")
    def validate_slot(self) -> "LogicalSlotVerification":
        if self.serial_number > EXPECTED_PART_TOTALS[self.part_number]:
            raise ValueError("serial_number is outside the expected Part range")
        if self.english_source_verified and self.english_source_record_id is None:
            raise ValueError("verified English evidence requires a source record")
        if self.telugu_source_verified and self.telugu_source_record_id is None:
            raise ValueError("verified Telugu evidence requires a source record")
        return self


class GoldenRevisionAssessment(StrictModel):
    expected_logical_voter_count: int = 3454
    unique_expected_slot_count: int = Field(ge=0)
    fully_sourced_slot_count: int = Field(ge=0)
    fully_verified_slot_count: int = Field(ge=0)
    reconciled_slot_count: int = Field(ge=0)
    open_critical_issue_count: int = Field(ge=0)
    missing_slots: list[str]
    duplicate_slots: list[str]
    incomplete_language_slots: list[str]
    unverified_slots: list[str]
    unreconciled_slots: list[str]
    blocker_codes: list[str]
    ready_for_golden_revision: bool

    @model_validator(mode="after")
    def validate_readiness(self) -> "GoldenRevisionAssessment":
        expected_ready = not self.blocker_codes
        if self.ready_for_golden_revision != expected_ready:
            raise ValueError("Golden Revision readiness must reflect every blocker")
        return self


