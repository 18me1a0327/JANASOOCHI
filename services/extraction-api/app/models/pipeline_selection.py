from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, field_validator, model_validator

from app.models.common import PipelineVersions, SUPPORTED_PARTS, SourceLanguage, StrictModel
from app.models.field_regions import FieldType, TARGET_FIELD_TYPES
from app.models.ocr_comparison import ConfigurationBenchmark, OcrConfiguration


_TEXT_FIELDS = frozenset({FieldType.VOTER_NAME, FieldType.RELATION_NAME})


class PipelineSelectionPolicy(StrictModel):
    policy_id: str = Field(min_length=1, max_length=120)
    policy_version: str = Field(pattern=r"^[0-9]+\.[0-9]+\.[0-9]+$")
    minimum_gold_cards: int = Field(ge=1)
    minimum_configuration_count: int = Field(default=2, ge=2)
    required_parts: tuple[int, ...] = (227, 228, 229, 230)
    required_languages: tuple[SourceLanguage, ...] = (
        SourceLanguage.ENGLISH,
        SourceLanguage.TELUGU,
    )
    minimum_exact_accuracy_by_field: dict[FieldType, float]
    maximum_character_error_rate: dict[FieldType, float]
    maximum_word_error_rate: dict[FieldType, float]
    maximum_extraction_failure_rate: float = Field(ge=0, le=1)
    maximum_empty_ocr_rate: float = Field(ge=0, le=1)
    maximum_runtime_ms_per_card: float | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def validate_gates(self) -> "PipelineSelectionPolicy":
        if set(self.required_parts) != set(SUPPORTED_PARTS) or len(self.required_parts) != len(SUPPORTED_PARTS):
            raise ValueError("pipeline selection must require Parts 227–230 exactly once")
        if set(self.required_languages) != {SourceLanguage.ENGLISH, SourceLanguage.TELUGU} or len(self.required_languages) != 2:
            raise ValueError("pipeline selection must require English and Telugu exactly once")
        if set(self.minimum_exact_accuracy_by_field) != set(TARGET_FIELD_TYPES):
            raise ValueError("exact-accuracy gates must cover every voter field")
        if set(self.maximum_character_error_rate) != _TEXT_FIELDS:
            raise ValueError("CER gates must cover voter_name and relation_name")
        if set(self.maximum_word_error_rate) != _TEXT_FIELDS:
            raise ValueError("WER gates must cover voter_name and relation_name")
        if any(not 0 <= value <= 1 for value in self.minimum_exact_accuracy_by_field.values()):
            raise ValueError("exact-accuracy gates must be between zero and one")
        if any(value < 0 for value in self.maximum_character_error_rate.values()):
            raise ValueError("CER gates cannot be negative")
        if any(value < 0 for value in self.maximum_word_error_rate.values()):
            raise ValueError("WER gates cannot be negative")
        return self


class CandidateGateResult(StrictModel):
    configuration_id: str
    report_rank: int = Field(ge=1)
    eligible: bool
    rejection_reasons: list[str]


class PipelineSelectionResult(StrictModel):
    source_report_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    selected_configuration_id: str
    policy: PipelineSelectionPolicy
    candidates: list[CandidateGateResult]

    @model_validator(mode="after")
    def validate_selection(self) -> "PipelineSelectionResult":
        eligible = {
            candidate.configuration_id
            for candidate in self.candidates
            if candidate.eligible
        }
        if self.selected_configuration_id not in eligible:
            raise ValueError("selected configuration must pass every policy gate")
        return self


class FrozenPipelineManifest(StrictModel):
    manifest_version: str = Field(pattern=r"^[0-9]+\.[0-9]+\.[0-9]+$")
    status: Literal["frozen"] = "frozen"
    source_report_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    ground_truth_checksum_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    selection_policy: PipelineSelectionPolicy
    selected_configuration: OcrConfiguration
    selected_metrics: ConfigurationBenchmark
    processing_versions: PipelineVersions
    approved_by: UUID
    approved_at: datetime
    decision_reason: str = Field(min_length=1, max_length=1000)

    @field_validator("approved_at")
    @classmethod
    def validate_approved_at_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("approved_at must include a timezone")
        return value

    @model_validator(mode="after")
    def validate_selected_metrics(self) -> "FrozenPipelineManifest":
        if self.selected_metrics.configuration != self.selected_configuration:
            raise ValueError("frozen metrics must belong to the selected configuration")
        return self

