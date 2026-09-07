from __future__ import annotations

import shutil
import subprocess

import pymupdf
import pytest

from app.core.exceptions import (
    EmptyOcrResultError,
    OcrEngineUnavailableError,
    OcrExecutionError,
    OcrOutputParseError,
    UnsupportedOcrLanguageError,
)
from app.models.common import SourceLanguage
from app.models.field_regions import (
    FieldRegion,
    FieldType,
    RelativeBoundingBox,
)
from app.models.ocr import OcrBenchmarkCase, OcrEngine, OcrFieldResult
from app.models.segmentation import BoundingBox
from app.ocr.benchmark import benchmark_adapter
from app.ocr.normalization import normalize_ocr_value
from app.ocr.paddle import PaddleOcrAdapter
from app.ocr.pipeline import recognize_card_fields
from app.ocr.tesseract import TesseractOcrAdapter
from app.vision.field_regions import extract_card_field_regions
from app.vision.segmentation import segment_page
from tests.segmentation_fixtures import synthetic_voter_page


TSV_HEADER = (
    "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n"
)


def _field(field_type: FieldType, text: str = "SYNTHETIC") -> FieldRegion:
    document = pymupdf.open()
    page = document.new_page(width=400, height=100)
    page.insert_text((18, 70), text, fontsize=52)
    pixmap = page.get_pixmap(dpi=144, alpha=False)
    result = FieldRegion(
        field_type=field_type,
        relative_bbox=RelativeBoundingBox(x1=0, y1=0, x2=1, y2=1),
        page_bbox=BoundingBox(x1=0, y1=0, x2=pixmap.width, y2=pixmap.height),
        crop_width=pixmap.width,
        crop_height=pixmap.height,
        crop_png_bytes=pixmap.tobytes("png"),
    )
    document.close()
    return result


class _TesseractRunner:
    def __init__(self, tsv: str) -> None:
        self.tsv = tsv
        self.calls: list[list[str]] = []

    def __call__(self, arguments: list[str], **_: object) -> subprocess.CompletedProcess[bytes]:
        self.calls.append(arguments)
        if "--version" in arguments:
            return subprocess.CompletedProcess(arguments, 0, b"tesseract 5.3.0\n", b"")
        return subprocess.CompletedProcess(arguments, 0, self.tsv.encode("utf-8"), b"")


class _PaddleBackend:
    def __init__(self, raw_value: str, confidence: float | None = None) -> None:
        self.raw_value = raw_value
        self.confidence = confidence
        self.models: list[str] = []

    def recognize(self, _: bytes, model_name: str) -> tuple[str, float | None]:
        self.models.append(model_name)
        return self.raw_value, self.confidence


def test_tesseract_preserves_raw_text_and_actual_word_confidence() -> None:
    tsv = TSV_HEADER + (
        "5\t1\t1\t1\t1\t1\t0\t0\t10\t10\t96\tANAND\n"
        "5\t1\t1\t1\t1\t2\t12\t0\t10\t10\t88\tRAO\n"
    )
    runner = _TesseractRunner(tsv)
    adapter = TesseractOcrAdapter(runner=runner)

    result = adapter.recognize(
        _field(FieldType.VOTER_NAME),
        SourceLanguage.ENGLISH,
        "2.3.0",
    )

    assert result.raw_value == "ANAND RAO"
    assert result.normalized_value == "anand rao"
    assert result.field_confidence == pytest.approx(0.92)
    assert result.ocr_engine_version == "5.3.0"


def test_tesseract_uses_numeric_profile_for_serial() -> None:
    runner = _TesseractRunner(
        TSV_HEADER + "5\t1\t1\t1\t1\t1\t0\t0\t10\t10\t90\t123\n"
    )
    adapter = TesseractOcrAdapter(runner=runner, engine_version="5.3.0")

    result = adapter.recognize(
        _field(FieldType.SERIAL_NUMBER),
        SourceLanguage.TELUGU,
        "2.3.0",
    )

    arguments = runner.calls[0]
    assert arguments[arguments.index("-l") + 1] == "eng"
    assert "tessedit_char_whitelist=0123456789" in arguments
    assert result.normalized_value == "123"


def test_tesseract_uses_telugu_model_for_telugu_names() -> None:
    runner = _TesseractRunner(
        TSV_HEADER + "5\t1\t1\t1\t1\t1\t0\t0\t10\t10\t91\tఆనంద్\n"
    )
    adapter = TesseractOcrAdapter(runner=runner, engine_version="5.3.0")

    result = adapter.recognize(
        _field(FieldType.VOTER_NAME),
        SourceLanguage.TELUGU,
        "2.3.0",
    )

    arguments = runner.calls[0]
    assert arguments[arguments.index("-l") + 1] == "tel"
    assert result.raw_value == "ఆనంద్"


def test_tesseract_does_not_invent_confidence() -> None:
    runner = _TesseractRunner(
        TSV_HEADER + "5\t1\t1\t1\t1\t1\t0\t0\t10\t10\t-1\tVALUE\n"
    )
    adapter = TesseractOcrAdapter(runner=runner, engine_version="5.3.0")

    result = adapter.recognize(
        _field(FieldType.HOUSE_NUMBER),
        SourceLanguage.ENGLISH,
        "2.3.0",
    )

    assert result.field_confidence is None


