from __future__ import annotations

from enum import StrEnum

from pydantic import Field, model_validator

from app.models.common import SourceLanguage, StrictModel
from app.models.field_regions import FieldType
from app.models.ground_truth import GroundTruthFieldValues
from app.models.ocr import OcrEngine


class OcrErrorClass(StrEnum):
    EMPTY_OCR = "empty_ocr"
    WRONG_CHARACTER = "wrong_character"
    DIGIT_LETTER_CONFUSION = "digit_letter_confusion"
    TELUGU_CHARACTER_CONFUSION = "telugu_character_confusion"
    SPACING_ISSUE = "spacing_issue"
    PUNCTUATION_ISSUE = "punctuation_issue"
    CROP_LAYOUT_ISSUE = "crop_layout_issue"
    FIELD_PARSER_REJECTION = "field_parser_rejection"
    RETRY_RECOVERED = "retry_recovered"
    RETRY_STILL_FAILED = "retry_still_failed"


class OcrConfiguration(StrictModel):
    configuration_id: str = Field(min_length=1, max_length=120)
    ocr_engine: OcrEngine
    ocr_engine_version: str = Field(min_length=1, max_length=120)
    preprocessing_configuration: str = Field(min_length=1, max_length=120)
    targeted_retry_enabled: bool


class OcrCaseObservation(StrictModel):
    case_id: str = Field(min_length=1, max_length=120)
    configuration_id: str = Field(min_length=1, max_length=120)
    baseline: GroundTruthFieldValues
    final: GroundTruthFieldValues
    baseline_failure_codes: dict[FieldType, str] = Field(default_factory=dict)
    final_failure_codes: dict[FieldType, str] = Field(default_factory=dict)
    retry_count: int = Field(default=0, ge=0)
    runtime_ms: float = Field(ge=0)
    approximate_peak_memory_mb: float | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_failures(self) -> "OcrCaseObservation":
        for values, failures in (
            (self.baseline, self.baseline_failure_codes),
            (self.final, self.final_failure_codes),
        ):
            for field_type, code in failures.items():
                if not code.strip():
                    raise ValueError("OCR failure codes cannot be empty")
                if getattr(values, field_type.value) is not None:
                    raise ValueError("a failed OCR field cannot also contain a value")
        return self


class FieldAccuracyMetrics(StrictModel):
    field_type: FieldType
    total_evaluated: int = Field(ge=0)
    correct_count: int = Field(ge=0)
    incorrect_count: int = Field(ge=0)
    missing_empty_count: int = Field(ge=0)
    failure_count: int = Field(ge=0)
    exact_accuracy: float | None = Field(default=None, ge=0, le=1)
    character_error_rate: float | None = Field(default=None, ge=0)
    word_error_rate: float | None = Field(default=None, ge=0)
    invalid_format_count: int = Field(default=0, ge=0)
    parseable_age_count: int = Field(default=0, ge=0)
    age_absolute_error_total: int | None = Field(default=None, ge=0)
    age_mean_absolute_error: float | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_counts(self) -> "FieldAccuracyMetrics":
        if self.correct_count + self.incorrect_count + self.missing_empty_count != self.total_evaluated:
            raise ValueError("field outcome counts must equal total_evaluated")
        if self.failure_count > self.missing_empty_count:
            raise ValueError("failed fields must be represented as missing OCR output")
        expected = self.correct_count / self.total_evaluated if self.total_evaluated else None
        if self.exact_accuracy != expected:
            raise ValueError("exact_accuracy must include every evaluated GOLD value")
        return self


class RetryImpact(StrictModel):
    field_type: FieldType
    total_evaluated: int = Field(ge=0)
    before_correct_count: int = Field(ge=0)
    after_correct_count: int = Field(ge=0)
    before_accuracy: float | None = Field(default=None, ge=0, le=1)
    after_accuracy: float | None = Field(default=None, ge=0, le=1)
    absolute_improvement: float | None = Field(default=None, ge=-1, le=1)


class AggregateOcrMetrics(StrictModel):
    total_cases: int = Field(ge=0)
    successful_card_count: int = Field(ge=0)
    extraction_failure_count: int = Field(ge=0)
    evaluated_field_count: int = Field(ge=0)
    empty_ocr_count: int = Field(ge=0)
    retry_case_count: int = Field(ge=0)
    retry_rate: float | None = Field(default=None, ge=0, le=1)
    runtime_ms: float = Field(ge=0)
    approximate_peak_memory_mb: float | None = Field(default=None, ge=0)
    fields: dict[FieldType, FieldAccuracyMetrics]
    retry_impact: dict[FieldType, RetryImpact]
    error_class_counts: dict[OcrErrorClass, int]


class ConfigurationBenchmark(StrictModel):
    configuration: OcrConfiguration
    overall: AggregateOcrMetrics
    by_language: dict[SourceLanguage, AggregateOcrMetrics]
    by_part: dict[int, AggregateOcrMetrics]


class OcrComparisonReport(StrictModel):
    schema_version: str = "1.0.0"
    revision_code: str | None
    ground_truth_checksum_sha256: str | None
    total_cards: int = Field(ge=0)
    english_cards: int = Field(ge=0)
    telugu_cards: int = Field(ge=0)
    parts_represented: list[int]
    configurations: list[ConfigurationBenchmark]
    ranked_configuration_ids: list[str]
    warnings: list[str]

