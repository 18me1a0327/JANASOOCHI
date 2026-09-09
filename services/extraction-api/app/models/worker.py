from __future__ import annotations

from uuid import UUID

from pydantic import Field, field_validator, model_validator

from app.models.common import SUPPORTED_PARTS, SourceLanguage, StrictModel
from app.models.ingestion import PagePersistenceStatus


class PageWorkRequest(StrictModel):
    document_id: UUID
    processing_run_id: UUID
    revision_identifier: str = Field(min_length=1, max_length=160)
    part_number: int
    source_language: SourceLanguage
    physical_page_number: int = Field(ge=1)
    total_pdf_pages: int = Field(ge=1)
    printed_page_number: int | None = Field(default=None, ge=1)
    pdf_bytes: bytes = Field(min_length=5, repr=False)
    render_dpi: int = Field(default=300, ge=72, le=600)

    @field_validator("part_number")
    @classmethod
    def validate_part(cls, value: int) -> int:
        if value not in SUPPORTED_PARTS:
            raise ValueError("page processing supports only Parts 227–230")
        return value

    @field_validator("source_language")
    @classmethod
    def validate_language(cls, value: SourceLanguage) -> SourceLanguage:
        if value not in {SourceLanguage.ENGLISH, SourceLanguage.TELUGU}:
            raise ValueError("page processing is enabled only for English and Telugu")
        return value

    @model_validator(mode="after")
    def validate_physical_page(self) -> "PageWorkRequest":
        if self.physical_page_number > self.total_pdf_pages:
            raise ValueError("physical_page_number exceeds the source document")
        return self


class PageWorkOutcome(StrictModel):
    document_id: UUID
    processing_run_id: UUID
    physical_page_number: int = Field(ge=1)
    status: PagePersistenceStatus
    processing_attempts: int = Field(ge=1, le=3)
    persistence_attempts: int = Field(ge=0, le=3)
    records_detected: int = Field(ge=0, le=30)
    records_extracted: int = Field(ge=0, le=30)
    review_records: int = Field(ge=0, le=30)
    persisted: bool
    page_id: int | None = Field(default=None, ge=1)
    inserted_records: int = Field(default=0, ge=0, le=30)
    idempotent_records: int = Field(default=0, ge=0, le=30)
    inserted_review_issues: int = Field(default=0, ge=0, le=300)
    warnings: list[str] = Field(default_factory=list)
    error_code: str | None = None
    error_message: str | None = None

    @model_validator(mode="after")
    def validate_outcome(self) -> "PageWorkOutcome":
        if self.persisted != (self.page_id is not None):
            raise ValueError("persisted and page_id must describe the same outcome")
        if self.records_extracted > self.records_detected:
            raise ValueError("records_extracted cannot exceed detected cards")
        if self.review_records > self.records_extracted:
            raise ValueError("review_records cannot exceed extracted records")
        return self

