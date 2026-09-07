from __future__ import annotations

from typing import Protocol

from app.models.common import SourceLanguage
from app.models.field_regions import FieldRegion
from app.models.ocr import OcrEngine, OcrFieldResult


class OcrAdapter(Protocol):
    engine: OcrEngine
    engine_version: str

    def recognize(
        self,
        field: FieldRegion,
        source_language: SourceLanguage,
        processing_version: str,
    ) -> OcrFieldResult: ...
