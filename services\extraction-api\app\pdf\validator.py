import hashlib
import re
from datetime import UTC, datetime
from pathlib import Path

import pymupdf

from app.core.exceptions import InvalidPdfError, UnsupportedLanguageError, UnsupportedPartError
from app.models.common import SUPPORTED_PARTS, SourceLanguage
from app.models.documents import PdfInspection


PDF_MAGIC = b"%PDF-"
ALLOWED_CONTENT_TYPES = {"application/pdf", "application/octet-stream"}

LANGUAGE_MARKERS = {
    "ENG": SourceLanguage.ENGLISH,
    "TEL": SourceLanguage.TELUGU,
    "URD": SourceLanguage.URDU,
}


def validate_pdf_magic(data: bytes) -> None:
    if not data.startswith(PDF_MAGIC):
        raise InvalidPdfError(reason="missing_pdf_magic")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _part_from_filename(filename: str) -> int | None:
    upper = filename.upper()
    language_match = re.search(r"-(?:ENG|TEL|URD)-(\d{3})(?:-|_|\.|$)", upper)
    if language_match:
        return int(language_match.group(1))
    part_match = re.search(r"(?:^|[-_\s])PART[-_\s]*(\d{3})(?:[-_\s\.]|$)", upper)
    return int(part_match.group(1)) if part_match else None


def _language_from_filename(filename: str) -> SourceLanguage | None:
    upper = filename.upper()
    for marker, language in LANGUAGE_MARKERS.items():
        if re.search(rf"(?:^|[-_]){marker}(?:[-_\.]|$)", upper):
            return language
    return None


def _revision_from_filename(filename: str) -> int | None:
    match = re.search(r"(?:^|\D)(20\d{2})(?:\D|$)", filename)
    return int(match.group(1)) if match else None


def inspect_pdf(
    data: bytes,
    filename: str,
    declared_part: int | None = None,
    declared_language: SourceLanguage | None = None,
) -> PdfInspection:
    if not filename or Path(filename).suffix.lower() != ".pdf":
        raise InvalidPdfError(reason="invalid_extension")
    validate_pdf_magic(data)

    detected_part = _part_from_filename(filename)
    part = declared_part if declared_part is not None else detected_part
    if part not in SUPPORTED_PARTS:
        raise UnsupportedPartError(detected_part=part)
    if detected_part is not None and declared_part is not None and detected_part != declared_part:
        raise UnsupportedPartError(
            "The declared Part does not match the electoral-roll filename.",
            declared_part=declared_part,
            detected_part=detected_part,
        )

    detected_language = _language_from_filename(filename)
    language = declared_language or detected_language
    if language is None:
        raise UnsupportedLanguageError(reason="language_not_detected")
    if detected_language is not None and declared_language is not None and detected_language != declared_language:
        raise UnsupportedLanguageError(
            "The declared language does not match the electoral-roll filename.",
            declared_language=declared_language.value,
            detected_language=detected_language.value,
        )

    try:
        document = pymupdf.open(stream=data, filetype="pdf")
    except Exception as exc:
        raise InvalidPdfError(reason="pdf_parser_rejected_file") from exc

    try:
        if document.needs_pass:
            raise InvalidPdfError(reason="encrypted_pdf")
        page_count = document.page_count
        if page_count < 1:
            raise InvalidPdfError(reason="empty_pdf")
    finally:
        document.close()

    return PdfInspection(
        filename=Path(filename).name,
        checksum_sha256=sha256_bytes(data),
        part_number=part,
        source_language=language,
        revision_year=_revision_from_filename(filename),
        pdf_physical_pages=page_count,
        is_encrypted=False,
        validated_at=datetime.now(UTC),
    )
