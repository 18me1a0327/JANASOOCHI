from __future__ import annotations

from itertools import combinations
from statistics import median

import pymupdf

from app.core.exceptions import (
    CardSegmentationError,
    ExtractionError,
    InvalidCardGeometryError,
    UnsupportedPageLayoutError,
)
from app.models.documents import RenderedPage
from app.models.segmentation import (
    BoundingBox,
    CardRegion,
    LayoutType,
    PageSegmentationFailure,
    PageSegmentationResult,
    SegmentationBatchResult,
)


_DARK_PIXEL_THRESHOLD = 210
_MAX_ROWS = 10
_EXPECTED_COLUMNS = 3


class _GrayImage:
    """Small read-only view over a derived grayscale Pixmap."""

    def __init__(self, pixmap: pymupdf.Pixmap) -> None:
        self.width = pixmap.width
        self.height = pixmap.height
        self.stride = pixmap.stride
        self.samples = memoryview(pixmap.samples)

    def dark(self, x: int, y: int) -> bool:
        return self.samples[y * self.stride + x] < _DARK_PIXEL_THRESHOLD


def _load_grayscale(page: RenderedPage) -> _GrayImage:
    try:
        source = pymupdf.Pixmap(page.png_bytes)
        grayscale = pymupdf.Pixmap(pymupdf.csGRAY, source)
    except Exception as exc:  # PyMuPDF raises several input-specific exception types.
        raise CardSegmentationError(
            "Unable to read the rendered page image.",
            physical_page_number=page.physical_page,
        ) from exc

    if grayscale.width != page.width_px or grayscale.height != page.height_px:
        raise InvalidCardGeometryError(
            "Rendered-page dimensions do not match the image payload.",
            expected_width=page.width_px,
            expected_height=page.height_px,
            image_width=grayscale.width,
            image_height=grayscale.height,
        )
    return _GrayImage(grayscale)


def _group_adjacent(values: list[int], *, maximum_gap: int = 2) -> list[int]:
    if not values:
        return []
    groups: list[list[int]] = [[values[0]]]
    for value in values[1:]:
        if value - groups[-1][-1] <= maximum_gap:
            groups[-1].append(value)
        else:
            groups.append([value])
    return [round(sum(group) / len(group)) for group in groups]


def _longest_dark_run(image: _GrayImage, y: int, x1: int, x2: int) -> int:
    longest = 0
    current = 0
    for x in range(x1, x2):
        if image.dark(x, y):
            current += 1
            longest = max(longest, current)
        else:
            current = 0
    return longest


def _horizontal_line_centres(image: _GrayImage) -> list[int]:
    x_margin = max(1, round(image.width * 0.03))
    y_start = max(1, round(image.height * 0.01))
    y_end = min(image.height - 1, round(image.height * 0.98))
    minimum_run = max(20, round(image.width * 0.18))
    rows = [
        y
        for y in range(y_start, y_end)
        if _longest_dark_run(image, y, x_margin, image.width - x_margin) >= minimum_run
    ]
    return _group_adjacent(rows, maximum_gap=2)


def _consistent_boundary_sequence(lines: list[int], page_height: int) -> list[int]:
    """Return the longest periodic boundary subset, ignoring internal card lines."""

    best: list[int] = []
    minimum_gap = max(12, round(page_height * 0.035))
    maximum_gap = round(page_height * 0.16)
    for start_index, start in enumerate(lines):
        for second_index in range(start_index + 1, len(lines)):
            gap = lines[second_index] - start
            if not minimum_gap <= gap <= maximum_gap:
                continue
            tolerance = max(4, gap * 0.12)
            sequence = [start, lines[second_index]]
            cursor = second_index + 1
            while len(sequence) < _MAX_ROWS + 1:
                target = sequence[-1] + gap
                eligible = [
                    (abs(lines[index] - target), index)
                    for index in range(cursor, len(lines))
                    if abs(lines[index] - target) <= tolerance
                ]
                if not eligible:
                    break
                _, selected_index = min(eligible)
                sequence.append(lines[selected_index])
                cursor = selected_index + 1

            gaps = [right - left for left, right in zip(sequence, sequence[1:])]
            typical_gap = median(gaps)
            if max(abs(candidate - typical_gap) for candidate in gaps) > tolerance:
                continue
            if len(sequence) > len(best) or (
                len(sequence) == len(best) and sequence and sequence[0] < best[0]
            ):
                best = sequence
    return best


