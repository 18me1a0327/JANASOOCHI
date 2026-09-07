from __future__ import annotations

from enum import StrEnum

from pydantic import Field, model_validator

from app.models.common import SourceLanguage, StrictModel
from app.models.field_regions import FieldRegion, FieldType
from app.models.segmentation import BoundingBox


class OcrEngine(StrEnum):
    TESSERACT = "tesseract"
    PADDLEOCR = "paddleocr"


class OcrFieldResult(StrictModel):
    field_type: FieldType
    source_language: SourceLanguage
    page_bbox: BoundingBox
    raw_value: str
    normalized_value: str | None
    ocr_engine: OcrEngine
    ocr_engine_version: str
    field_confidence: float | None = Field(default=None, ge=0, le=1)
    processing_version: str


class OcrFieldFailure(StrictModel):
    field_type: FieldType
    error_code: str
    message: str
    retryable: bool


class CardOcrResult(StrictModel):
    physical_page_number: int = Field(ge=1)
    card_index: int = Field(ge=1, le=30)
    source_language: SourceLanguage
    fields: list[OcrFieldResult]
    failures: list[OcrFieldFailure]

    @model_validator(mode="after")
    def validate_unique_field_outcomes(self) -> "CardOcrResult":
        outcomes = [field.field_type for field in self.fields]
        outcomes.extend(failure.field_type for failure in self.failures)
        if len(outcomes) != len(set(outcomes)):
            raise ValueError("each field must have exactly one OCR outcome")
        return self


class OcrBenchmarkCase(StrictModel):
    case_id: str
    source_language: SourceLanguage
    field_region: FieldRegion
    expected_normalized_value: str


class OcrBenchmarkSummary(StrictModel):
    ocr_engine: OcrEngine
    ocr_engine_version: str
    total_cases: int = Field(ge=0)
    completed_cases: int = Field(ge=0)
    exact_matches: int = Field(ge=0)
    failures: int = Field(ge=0)
    exact_accuracy: float | None = Field(default=None, ge=0, le=1)

    @model_validator(mode="after")
    def validate_counts(self) -> "OcrBenchmarkSummary":
        if self.completed_cases + self.failures != self.total_cases:
            raise ValueError("completed and failed cases must equal total cases")
        if self.exact_matches > self.completed_cases:
            raise ValueError("exact matches cannot exceed completed cases")
        expected_accuracy = (
            self.exact_matches / self.total_cases if self.total_cases else None
        )
        if self.exact_accuracy != expected_accuracy:
            raise ValueError("exact_accuracy must use every supplied case as denominator")
        return self
