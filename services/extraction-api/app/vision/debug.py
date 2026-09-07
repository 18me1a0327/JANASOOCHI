from __future__ import annotations

import pymupdf

from app.models.documents import RenderedPage
from app.models.field_regions import CardFieldRegions
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


def render_field_region_overlay(page: RenderedPage, card: CardFieldRegions) -> bytes:
    """Return an in-memory development PNG with one card's field boxes."""

    document = pymupdf.open()
    try:
        overlay_page = document.new_page(width=page.width_px, height=page.height_px)
        overlay_page.insert_image(overlay_page.rect, stream=page.png_bytes)
        parent = pymupdf.Rect(
            card.card_bbox.x1,
            card.card_bbox.y1,
            card.card_bbox.x2,
            card.card_bbox.y2,
        )
        overlay_page.draw_rect(parent, color=(0, 0, 1), width=2, overlay=True)
        for index, field in enumerate(card.fields, start=1):
            rect = pymupdf.Rect(
                field.page_bbox.x1,
                field.page_bbox.y1,
                field.page_bbox.x2,
                field.page_bbox.y2,
            )
            overlay_page.draw_rect(rect, color=(1, 0, 0), width=1, overlay=True)
            overlay_page.insert_text(
                (field.page_bbox.x1 + 2, field.page_bbox.y1 + 9),
                f"{index}:{field.field_type.value}",
                fontsize=6,
                color=(1, 0, 0),
                overlay=True,
            )
        return overlay_page.get_pixmap(dpi=72, alpha=False).tobytes("png")
    finally:
        document.close()