def _vertical_line_centres(image: _GrayImage, top: int, bottom: int) -> list[int]:
    height = bottom - top
    if height <= 0:
        return []
    minimum_dark_pixels = max(4, round(height * 0.55))
    x_start = max(1, round(image.width * 0.02))
    x_end = min(image.width - 1, round(image.width * 0.98))
    columns: list[int] = []
    for x in range(x_start, x_end):
        dark_pixels = sum(1 for y in range(top, bottom) if image.dark(x, y))
        if dark_pixels >= minimum_dark_pixels:
            columns.append(x)
    return _group_adjacent(columns, maximum_gap=2)


def _select_three_column_boundaries(lines: list[int], page_width: int) -> list[int]:
    best: tuple[float, list[int]] | None = None
    for selected in combinations(lines, 4):
        widths = [b - a for a, b in zip(selected, selected[1:])]
        typical_width = median(widths)
        if typical_width < page_width * 0.15 or typical_width > page_width * 0.40:
            continue
        deviation = max(abs(width - typical_width) for width in widths) / typical_width
        if deviation > 0.20:
            continue
        span = selected[-1] - selected[0]
        score = span / page_width - deviation
        if best is None or score > best[0]:
            best = (score, list(selected))
    return [] if best is None else best[1]


def validate_grid_geometry(
    *,
    page_width: int,
    page_height: int,
    row_boundaries: list[int],
    column_boundaries: list[int],
) -> None:
    """Validate a detected three-column, up-to-ten-row grid."""

    if len(column_boundaries) != _EXPECTED_COLUMNS + 1:
        raise InvalidCardGeometryError("A valid grid requires four column boundaries.")
    if not 2 <= len(row_boundaries) <= _MAX_ROWS + 1:
        raise InvalidCardGeometryError("A valid grid requires one to ten row intervals.")
    if column_boundaries != sorted(set(column_boundaries)):
        raise InvalidCardGeometryError("Column boundaries must be unique and ordered.")
    if row_boundaries != sorted(set(row_boundaries)):
        raise InvalidCardGeometryError("Row boundaries must be unique and ordered.")
    if column_boundaries[0] < 0 or column_boundaries[-1] > page_width:
        raise InvalidCardGeometryError("Column boundaries fall outside the page.")
    if row_boundaries[0] < 0 or row_boundaries[-1] > page_height:
        raise InvalidCardGeometryError("Row boundaries fall outside the page.")

    widths = [b - a for a, b in zip(column_boundaries, column_boundaries[1:])]
    heights = [b - a for a, b in zip(row_boundaries, row_boundaries[1:])]
    if min(widths, default=0) <= 0 or min(heights, default=0) <= 0:
        raise InvalidCardGeometryError("Card regions must have positive dimensions.")
    if max(widths) / min(widths) > 1.25 or max(heights) / min(heights) > 1.25:
        raise InvalidCardGeometryError("Card dimensions are not sufficiently consistent.")


def _content_present(image: _GrayImage, bbox: BoundingBox) -> bool:
    x_padding = max(3, round(bbox.width * 0.035))
    y_padding = max(3, round(bbox.height * 0.08))
    x1, x2 = bbox.x1 + x_padding, bbox.x2 - x_padding
    y1, y2 = bbox.y1 + y_padding, bbox.y2 - y_padding
    if x2 <= x1 or y2 <= y1:
        return False

    area = (x2 - x1) * (y2 - y1)
    dark_count = 0
    ink_rows: list[int] = []
    row_minimum = max(3, round((x2 - x1) * 0.025))
    for y in range(y1, y2):
        row_dark = sum(1 for x in range(x1, x2) if image.dark(x, y))
        dark_count += row_dark
        if row_dark >= row_minimum:
            ink_rows.append(y)
    ink_bands = _group_adjacent(ink_rows, maximum_gap=2)
    return dark_count / area >= 0.0015 and len(ink_bands) >= 2


