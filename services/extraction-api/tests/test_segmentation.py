from __future__ import annotations

import pytest

from app.core.exceptions import InvalidCardGeometryError, UnsupportedPageLayoutError
from app.models.segmentation import LayoutType
from app.vision.debug import render_segmentation_overlay
from app.vision.segmentation import (
    _consistent_boundary_sequence,
    segment_page,
    segment_pages,
    validate_grid_geometry,
)
from tests.segmentation_fixtures import (
    PAGE_HEIGHT,
    PAGE_WIDTH,
    synthetic_non_voter_page,
    synthetic_voter_page,
)


def test_normal_three_by_ten_layout_returns_30_ordered_cards() -> None:
    result = segment_page(synthetic_voter_page())

    assert result.layout_type == LayoutType.THREE_COLUMN
    assert result.candidate_count == 30
    assert result.validated_card_count == 30
    assert [card.card_index for card in result.cards] == list(range(1, 31))


def test_card_order_is_row_major() -> None:
    result = segment_page(synthetic_voter_page())

    assert [(card.row_index, card.column_index) for card in result.cards[:6]] == [
        (1, 1),
        (1, 2),
        (1, 3),
        (2, 1),
        (2, 2),
        (2, 3),
    ]


def test_every_bbox_has_positive_in_bounds_geometry_without_overlap() -> None:
    result = segment_page(synthetic_voter_page())

    for card in result.cards:
        assert 0 <= card.bbox.x1 < card.bbox.x2 <= PAGE_WIDTH
        assert 0 <= card.bbox.y1 < card.bbox.y2 <= PAGE_HEIGHT
    for left, right in zip(result.cards, result.cards[1:]):
        if left.row_index == right.row_index:
            assert left.bbox.x2 <= right.bbox.x1


def test_partial_final_row_omits_empty_candidates() -> None:
    result = segment_page(synthetic_voter_page(populated_cards=26))

    assert result.layout_type == LayoutType.THREE_COLUMN_PARTIAL
    assert result.candidate_count == 30
    assert result.validated_card_count == 26
    assert [(card.row_index, card.column_index) for card in result.cards[-2:]] == [
        (9, 1),
        (9, 2),
    ]
    assert result.warnings


def test_page_with_fewer_rows_returns_only_present_cards() -> None:
    result = segment_page(synthetic_voter_page(rows=4, populated_cards=12))

    assert result.candidate_count == 12
    assert result.validated_card_count == 12
    assert result.cards[-1].row_index == 4


def test_empty_non_voter_page_returns_zero_cards() -> None:
    result = segment_page(synthetic_non_voter_page())

    assert result.layout_type == LayoutType.NON_VOTER
    assert result.candidate_count == 0
    assert result.validated_card_count == 0
    assert result.cards == []


def test_malformed_geometry_fails_safely() -> None:
    with pytest.raises(InvalidCardGeometryError):
        validate_grid_geometry(
            page_width=PAGE_WIDTH,
            page_height=PAGE_HEIGHT,
            row_boundaries=[180, 180],
            column_boundaries=[60, 320, 580, 840],
        )


def test_unsupported_two_column_layout_fails_safely() -> None:
    with pytest.raises(UnsupportedPageLayoutError):
        segment_page(synthetic_voter_page(columns=2, populated_cards=20))


def test_segmentation_is_deterministic() -> None:
    page = synthetic_voter_page(populated_cards=26)

    assert segment_page(page).model_dump() == segment_page(page).model_dump()


def test_periodic_outer_boundaries_ignore_repeating_internal_card_lines() -> None:
    outer = list(range(100, 1101, 100))
    internal = [value + 20 for value in outer[:-1]]

    selected = _consistent_boundary_sequence(sorted([*outer, *internal]), 1300)

    assert selected == outer


def test_page_failure_is_isolated_from_other_pages() -> None:
    batch = segment_pages(
        [
            synthetic_voter_page(physical_page=1),
            synthetic_voter_page(physical_page=2, columns=2, populated_cards=20),
            synthetic_non_voter_page(physical_page=3),
        ]
    )

    assert [result.physical_page_number for result in batch.results] == [1, 3]
    assert len(batch.failures) == 1
    assert batch.failures[0].physical_page_number == 2
    assert batch.failures[0].error_code == "unsupported_page_layout"


def test_debug_overlay_is_an_in_memory_png() -> None:
    page = synthetic_voter_page(rows=1, populated_cards=3)
    result = segment_page(page)

    overlay = render_segmentation_overlay(page, result)

    assert overlay.startswith(b"\x89PNG\r\n\x1a\n")
    assert len(overlay) > len(page.png_bytes)

