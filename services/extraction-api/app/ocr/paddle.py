from __future__ import annotations

import json
from importlib import metadata
from typing import Protocol

import pymupdf

from app.core.exceptions import (
    EmptyOcrResultError,
    OcrEngineUnavailableError,
    OcrExecutionError,
    OcrOutputParseError,
    UnsupportedOcrLanguageError,
)
from app.models.common import SourceLanguage
from app.models.field_regions import FieldRegion, FieldType
from app.models.ocr import OcrEngine, OcrFieldResult
from app.ocr.normalization import normalize_ocr_value


class PaddleTextRecognitionBackend(Protocol):
    def recognize(self, png_bytes: bytes, model_name: str) -> tuple[str, float | None]: ...


class InstalledPaddleBackend:
    """Lazy PaddleOCR v3 text-line runtime; models are never fetched during import."""

    def __init__(self) -> None:
        self._models: dict[str, object] = {}

    def _model(self, model_name: str) -> object:
        try:
            from paddleocr import TextRecognition
        except ImportError as exc:
            raise OcrEngineUnavailableError(
                "PaddleOCR is not installed in this runtime."
            ) from exc
        if model_name not in self._models:
            try:
                self._models[model_name] = TextRecognition(
                    model_name=model_name,
                    engine="paddle_static",
                    device="cpu",
                )
            except Exception as exc:
                raise OcrEngineUnavailableError(
                    "The requested PaddleOCR recognition model is unavailable.",
                    model_name=model_name,
                ) from exc
        return self._models[model_name]

    def recognize(self, png_bytes: bytes, model_name: str) -> tuple[str, float | None]:
        try:
            import numpy as np
        except ImportError as exc:
            raise OcrEngineUnavailableError("NumPy is required by PaddleOCR.") from exc
        pixmap = pymupdf.Pixmap(png_bytes)
        channels = pixmap.n
        image = np.frombuffer(pixmap.samples, dtype=np.uint8).reshape(
            pixmap.height,
            pixmap.width,
            channels,
        )
        if channels == 4:
            image = image[:, :, :3]
        try:
            predictions = self._model(model_name).predict(input=image, batch_size=1)
            first = next(iter(predictions))
            payload = first.json
            if isinstance(payload, str):
                payload = json.loads(payload)
            result = payload.get("res", payload)
            raw_value = result["rec_text"]
            confidence = result.get("rec_score")
        except (KeyError, TypeError, ValueError, StopIteration, json.JSONDecodeError) as exc:
            raise OcrOutputParseError("PaddleOCR returned an unexpected result contract.") from exc
        except OcrEngineUnavailableError:
            raise
        except Exception as exc:
            raise OcrExecutionError("PaddleOCR could not process this field.") from exc
        if not isinstance(raw_value, str) or not raw_value:
            raise EmptyOcrResultError()
        if confidence is not None:
            confidence = float(confidence)
            if not 0 <= confidence <= 1:
                raise OcrOutputParseError("PaddleOCR confidence is outside zero-to-one.")
        return raw_value, confidence


def _model_name(field_type: FieldType, source_language: SourceLanguage) -> str:
    if source_language not in {SourceLanguage.ENGLISH, SourceLanguage.TELUGU}:
        raise UnsupportedOcrLanguageError(source_language=source_language.value)
    if source_language == SourceLanguage.TELUGU and field_type not in {
        FieldType.SERIAL_NUMBER,
        FieldType.EPIC,
        FieldType.AGE,
    }:
        return "te_PP-OCRv5_mobile_rec"
    return "en_PP-OCRv5_mobile_rec"


class PaddleOcrAdapter:
    engine = OcrEngine.PADDLEOCR

    def __init__(
        self,
        *,
        backend: PaddleTextRecognitionBackend | None = None,
        engine_version: str | None = None,
    ) -> None:
        self.backend = backend or InstalledPaddleBackend()
        self._engine_version = engine_version

    @property
    def engine_version(self) -> str:
        if self._engine_version is None:
            try:
                self._engine_version = metadata.version("paddleocr")
            except metadata.PackageNotFoundError as exc:
                raise OcrEngineUnavailableError(
                    "PaddleOCR is not installed in this runtime."
                ) from exc
        return self._engine_version

    def recognize(
        self,
        field: FieldRegion,
        source_language: SourceLanguage,
        processing_version: str,
    ) -> OcrFieldResult:
        raw_value, confidence = self.backend.recognize(
            field.crop_png_bytes,
            _model_name(field.field_type, source_language),
        )
        if not isinstance(raw_value, str) or not raw_value:
            raise EmptyOcrResultError()
        if confidence is not None:
            try:
                confidence = float(confidence)
            except (TypeError, ValueError) as exc:
                raise OcrOutputParseError(
                    "PaddleOCR confidence is not numeric."
                ) from exc
            if not 0 <= confidence <= 1:
                raise OcrOutputParseError(
                    "PaddleOCR confidence is outside zero-to-one."
                )
        return OcrFieldResult(
            field_type=field.field_type,
            source_language=source_language,
            page_bbox=field.page_bbox,
            raw_value=raw_value,
            normalized_value=normalize_ocr_value(raw_value, field.field_type),
            ocr_engine=self.engine,
            ocr_engine_version=self.engine_version,
            field_confidence=confidence,
            processing_version=processing_version,
        )
