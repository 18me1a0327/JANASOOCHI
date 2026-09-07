from __future__ import annotations

import pymupdf

from app.models.documents import RenderedPage
from app.models.segmentation import PageSegmentationResult


def render_segmentation_overlay(
    page: RenderedPage,
    result: PageSegmentationResult,
) -> bytes:
    """Return an in-memory PNG overlay for local development and tests only."""

    document = pymupdf.open()
    try:
        overlay_page = document.new_page(width=page.width_px, height=page.height_px)
        overlay_page.insert_image(overlay_page.rect, stream=page.png_bytes)
        for card in result.cards:
            rect = pymupdf.Rect(
                card.bbox.x1,
                card.bbox.y1,
                card.bbox.x2,
                card.bbox.y2,
            )
            overlay_page.draw_rect(rect, color=(1, 0, 0), width=2, overlay=True)
            overlay_page.insert_text(
                (card.bbox.x1 + 5, card.bbox.y1 + 16),
                str(card.card_index),
                fontsize=12,
                color=(1, 0, 0),
                overlay=True,
            )
        return overlay_page.get_pixmap(dpi=72, alpha=False).tobytes("png")
    finally:
        document.close()
