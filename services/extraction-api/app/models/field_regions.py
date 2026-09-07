from __future__ import annotations

from enum import StrEnum

from pydantic import Field, model_validator

from app.models.common import SourceLanguage, StrictModel
from app.models.segmentation import BoundingBox


class FieldType(StrEnum):
    SERIAL_NUMBER = "serial_number"
    EPIC = "epic"
    VOTER_NAME = "voter_name"
    RELATION_NAME = "relation_name"
    RELATION_TYPE = "relation_type"
    HOUSE_NUMBER = "house_number"
    AGE = "age"
    GENDER = "gender"


TARGET_FIELD_TYPES = tuple(FieldType)


class RelativeBoundingBox(StrictModel):
    """Card-relative coordinates constrained to the inclusive zero-to-one range."""

    x1: float = Field(ge=0, le=1)
    y1: float = Field(ge=0, le=1)
    x2: float = Field(ge=0, le=1)
    y2: float = Field(ge=0, le=1)

    @model_validator(mode="after")
    def validate_positive_area(self) -> "RelativeBoundingBox":
        if self.x2 <= self.x1 or self.y2 <= self.y1:
            raise ValueError("relative bounding box must have positive area")
        return self


class FieldRegion(StrictModel):
    field_type: FieldType
    relative_bbox: RelativeBoundingBox
    page_bbox: BoundingBox
    crop_width: int = Field(ge=1)
    crop_height: int = Field(ge=1)
    crop_png_bytes: bytes

    @model_validator(mode="after")
    def validate_crop_dimensions(self) -> "FieldRegion":
        if self.crop_width != self.page_bbox.width:
            raise ValueError("crop_width must equal page_bbox width")
        if self.crop_height != self.page_bbox.height:
            raise ValueError("crop_height must equal page_bbox height")
        if not self.crop_png_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
            raise ValueError("crop bytes must contain a PNG image")
        return self


class CardFieldRegions(StrictModel):
    physical_page_number: int = Field(ge=1)
    card_index: int = Field(ge=1, le=30)
    row_index: int = Field(ge=1, le=10)
    column_index: int = Field(ge=1, le=3)
    source_language: SourceLanguage
    template_id: str
    template_version: str
    card_bbox: BoundingBox
    fields: list[FieldRegion]

    @model_validator(mode="after")
    def validate_fields(self) -> "CardFieldRegions":
        field_types = [field.field_type for field in self.fields]
        if tuple(field_types) != TARGET_FIELD_TYPES:
            raise ValueError("card fields must contain every target field once in contract order")
        for field in self.fields:
            bbox = field.page_bbox
            if not (
                self.card_bbox.x1 <= bbox.x1 < bbox.x2 <= self.card_bbox.x2
                and self.card_bbox.y1 <= bbox.y1 < bbox.y2 <= self.card_bbox.y2
            ):
                raise ValueError("every field bbox must remain inside its parent card")
        return self


class CardFieldRegionFailure(StrictModel):
    physical_page_number: int = Field(ge=1)
    card_index: int = Field(ge=1, le=30)
    error_code: str
    message: str
    retryable: bool


class PageFieldRegionResult(StrictModel):
    physical_page_number: int = Field(ge=1)
    source_language: SourceLanguage
    source_card_count: int = Field(ge=0, le=30)
    processed_card_count: int = Field(ge=0, le=30)
    cards: list[CardFieldRegions] = Field(default_factory=list, max_length=30)
    failures: list[CardFieldRegionFailure] = Field(default_factory=list, max_length=30)

    @model_validator(mode="after")
    def validate_counts(self) -> "PageFieldRegionResult":
        if self.processed_card_count != len(self.cards):
            raise ValueError("processed_card_count must equal the number of card results")
        if self.source_card_count != len(self.cards) + len(self.failures):
            raise ValueError("every source card must produce a result or isolated failure")
        return self
