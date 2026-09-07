from __future__ import annotations

from dataclasses import dataclass
from math import ceil, floor

import pymupdf

from app.core.exceptions import (
    ExtractionError,
    FieldRegionExtractionError,
    InvalidFieldRegionGeometryError,
    PageContractMismatchError,
    UnsupportedCardTemplateError,
)
from app.models.common import SourceLanguage
from app.models.documents import RenderedPage
from app.models.field_regions import (
    CardFieldRegionFailure,
    CardFieldRegions,
    FieldRegion,
    FieldType,
    PageFieldRegionResult,
    RelativeBoundingBox,
)
from app.models.segmentation import BoundingBox, CardRegion, PageSegmentationResult


FIELD_TEMPLATE_VERSION = "1.0.0"


@dataclass(frozen=True)
class _FieldTemplate:
    template_id: str
    regions: tuple[tuple[FieldType, RelativeBoundingBox], ...]


_COMMON_REGIONS = (
    (FieldType.SERIAL_NUMBER, RelativeBoundingBox(x1=0.02, y1=0.02, x2=0.36, y2=0.20)),
    (FieldType.EPIC, RelativeBoundingBox(x1=0.48, y1=0.02, x2=0.98, y2=0.20)),
    (FieldType.VOTER_NAME, RelativeBoundingBox(x1=0.02, y1=0.18, x2=0.72, y2=0.39)),
    (FieldType.RELATION_NAME, RelativeBoundingBox(x1=0.22, y1=0.37, x2=0.72, y2=0.58)),
    (FieldType.RELATION_TYPE, RelativeBoundingBox(x1=0.02, y1=0.37, x2=0.26, y2=0.58)),
    (FieldType.HOUSE_NUMBER, RelativeBoundingBox(x1=0.02, y1=0.56, x2=0.37, y2=0.80)),
    (FieldType.AGE, RelativeBoundingBox(x1=0.35, y1=0.56, x2=0.52, y2=0.80)),
    (FieldType.GENDER, RelativeBoundingBox(x1=0.50, y1=0.56, x2=0.72, y2=0.80)),
)


_TEMPLATES = {
    SourceLanguage.ENGLISH: _FieldTemplate(
        template_id="eci-fixed-card-en-v1",
        regions=_COMMON_REGIONS,
    ),
    SourceLanguage.TELUGU: _FieldTemplate(
        template_id="eci-fixed-card-te-v1",
        regions=_COMMON_REGIONS,
    ),
}


class _SourceImage:
    def __init__(self, page: RenderedPage) -> None:
        try:
            self.pixmap = pymupdf.Pixmap(page.png_bytes)
        except Exception as exc:
            raise FieldRegionExtractionError(
                "Unable to read the rendered page image.",
                physical_page_number=page.physical_page,
            ) from exc
        if self.pixmap.width != page.width_px or self.pixmap.height != page.height_px:
            raise PageContractMismatchError(
                expected_width=page.width_px,
                expected_height=page.height_px,
                image_width=self.pixmap.width,
                image_height=self.pixmap.height,
            )
        if self.pixmap.colorspace is None:
            raise FieldRegionExtractionError("The rendered page has no usable color space.")

    def crop_png(self, bbox: BoundingBox) -> bytes:
        width = bbox.width
        height = bbox.height
        components = self.pixmap.n
        source_samples = memoryview(self.pixmap.samples)
        crop_samples = bytearray(width * height * components)
        target_offset = 0
        row_length = width * components
        for y in range(bbox.y1, bbox.y2):
            source_offset = y * self.pixmap.stride + bbox.x1 * components
            crop_samples[target_offset : target_offset + row_length] = source_samples[
                source_offset : source_offset + row_length
            ]
            target_offset += row_length
        crop = pymupdf.Pixmap(
            self.pixmap.colorspace,
            width,
            height,
            bytes(crop_samples),
            self.pixmap.alpha,
        )
        return crop.tobytes("png")


def _template_for(source_language: SourceLanguage) -> _FieldTemplate:
    template = _TEMPLATES.get(source_language)
    if template is None:
        raise UnsupportedCardTemplateError(
            source_language=source_language.value,
            supported_languages=[language.value for language in _TEMPLATES],
        )
    return template


