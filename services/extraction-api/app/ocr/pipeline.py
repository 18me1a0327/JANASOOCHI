from __future__ import annotations

from app.core.exceptions import ExtractionError
from app.models.field_regions import CardFieldRegions
from app.models.ocr import CardOcrResult, OcrFieldFailure, OcrFieldResult
from app.ocr.base import OcrAdapter


def recognize_card_fields(
    card: CardFieldRegions,
    adapter: OcrAdapter,
    processing_version: str,
) -> CardOcrResult:
    """Recognize card fields independently without retrying or changing raw output."""

    fields: list[OcrFieldResult] = []
    failures: list[OcrFieldFailure] = []
    for field in card.fields:
        try:
            fields.append(
                adapter.recognize(field, card.source_language, processing_version)
            )
        except ExtractionError as exc:
            failures.append(
                OcrFieldFailure(
                    field_type=field.field_type,
                    error_code=exc.code,
                    message=exc.message,
                    retryable=exc.retryable,
                )
            )
    return CardOcrResult(
        physical_page_number=card.physical_page_number,
        card_index=card.card_index,
        source_language=card.source_language,
        fields=fields,
        failures=failures,
    )
