from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, field_validator, model_validator

from app.models.common import SUPPORTED_PARTS, SourceLanguage, StrictModel
from app.models.field_regions import FieldType
from app.models.segmentation import BoundingBox
from app.ocr.normalization import normalize_ocr_value


EXPECTED_PART_SERIAL_MAX = {
    227: 1014,
    228: 973,
    229: 888,
    230: 579,
}

GROUND_TRUTH_FIELD_MAP = {
    "serial_number": FieldType.SERIAL_NUMBER,
    "epic": FieldType.EPIC,
    "voter_name": FieldType.VOTER_NAME,
    "relation_name": FieldType.RELATION_NAME,
    "relation_type": FieldType.RELATION_TYPE,
    "house_number": FieldType.HOUSE_NUMBER,
    "age": FieldType.AGE,
    "gender": FieldType.GENDER,
}

CANONICAL_RELATION_TYPES = frozenset(
    {"Father", "Mother", "Husband", "Guardian", "Other", "Unknown"}
)


class GroundTruthFieldValues(StrictModel):
    serial_number: str | None
    epic: str | None
    voter_name: str | None
    relation_name: str | None
    relation_type: str | None
    house_number: str | None
    age: str | None
    gender: str | None


class GroundTruthRecord(StrictModel):
    case_id: str = Field(min_length=1, max_length=120, pattern=r"^[A-Za-z0-9._-]+$")
    revision_code: str = Field(min_length=1, max_length=120)
    ground_truth_version: str = Field(
        min_length=1,
        max_length=40,
        pattern=r"^[0-9]+\.[0-9]+\.[0-9]+$",
    )
    part_number: int
    serial_number: int = Field(ge=1)
    source_language: SourceLanguage
    source_document_checksum: str = Field(pattern=r"^[a-f0-9]{64}$")
    source_physical_page: int = Field(ge=1)
    source_printed_page: int | None = Field(default=None, ge=1)
    source_card_index: int = Field(ge=1, le=30)
    source_bbox: BoundingBox | None = None
    raw: GroundTruthFieldValues
    normalized: GroundTruthFieldValues
    gold: GroundTruthFieldValues
    verification_method: Literal["human"] = "human"
    verified_by: UUID
    verified_at: datetime
    verification_note: str | None = Field(default=None, max_length=500)

    @field_validator("part_number")
    @classmethod
    def validate_supported_part(cls, value: int) -> int:
        if value not in SUPPORTED_PARTS:
            raise ValueError("ground truth supports only Parts 227–230")
        return value

    @field_validator("source_language")
    @classmethod
    def validate_benchmark_language(cls, value: SourceLanguage) -> SourceLanguage:
        if value not in {SourceLanguage.ENGLISH, SourceLanguage.TELUGU}:
            raise ValueError("ground truth is currently enabled only for English and Telugu")
        return value

    @field_validator("verified_at")
    @classmethod
    def validate_verified_at_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("verified_at must include a timezone")
        return value

    @model_validator(mode="after")
    def validate_identity_and_layers(self) -> "GroundTruthRecord":
        maximum = EXPECTED_PART_SERIAL_MAX[self.part_number]
        if self.serial_number > maximum:
            raise ValueError("serial_number is outside the expected Part range")

        for attribute, field_type in GROUND_TRUTH_FIELD_MAP.items():
            raw_value = getattr(self.raw, attribute)
            expected_normalized = (
                normalize_ocr_value(raw_value, field_type)
                if raw_value is not None
                else None
            )
            if getattr(self.normalized, attribute) != expected_normalized:
                raise ValueError(
                    f"normalized.{attribute} must be derived from raw.{attribute}"
                )

            gold_value = getattr(self.gold, attribute)
            if gold_value is not None and not gold_value.strip():
                raise ValueError(f"gold.{attribute} cannot contain only whitespace")

        gold_serial = self.gold.serial_number
        if gold_serial is None:
            raise ValueError("gold.serial_number is required")
        if normalize_ocr_value(gold_serial, FieldType.SERIAL_NUMBER) != str(
            self.serial_number
        ):
            raise ValueError("gold.serial_number must match the record identity")

        if self.gold.age is not None:
            normalized_age = normalize_ocr_value(self.gold.age, FieldType.AGE)
            if normalized_age is None or not 18 <= int(normalized_age) <= 130:
                raise ValueError("gold.age must be a plausible verified age")

        if (
            self.gold.relation_type is not None
            and self.gold.relation_type not in CANONICAL_RELATION_TYPES
        ):
            raise ValueError("gold.relation_type must use the canonical relation model")
        return self


class GroundTruthCoverage(StrictModel):
    total_records: int = Field(ge=0)
    counts_by_part_language: dict[str, int]
    covered_parts: list[int]
    covered_languages: list[SourceLanguage]
    missing_part_language_groups: list[str]
    recommended_target_records: int = 480
    recommended_target_reached: bool
    warnings: list[str]

    @model_validator(mode="after")
    def validate_coverage_counts(self) -> "GroundTruthCoverage":
        expected_groups = {
            f"{part}:{language.value}"
            for part in sorted(EXPECTED_PART_SERIAL_MAX)
            for language in (SourceLanguage.ENGLISH, SourceLanguage.TELUGU)
        }
        if set(self.counts_by_part_language) != expected_groups:
            raise ValueError("coverage must include every EN/TE Part group")
        if sum(self.counts_by_part_language.values()) != self.total_records:
            raise ValueError("coverage group counts must equal total_records")
        if self.recommended_target_reached != (
            self.total_records >= self.recommended_target_records
        ):
            raise ValueError("recommended target flag does not match total_records")
        return self


class GroundTruthDataset(StrictModel):
    revision_code: str = Field(min_length=1, max_length=120)
    import_checksum_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    records: list[GroundTruthRecord] = Field(min_length=1)
    coverage: GroundTruthCoverage

    @model_validator(mode="after")
    def validate_dataset(self) -> "GroundTruthDataset":
        case_ids: set[str] = set()
        identities: set[tuple[int, int, SourceLanguage]] = set()
        for record in self.records:
            if record.revision_code != self.revision_code:
                raise ValueError("every record must use the dataset revision_code")
            if record.case_id in case_ids:
                raise ValueError("case_id must be unique")
            identity = (
                record.part_number,
                record.serial_number,
                record.source_language,
            )
            if identity in identities:
                raise ValueError(
                    "Part, serial number and language must be unique in a dataset"
                )
            case_ids.add(record.case_id)
            identities.add(identity)
        if self.coverage.total_records != len(self.records):
            raise ValueError("coverage total must equal dataset record count")
        expected_counts = {
            f"{part}:{language.value}": 0
            for part in sorted(EXPECTED_PART_SERIAL_MAX)
            for language in (SourceLanguage.ENGLISH, SourceLanguage.TELUGU)
        }
        for record in self.records:
            expected_counts[
                f"{record.part_number}:{record.source_language.value}"
            ] += 1
        if self.coverage.counts_by_part_language != expected_counts:
            raise ValueError("coverage groups do not match dataset records")
        return self

