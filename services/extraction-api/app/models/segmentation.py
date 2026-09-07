from enum import StrEnum

from pydantic import Field, model_validator

from app.models.common import StrictModel


class LayoutType(StrEnum):
    THREE_COLUMN = "three_column"
    THREE_COLUMN_PARTIAL = "three_column_partial"
    NON_VOTER = "non_voter"


class BoundingBox(StrictModel):
    """Rendered-page pixel coordinates using an x1, y1, x2, y2 rectangle."""

    x1: int = Field(ge=0)
    y1: int = Field(ge=0)
    x2: int = Field(ge=1)
    y2: int = Field(ge=1)

    @model_validator(mode="after")
    def validate_positive_area(self) -> "BoundingBox":
        if self.x2 <= self.x1 or self.y2 <= self.y1:
            raise ValueError("bounding box must have positive width and height")
        return self

    @property
    def width(self) -> int:
        return self.x2 - self.x1

    @property
    def height(self) -> int:
        return self.y2 - self.y1


class CardRegion(StrictModel):
    card_index: int = Field(ge=1, le=30)
    row_index: int = Field(ge=1, le=10)
    column_index: int = Field(ge=1, le=3)
    bbox: BoundingBox
    validation_flags: list[str] = Field(default_factory=list)


class PageSegmentationResult(StrictModel):
    physical_page_number: int = Field(ge=1)
    page_width: int = Field(ge=1)
    page_height: int = Field(ge=1)
    layout_type: LayoutType
    candidate_count: int = Field(ge=0, le=30)
    validated_card_count: int = Field(ge=0, le=30)
    cards: list[CardRegion] = Field(default_factory=list, max_length=30)
    warnings: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_card_contract(self) -> "PageSegmentationResult":
        if self.validated_card_count != len(self.cards):
            raise ValueError("validated_card_count must equal the number of cards")
        if self.validated_card_count > self.candidate_count:
            raise ValueError("validated cards cannot exceed candidates")
        expected_order = sorted(
            self.cards,
            key=lambda card: (card.row_index, card.column_index),
        )
        if self.cards != expected_order:
            raise ValueError("cards must use deterministic row-major ordering")
        if [card.card_index for card in self.cards] != list(range(1, len(self.cards) + 1)):
            raise ValueError("card_index must be contiguous from one")
        return self


class PageSegmentationFailure(StrictModel):
    physical_page_number: int = Field(ge=1)
    error_code: str
    message: str
    retryable: bool


class SegmentationBatchResult(StrictModel):
    results: list[PageSegmentationResult]
    failures: list[PageSegmentationFailure]