def _non_voter_result(page: RenderedPage, warning: str) -> PageSegmentationResult:
    return PageSegmentationResult(
        physical_page_number=page.physical_page,
        page_width=page.width_px,
        page_height=page.height_px,
        layout_type=LayoutType.NON_VOTER,
        candidate_count=0,
        validated_card_count=0,
        cards=[],
        warnings=[warning],
    )


def segment_page(page: RenderedPage) -> PageSegmentationResult:
    """Segment one rendered page without reading or inferring voter fields."""

    image = _load_grayscale(page)
    horizontal_lines = _horizontal_line_centres(image)
    row_boundaries = _consistent_boundary_sequence(horizontal_lines, image.height)
    if len(row_boundaries) < 2:
        return _non_voter_result(page, "No supported voter-card grid was detected.")
    if len(row_boundaries) > _MAX_ROWS + 1:
        raise UnsupportedPageLayoutError(
            "The detected voter grid contains more than ten rows.",
            detected_rows=len(row_boundaries) - 1,
        )

    vertical_lines = _vertical_line_centres(image, row_boundaries[0], row_boundaries[-1])
    column_boundaries = _select_three_column_boundaries(vertical_lines, image.width)
    if not column_boundaries:
        if len(vertical_lines) >= 3:
            raise UnsupportedPageLayoutError(
                detected_vertical_boundaries=len(vertical_lines),
                expected_columns=_EXPECTED_COLUMNS,
            )
        return _non_voter_result(page, "No supported three-column voter grid was detected.")

    validate_grid_geometry(
        page_width=image.width,
        page_height=image.height,
        row_boundaries=row_boundaries,
        column_boundaries=column_boundaries,
    )

    candidates: list[tuple[int, int, BoundingBox]] = []
    for row_index, (y1, y2) in enumerate(zip(row_boundaries, row_boundaries[1:]), start=1):
        for column_index, (x1, x2) in enumerate(
            zip(column_boundaries, column_boundaries[1:]),
            start=1,
        ):
            candidates.append(
                (row_index, column_index, BoundingBox(x1=x1, y1=y1, x2=x2, y2=y2))
            )

    cards: list[CardRegion] = []
    for row_index, column_index, bbox in candidates:
        if not _content_present(image, bbox):
            continue
        cards.append(
            CardRegion(
                card_index=len(cards) + 1,
                row_index=row_index,
                column_index=column_index,
                bbox=bbox,
                validation_flags=["geometry_valid", "content_present"],
            )
        )

    warnings: list[str] = []
    empty_count = len(candidates) - len(cards)
    if empty_count:
        warnings.append(
            f"{empty_count} candidate region(s) did not contain plausible voter-card content."
        )
    layout_type = (
        LayoutType.THREE_COLUMN
        if len(cards) == 30
        else LayoutType.THREE_COLUMN_PARTIAL
    )
    return PageSegmentationResult(
        physical_page_number=page.physical_page,
        page_width=image.width,
        page_height=image.height,
        layout_type=layout_type,
        candidate_count=len(candidates),
        validated_card_count=len(cards),
        cards=cards,
        warnings=warnings,
    )


def segment_pages(pages: list[RenderedPage]) -> SegmentationBatchResult:
    """Segment pages independently so one expected failure remains isolated."""

    results: list[PageSegmentationResult] = []
    failures: list[PageSegmentationFailure] = []
    for page in pages:
        try:
            results.append(segment_page(page))
        except ExtractionError as exc:
            failures.append(
                PageSegmentationFailure(
                    physical_page_number=page.physical_page,
                    error_code=exc.code,
                    message=exc.message,
                    retryable=exc.retryable,
                )
            )
    return SegmentationBatchResult(results=results, failures=failures)

