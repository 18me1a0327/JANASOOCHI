from __future__ import annotations

from hashlib import sha256

import pymupdf
import pytest

from app.core.exceptions import (
    InvalidFieldRegionGeometryError,
    PageContractMismatchError,
    UnsupportedCardTemplateError,
)
from app.models.common import SourceLanguage
from app.models.field_regions import FieldType
from app.models.segmentation import (
    BoundingBox,
    CardRegion,
    LayoutType,
    PageSegmentationResult,
)
from app.vision.debug import render_field_region_overlay
from app.vision.field_regions import (
    extract_card_field_regions,
    extract_page_field_regions,
)
from app.vision.segmentation import segment_page
from tests.segmentation_fixtures import synthetic_non_voter_page, synthetic_voter_page


@pytest.fixture(scope="module")
def one_row_page() -> tuple:
    page = synthetic_voter_page(rows=1, populated_cards=3)
    return page, segment_page(page)


def test_normal_english_card_has_all_target_field_regions(one_row_page: tuple) -> None:
    page, segmentation = one_row_page
    result = extract_card_field_regions(page, segmentation.cards[0], SourceLanguage.ENGLISH)

    assert result.template_id == "eci-fixed-card-en-v1"
    assert [field.field_type for field in result.fields] == list(FieldType)
    assert len(result.fields) == 8


def test_normal_telugu_card_uses_explicit_telugu_template(one_row_page: tuple) -> None:
    page, segmentation = one_row_page
    result = extract_card_field_regions(page, segmentation.cards[0], SourceLanguage.TELUGU)

    assert result.template_id == "eci-fixed-card-te-v1"
    assert result.source_language == SourceLanguage.TELUGU
    assert [field.relative_bbox for field in result.fields]


def test_relative_templates_scale_to_rendered_page_pixels() -> None:
    small_page = synthetic_voter_page(rows=1, populated_cards=1)
    large_page = synthetic_voter_page(rows=1, populated_cards=1, scale=2)
    small_card = CardRegion(
        card_index=1,
        row_index=1,
        column_index=1,
        bbox=BoundingBox(x1=60, y1=180, x2=320, y2=280),
    )
    large_card = CardRegion(
        card_index=1,
        row_index=1,
        column_index=1,
        bbox=BoundingBox(x1=120, y1=360, x2=640, y2=560),
    )

    small = extract_card_field_regions(small_page, small_card, SourceLanguage.ENGLISH)
    large = extract_card_field_regions(large_page, large_card, SourceLanguage.ENGLISH)

    for small_field, large_field in zip(small.fields, large.fields):
        assert large_field.relative_bbox == small_field.relative_bbox
        for coordinate, small_value in small_field.page_bbox.model_dump().items():
            large_value = large_field.page_bbox.model_dump()[coordinate]
            assert abs(large_value - small_value * 2) <= 1


def test_crop_png_dimensions_match_field_bbox(one_row_page: tuple) -> None:
    page, segmentation = one_row_page
    result = extract_card_field_regions(page, segmentation.cards[0], SourceLanguage.ENGLISH)

    for field in result.fields:
        pixmap = pymupdf.Pixmap(field.crop_png_bytes)
        assert (pixmap.width, pixmap.height) == (field.crop_width, field.crop_height)
        assert field.crop_width == field.page_bbox.width
        assert field.crop_height == field.page_bbox.height


def test_field_bboxes_remain_inside_parent_card(one_row_page: tuple) -> None:
    page, segmentation = one_row_page
    result = extract_card_field_regions(page, segmentation.cards[0], SourceLanguage.ENGLISH)

    for field in result.fields:
        assert result.card_bbox.x1 <= field.page_bbox.x1 < field.page_bbox.x2 <= result.card_bbox.x2
        assert result.card_bbox.y1 <= field.page_bbox.y1 < field.page_bbox.y2 <= result.card_bbox.y2


def test_invalid_parent_card_geometry_fails_safely(one_row_page: tuple) -> None:
    page, _ = one_row_page
    outside_card = CardRegion(
        card_index=1,
        row_index=1,
        column_index=1,
        bbox=BoundingBox(x1=850, y1=1200, x2=950, y2=1290),
    )

    with pytest.raises(InvalidFieldRegionGeometryError):
        extract_card_field_regions(page, outside_card, SourceLanguage.ENGLISH)


def test_urdu_has_no_phase_2c_template(one_row_page: tuple) -> None:
    page, segmentation = one_row_page

    with pytest.raises(UnsupportedCardTemplateError):
        extract_card_field_regions(page, segmentation.cards[0], SourceLanguage.URDU)


def test_field_region_extraction_is_repeatable(one_row_page: tuple) -> None:
    page, segmentation = one_row_page

    first = extract_card_field_regions(page, segmentation.cards[0], SourceLanguage.TELUGU)
    second = extract_card_field_regions(page, segmentation.cards[0], SourceLanguage.TELUGU)

    assert first.model_dump() == second.model_dump()


def test_one_invalid_card_is_isolated(one_row_page: tuple) -> None:
    page, segmentation = one_row_page
    good = segmentation.cards[0].model_copy(update={"card_index": 1})
    too_small = CardRegion(
        card_index=2,
        row_index=2,
        column_index=1,
        bbox=BoundingBox(x1=60, y1=300, x2=61, y2=301),
    )
    mixed = PageSegmentationResult(
        physical_page_number=page.physical_page,
        page_width=page.width_px,
        page_height=page.height_px,
        layout_type=LayoutType.THREE_COLUMN_PARTIAL,
        candidate_count=2,
        validated_card_count=2,
        cards=[good, too_small],
    )

    result = extract_page_field_regions(page, mixed, SourceLanguage.ENGLISH)

    assert result.processed_card_count == 1
    assert result.cards[0].card_index == 1
    assert len(result.failures) == 1
    assert result.failures[0].card_index == 2
    assert result.failures[0].error_code == "invalid_field_region_geometry"


def test_page_contract_mismatch_fails_before_cropping(one_row_page: tuple) -> None:
    page, segmentation = one_row_page
    mismatched = segmentation.model_copy(update={"physical_page_number": 2})

    with pytest.raises(PageContractMismatchError):
        extract_page_field_regions(page, mismatched, SourceLanguage.ENGLISH)


def test_non_voter_page_produces_no_field_crops() -> None:
    page = synthetic_non_voter_page()
    segmentation = segment_page(page)

    result = extract_page_field_regions(page, segmentation, SourceLanguage.ENGLISH)

    assert result.source_card_count == 0
    assert result.processed_card_count == 0
    assert result.cards == []
    assert result.failures == []


def test_helpers_do_not_modify_source_and_overlay_stays_in_memory(one_row_page: tuple) -> None:
    page, segmentation = one_row_page
    before = sha256(page.png_bytes).hexdigest()
    result = extract_card_field_regions(page, segmentation.cards[0], SourceLanguage.ENGLISH)

    overlay = render_field_region_overlay(page, result)

    assert sha256(page.png_bytes).hexdigest() == before
    assert overlay.startswith(b"\x89PNG\r\n\x1a\n")
