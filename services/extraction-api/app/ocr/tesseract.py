from __future__ import annotations

import shutil
import subprocess
from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass
from statistics import mean

from app.core.exceptions import (
    EmptyOcrResultError,
    OcrEngineUnavailableError,
    OcrExecutionError,
    OcrOutputParseError,
    OcrTimeoutError,
    UnsupportedOcrLanguageError,
)
from app.models.common import SourceLanguage
from app.models.field_regions import FieldRegion, FieldType
from app.models.ocr import OcrEngine, OcrFieldResult
from app.ocr.normalization import normalize_ocr_value


CommandRunner = Callable[..., subprocess.CompletedProcess[bytes]]


@dataclass(frozen=True)
class _TesseractProfile:
    language: str
    page_segmentation_mode: int
    whitelist: str | None = None


_DIGITS = "0123456789"
_EPIC_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"


def _profile(field_type: FieldType, source_language: SourceLanguage) -> _TesseractProfile:
    if source_language not in {SourceLanguage.ENGLISH, SourceLanguage.TELUGU}:
        raise UnsupportedOcrLanguageError(source_language=source_language.value)
    if field_type in {FieldType.SERIAL_NUMBER, FieldType.AGE}:
        return _TesseractProfile("eng", 7, _DIGITS)
    if field_type == FieldType.EPIC:
        return _TesseractProfile("eng", 7, _EPIC_CHARACTERS)
    language = "eng" if source_language == SourceLanguage.ENGLISH else "tel"
    if field_type == FieldType.HOUSE_NUMBER and source_language == SourceLanguage.TELUGU:
        language = "tel+eng"
    return _TesseractProfile(language, 7)


def _parse_tsv(payload: bytes) -> tuple[str, float | None]:
    try:
        text = payload.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise OcrOutputParseError("Tesseract output is not valid UTF-8.") from exc

    lines: dict[tuple[str, str, str, str], list[str]] = defaultdict(list)
    confidences: list[float] = []
    for row in text.splitlines()[1:]:
        columns = row.split("\t", 11)
        if len(columns) != 12 or columns[0] != "5":
            continue
        word = columns[11]
        if not word:
            continue
        line_key = (columns[1], columns[2], columns[3], columns[4])
        lines[line_key].append(word)
        try:
            confidence = float(columns[10])
        except ValueError:
            continue
        if confidence >= 0:
            confidences.append(confidence / 100)

    raw_value = "\n".join(" ".join(words) for words in lines.values())
    if not raw_value:
        raise EmptyOcrResultError()
    field_confidence = mean(confidences) if confidences else None
    return raw_value, field_confidence


class TesseractOcrAdapter:
    engine = OcrEngine.TESSERACT

    def __init__(
        self,
        *,
        binary: str = "tesseract",
        timeout_seconds: float = 15,
        runner: CommandRunner = subprocess.run,
        engine_version: str | None = None,
    ) -> None:
        self.binary = binary
        self.timeout_seconds = timeout_seconds
        self.runner = runner
        self._engine_version = engine_version

    @property
    def engine_version(self) -> str:
        if self._engine_version is None:
            self._engine_version = self._discover_version()
        return self._engine_version

    def _discover_version(self) -> str:
        if self.runner is subprocess.run and shutil.which(self.binary) is None:
            raise OcrEngineUnavailableError(binary=self.binary)
        try:
            process = self.runner(
                [self.binary, "--version"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=self.timeout_seconds,
                check=False,
            )
        except FileNotFoundError as exc:
            raise OcrEngineUnavailableError(binary=self.binary) from exc
        except subprocess.TimeoutExpired as exc:
            raise OcrTimeoutError("Tesseract version detection timed out.") from exc
        if process.returncode != 0:
            raise OcrEngineUnavailableError(binary=self.binary)
        first_line = process.stdout.decode("utf-8", errors="replace").splitlines()
        if not first_line:
            raise OcrOutputParseError("Tesseract did not report its version.")
        return first_line[0].removeprefix("tesseract ").strip()

    def recognize(
        self,
        field: FieldRegion,
        source_language: SourceLanguage,
        processing_version: str,
    ) -> OcrFieldResult:
        profile = _profile(field.field_type, source_language)
        arguments = [
            self.binary,
            "stdin",
            "stdout",
            "-l",
            profile.language,
            "--psm",
            str(profile.page_segmentation_mode),
        ]
        if profile.whitelist:
            arguments.extend(["-c", f"tessedit_char_whitelist={profile.whitelist}"])
        arguments.append("tsv")
        try:
            process = self.runner(
                arguments,
                input=field.crop_png_bytes,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=self.timeout_seconds,
                check=False,
            )
        except FileNotFoundError as exc:
            raise OcrEngineUnavailableError(binary=self.binary) from exc
        except subprocess.TimeoutExpired as exc:
            raise OcrTimeoutError(field_type=field.field_type.value) from exc
        if process.returncode != 0:
            raise OcrExecutionError(
                field_type=field.field_type.value,
                engine_stderr=process.stderr.decode("utf-8", errors="replace")[-500:],
            )

        raw_value, confidence = _parse_tsv(process.stdout)
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
