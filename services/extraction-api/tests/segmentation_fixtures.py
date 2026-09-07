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
) -> RenderedPage:
    document = pymupdf.open()
    page = document.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
    page.insert_text((60, 70), "Synthetic electoral layout fixture", fontsize=16)

    column_width = (GRID_RIGHT - GRID_LEFT) / columns
    column_boundaries = [round(GRID_LEFT + column_width * index) for index in range(columns + 1)]
    row_boundaries = [GRID_TOP + ROW_HEIGHT * index for index in range(rows + 1)]

    for y in row_boundaries:
        page.draw_line((GRID_LEFT, y), (GRID_RIGHT, y), color=(0, 0, 0), width=2)
    for x in column_boundaries:
        page.draw_line((x, GRID_TOP), (x, row_boundaries[-1]), color=(0, 0, 0), width=2)

    position = 0
    for row in range(rows):
        for column in range(columns):
            position += 1
            if position > populated_cards:
                continue
            x = column_boundaries[column] + 14
            y = row_boundaries[row] + 24
            page.insert_text((x, y), f"CARD {position}", fontsize=10)
            page.insert_text((x, y + 22), "FIELD ALPHA", fontsize=10)
            page.insert_text((x, y + 44), "FIELD BETA", fontsize=10)

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