def test_tesseract_empty_output_fails_explicitly() -> None:
    adapter = TesseractOcrAdapter(
        runner=_TesseractRunner(TSV_HEADER),
        engine_version="5.3.0",
    )

    with pytest.raises(EmptyOcrResultError):
        adapter.recognize(
            _field(FieldType.EPIC),
            SourceLanguage.ENGLISH,
            "2.3.0",
        )


def test_urdu_ocr_remains_blocked() -> None:
    adapter = TesseractOcrAdapter(
        runner=_TesseractRunner(TSV_HEADER),
        engine_version="5.3.0",
    )

    with pytest.raises(UnsupportedOcrLanguageError):
        adapter.recognize(_field(FieldType.VOTER_NAME), SourceLanguage.URDU, "2.3.0")


def test_paddle_adapter_preserves_telugu_raw_and_uses_telugu_model() -> None:
    backend = _PaddleBackend("  ఆనంద్  ", 0.87)
    adapter = PaddleOcrAdapter(backend=backend, engine_version="3.7.0")

    result = adapter.recognize(
        _field(FieldType.VOTER_NAME),
        SourceLanguage.TELUGU,
        "2.3.0",
    )

    assert result.raw_value == "  ఆనంద్  "
    assert result.normalized_value == "ఆనంద్"
    assert result.field_confidence == 0.87
    assert backend.models == ["te_PP-OCRv5_mobile_rec"]


def test_paddle_rejects_non_engine_confidence() -> None:
    adapter = PaddleOcrAdapter(
        backend=_PaddleBackend("ANAND", 1.5),
        engine_version="3.7.0",
    )

    with pytest.raises(OcrOutputParseError):
        adapter.recognize(
            _field(FieldType.VOTER_NAME),
            SourceLanguage.ENGLISH,
            "2.3.0",
        )


def test_card_pipeline_isolates_one_field_failure() -> None:
    page = synthetic_voter_page(rows=1, populated_cards=1)
    segmentation = segment_page(page)
    card = extract_card_field_regions(page, segmentation.cards[0], SourceLanguage.ENGLISH)

    class Adapter:
        engine = OcrEngine.TESSERACT
        engine_version = "test"

        def recognize(self, field: FieldRegion, language: SourceLanguage, version: str) -> OcrFieldResult:
            if field.field_type == FieldType.EPIC:
                raise OcrExecutionError()
            return OcrFieldResult(
                field_type=field.field_type,
                source_language=language,
                page_bbox=field.page_bbox,
                raw_value=field.field_type.value,
                normalized_value=field.field_type.value,
                ocr_engine=self.engine,
                ocr_engine_version=self.engine_version,
                field_confidence=None,
                processing_version=version,
            )

    result = recognize_card_fields(card, Adapter(), "2.3.0")

    assert len(result.fields) == 7
    assert len(result.failures) == 1
    assert result.failures[0].field_type == FieldType.EPIC


def test_benchmark_uses_all_supplied_cases_as_accuracy_denominator() -> None:
    class Adapter:
        engine = OcrEngine.TESSERACT
        engine_version = "test"

        def recognize(self, field: FieldRegion, language: SourceLanguage, version: str) -> OcrFieldResult:
            raw = "123" if field.field_type == FieldType.SERIAL_NUMBER else "40"
            return OcrFieldResult(
                field_type=field.field_type,
                source_language=language,
                page_bbox=field.page_bbox,
                raw_value=raw,
                normalized_value=raw,
                ocr_engine=self.engine,
                ocr_engine_version=self.engine_version,
                field_confidence=None,
                processing_version=version,
            )

    cases = [
        OcrBenchmarkCase(
            case_id="serial",
            source_language=SourceLanguage.ENGLISH,
            field_region=_field(FieldType.SERIAL_NUMBER),
            expected_normalized_value="123",
        ),
        OcrBenchmarkCase(
            case_id="age",
            source_language=SourceLanguage.ENGLISH,
            field_region=_field(FieldType.AGE),
            expected_normalized_value="41",
        ),
    ]

    result = benchmark_adapter(Adapter(), cases, "2.3.0")

    assert result.total_cases == 2
    assert result.exact_matches == 1
    assert result.exact_accuracy == 0.5


def test_normalization_keeps_raw_source_separate() -> None:
    raw = "  abc 12/3  "

    assert normalize_ocr_value(raw, FieldType.EPIC) == "ABC123"
    assert raw == "  abc 12/3  "


def test_missing_tesseract_binary_fails_without_stack_trace_contract() -> None:
    adapter = TesseractOcrAdapter(binary="definitely-not-installed-janasoochi")

    with pytest.raises(OcrEngineUnavailableError):
        _ = adapter.engine_version


@pytest.mark.skipif(shutil.which("tesseract") is None, reason="Tesseract is Docker-provided")
def test_installed_tesseract_recognizes_synthetic_numeric_field() -> None:
    result = TesseractOcrAdapter().recognize(
        _field(FieldType.SERIAL_NUMBER, "12345"),
        SourceLanguage.ENGLISH,
        "2.3.0",
    )

    assert result.normalized_value == "12345"


@pytest.mark.skipif(shutil.which("tesseract") is None, reason="Tesseract is Docker-provided")
def test_installed_tesseract_has_english_and_telugu_languages() -> None:
    process = subprocess.run(
        ["tesseract", "--list-langs"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )
    languages = set(process.stdout.decode("utf-8").splitlines())

    assert {"eng", "tel"}.issubset(languages)
