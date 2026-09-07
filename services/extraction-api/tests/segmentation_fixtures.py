from __future__ import annotations

import pymupdf

from app.models.documents import RenderedPage


PAGE_WIDTH = 900
PAGE_HEIGHT = 1300
GRID_LEFT = 60
GRID_RIGHT = 840
GRID_TOP = 180
ROW_HEIGHT = 100


def synthetic_voter_page(
    *,
    physical_page: int = 1,
    rows: int = 10,
    columns: int = 3,
    populated_cards: int = 30,
    scale: int = 1,
) -> RenderedPage:
    document = pymupdf.open()
    page = document.new_page(width=PAGE_WIDTH * scale, height=PAGE_HEIGHT * scale)
    page.insert_text(
        (60 * scale, 70 * scale),
        "Synthetic electoral layout fixture",
        fontsize=16 * scale,
    )

    grid_left = GRID_LEFT * scale
    grid_right = GRID_RIGHT * scale
    grid_top = GRID_TOP * scale
    row_height = ROW_HEIGHT * scale
    column_width = (grid_right - grid_left) / columns
    column_boundaries = [
        round(grid_left + column_width * index) for index in range(columns + 1)
    ]
    row_boundaries = [grid_top + row_height * index for index in range(rows + 1)]

    for y in row_boundaries:
        page.draw_line((grid_left, y), (grid_right, y), color=(0, 0, 0), width=2 * scale)
    for x in column_boundaries:
        page.draw_line((x, grid_top), (x, row_boundaries[-1]), color=(0, 0, 0), width=2 * scale)

    position = 0
    for row in range(rows):
        for column in range(columns):
            position += 1
            if position > populated_cards:
                continue
            x = column_boundaries[column] + 14 * scale
            y = row_boundaries[row] + 24 * scale
            page.insert_text((x, y), f"CARD {position}", fontsize=10 * scale)
            page.insert_text((x, y + 22 * scale), "FIELD ALPHA", fontsize=10 * scale)
            page.insert_text((x, y + 44 * scale), "FIELD BETA", fontsize=10 * scale)

    pixmap = page.get_pixmap(dpi=72, alpha=False)
    result = RenderedPage(
        physical_page=physical_page,
        width_px=pixmap.width,
        height_px=pixmap.height,
        dpi=72,
        png_bytes=pixmap.tobytes("png"),
    )
    document.close()
    return result


def synthetic_non_voter_page(*, physical_page: int = 1) -> RenderedPage:
    document = pymupdf.open()
    page = document.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
    page.insert_text((60, 70), "Synthetic metadata page", fontsize=16)
    page.insert_text((60, 110), "No voter grid is present.", fontsize=12)
    pixmap = page.get_pixmap(dpi=72, alpha=False)
    result = RenderedPage(
        physical_page=physical_page,
        width_px=pixmap.width,
        height_px=pixmap.height,
        dpi=72,
        png_bytes=pixmap.tobytes("png"),
    )
    document.close()
    return result
