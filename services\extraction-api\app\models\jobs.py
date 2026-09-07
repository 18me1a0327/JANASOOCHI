from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import Field, field_validator

from app.models.common import PipelineVersions, SourceLanguage, StrictModel


class JobStatus(StrEnum):
    QUEUED = "queued"
    VALIDATING = "validating"
    PROCESSING = "processing"
    PAUSED = "paused"
    COMPLETED = "completed"
    COMPLETED_WITH_WARNINGS = "completed_with_warnings"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobStage(StrEnum):
    VALIDATION = "validation"
    RENDERING = "rendering"
    SEGMENTATION = "segmentation"
    EXTRACTION = "extraction"
    OCR = "ocr"
    NORMALIZATION = "normalization"
    RECONCILIATION = "reconciliation"
    COMPLETENESS = "completeness"
    REVIEW = "review"
    COMPLETED = "completed"


class JobCreate(StrictModel):
    document_id: UUID
    part_number: int
    source_language: SourceLanguage
    total_pages: int = Field(ge=1)
    requested_pages: list[int] | None = None

    @field_validator("part_number")
    @classmethod
    def validate_part(cls, value: int) -> int:
        if value not in {227, 228, 229, 230}:
            raise ValueError("part_number must be one of 227, 228, 229, or 230")
        return value

    @field_validator("requested_pages")
    @classmethod
    def normalize_requested_pages(cls, value: list[int] | None) -> list[int] | None:
        if value is None:
            return None
        if not value or any(page < 1 for page in value):
            raise ValueError("requested_pages must contain positive physical page numbers")
        return sorted(set(value))


class JobRecord(StrictModel):
    id: UUID
    document_id: UUID
    part_number: int
    source_language: SourceLanguage
    status: JobStatus
    stage: JobStage
    total_pages: int
    requested_pages: list[int] | None
    versions: PipelineVersions
    created_at: datetime
    updated_at: datetime


class JobAccepted(JobRecord):
    status: JobStatus = JobStatus.QUEUED
    stage: JobStage = JobStage.VALIDATION


class HealthResponse(StrictModel):
    status: str
    service: str
    service_version: str
    environment: str
    versions: PipelineVersions
    capabilities: list[str]
