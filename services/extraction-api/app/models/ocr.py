from __future__ import annotations

from enum import StrEnum

from pydantic import Field, model_validator

from app.models.common import SourceLanguage, StrictModel
from app.models.field_regions import FieldRegion, FieldType
from app.models.segmentation import BoundingBox


class OcrEngine(StrEnum):
    TESSERACT = "tesseract"
    PADDLEOCR = "paddleocr"


class OcrPreprocessingVariant(StrEnum):
    ORIGINAL = "original"
    GRAYSCALE_HIGH_CONTRAST = "grayscale_high_contrast"
    BINARY_OTSU = "binary_otsu"


class OcrAttemptStatus(StrEnum):
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class OcrRetryPolicy(StrictModel):
    max_retries: int = Field(default=2, ge=0, le=2)
    retry_below_confidence: float | None = Field(default=None, ge=0, le=1)
    retry_when_confidence_missing: bool = False
    variants: tuple[OcrPreprocessingVariant, ...] = (
        OcrPreprocessingVariant.ORIGINAL,
        OcrPreprocessingVariant.GRAYSCALE_HIGH_CONTRAST,
        OcrPreprocessingVariant.BINARY_OTSU,
    )

    @model_validator(mode="after")
    def validate_variants(self) -> "OcrRetryPolicy":
        required_attempts = self.max_retries + 1
        if len(self.variants) < required_attempts:
            raise ValueError("retry policy must provide one variant per possible attempt")
        active_variants = self.variants[:required_attempts]
        if active_variants[0] != OcrPreprocessingVariant.ORIGINAL:
            raise ValueError("the first OCR attempt must use the original crop")
        if len(active_variants) != len(set(active_variants)):
            raise ValueError("active OCR preprocessing variants must be unique")
        return self


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
    attempt_number: int = Field(default=1, ge=1, le=3)
    preprocessing_variant: OcrPreprocessingVariant = OcrPreprocessingVariant.ORIGINAL


class OcrFieldFailure(StrictModel):
    field_type: FieldType
    error_code: str
    message: str
    retryable: bool
    attempt_count: int = Field(default=1, ge=1, le=3)
    retry_exhausted: bool = False


class OcrAttemptError(StrictModel):
    error_code: str
    message: str
    retryable: bool


class OcrFieldAttempt(StrictModel):
    field_type: FieldType
    attempt_number: int = Field(ge=1, le=3)
    preprocessing_variant: OcrPreprocessingVariant
    status: OcrAttemptStatus
    result: OcrFieldResult | None = None
    error: OcrAttemptError | None = None

    @model_validator(mode="after")
    def validate_outcome(self) -> "OcrFieldAttempt":
        if (self.result is None) == (self.error is None):
            raise ValueError("an OCR attempt must contain exactly one result or error")
        expected_status = (
            OcrAttemptStatus.SUCCEEDED
            if self.result is not None
            else OcrAttemptStatus.FAILED
        )
        if self.status != expected_status:
            raise ValueError("OCR attempt status does not match its outcome")
        if self.result is not None and (
            self.result.field_type != self.field_type
            or self.result.attempt_number != self.attempt_number
            or self.result.preprocessing_variant != self.preprocessing_variant
        ):
            raise ValueError("OCR attempt result metadata does not match the attempt")
        return self


class CardOcrResult(StrictModel):
    physical_page_number: int = Field(ge=1)
    card_index: int = Field(ge=1, le=30)
    source_language: SourceLanguage
    fields: list[OcrFieldResult]
    failures: list[OcrFieldFailure]
    attempts: list[OcrFieldAttempt] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_unique_field_outcomes(self) -> "CardOcrResult":
        outcomes = [field.field_type for field in self.fields]
        outcomes.extend(failure.field_type for failure in self.failures)
        if len(outcomes) != len(set(outcomes)):
            raise ValueError("each field must have exactly one OCR outcome")
        attempts_by_field: dict[FieldType, list[OcrFieldAttempt]] = {}
        for attempt in self.attempts:
            attempts_by_field.setdefault(attempt.field_type, []).append(attempt)
        for field_attempts in attempts_by_field.values():
            numbers = [attempt.attempt_number for attempt in field_attempts]
            if numbers != list(range(1, len(field_attempts) + 1)):
                raise ValueError("OCR attempt numbers must be contiguous and ordered")
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