def _validate_card(page: RenderedPage, card: CardRegion) -> None:
    bbox = card.bbox
    if not (
        0 <= bbox.x1 < bbox.x2 <= page.width_px
        and 0 <= bbox.y1 < bbox.y2 <= page.height_px
    ):
        raise InvalidFieldRegionGeometryError(
            "The parent card falls outside the rendered page.",
            card_index=card.card_index,
        )


def _page_bbox(card_bbox: BoundingBox, relative_bbox: RelativeBoundingBox) -> BoundingBox:
    x1 = card_bbox.x1 + floor(card_bbox.width * relative_bbox.x1)
    y1 = card_bbox.y1 + floor(card_bbox.height * relative_bbox.y1)
    x2 = card_bbox.x1 + ceil(card_bbox.width * relative_bbox.x2)
    y2 = card_bbox.y1 + ceil(card_bbox.height * relative_bbox.y2)
    if x2 - x1 < 2 or y2 - y1 < 2:
        raise InvalidFieldRegionGeometryError(
            "A derived field crop is too small for deterministic extraction.",
            field_bbox={"x1": x1, "y1": y1, "x2": x2, "y2": y2},
        )
    if not (
        card_bbox.x1 <= x1 < x2 <= card_bbox.x2
        and card_bbox.y1 <= y1 < y2 <= card_bbox.y2
    ):
        raise InvalidFieldRegionGeometryError(
            "A derived field crop falls outside its parent card."
        )
    return BoundingBox(x1=x1, y1=y1, x2=x2, y2=y2)


def _extract_card(
    page: RenderedPage,
    image: _SourceImage,
    card: CardRegion,
    source_language: SourceLanguage,
) -> CardFieldRegions:
    _validate_card(page, card)
    template = _template_for(source_language)
    fields: list[FieldRegion] = []
    for field_type, relative_bbox in template.regions:
        bbox = _page_bbox(card.bbox, relative_bbox)
        fields.append(
            FieldRegion(
                field_type=field_type,
                relative_bbox=relative_bbox,
                page_bbox=bbox,
                crop_width=bbox.width,
                crop_height=bbox.height,
                crop_png_bytes=image.crop_png(bbox),
            )
        )
    return CardFieldRegions(
        physical_page_number=page.physical_page,
        card_index=card.card_index,
        row_index=card.row_index,
        column_index=card.column_index,
        source_language=source_language,
        template_id=template.template_id,
        template_version=FIELD_TEMPLATE_VERSION,
        card_bbox=card.bbox,
        fields=fields,
    )


def extract_card_field_regions(
    page: RenderedPage,
    card: CardRegion,
    source_language: SourceLanguage,
) -> CardFieldRegions:
    """Return deterministic in-memory field crops for one validated card."""

    image = _SourceImage(page)
    return _extract_card(page, image, card, source_language)


def extract_page_field_regions(
    page: RenderedPage,
    segmentation: PageSegmentationResult,
    source_language: SourceLanguage,
) -> PageFieldRegionResult:
    """Extract every card independently and retain typed per-card failures."""

    if (
        segmentation.physical_page_number != page.physical_page
        or segmentation.page_width != page.width_px
        or segmentation.page_height != page.height_px
    ):
        raise PageContractMismatchError(
            physical_page_number=page.physical_page,
            segmentation_page_number=segmentation.physical_page_number,
        )
    _template_for(source_language)
    image = _SourceImage(page)
    cards: list[CardFieldRegions] = []
    failures: list[CardFieldRegionFailure] = []
    for card in segmentation.cards:
        try:
            cards.append(_extract_card(page, image, card, source_language))
        except ExtractionError as exc:
            failures.append(
                CardFieldRegionFailure(
                    physical_page_number=page.physical_page,
                    card_index=card.card_index,
                    error_code=exc.code,
                    message=exc.message,
                    retryable=exc.retryable,
                )
            )
    return PageFieldRegionResult(
        physical_page_number=page.physical_page,
        source_language=source_language,
        source_card_count=len(segmentation.cards),
        processed_card_count=len(cards),
        cards=cards,
        failures=failures,
    )
