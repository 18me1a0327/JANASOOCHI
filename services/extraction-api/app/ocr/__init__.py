"""Field-specific OCR adapters. No adapter may overwrite raw engine output."""

from app.ocr.base import OcrAdapter
from app.ocr.benchmark import benchmark_adapter
from app.ocr.paddle import PaddleOcrAdapter
from app.ocr.pipeline import recognize_card_fields
from app.ocr.tesseract import TesseractOcrAdapter

__all__ = [
    "OcrAdapter",
    "PaddleOcrAdapter",
    "TesseractOcrAdapter",
    "benchmark_adapter",
    "recognize_card_fields",
]
