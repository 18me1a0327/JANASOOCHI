import hashlib

import pytest
from fastapi.testclient import TestClient

from app.core.exceptions import InvalidPdfError, PageOutOfRangeError, UnsupportedLanguageError, UnsupportedPartError
from app.models.common import SourceLanguage
from app.pdf.renderer import PdfRenderer
from app.pdf.validator import inspect_pdf, sha256_bytes, validate_pdf_magic


FILENAME = "2026-EROLLGEN-S01-70-SIR-DraftRoll-Revision1-ENG-227-WI.pdf"


def test_magic_bytes_are_required_at_byte_zero() -> None:
    with pytest.raises(InvalidPdfError):
        validate_pdf_magic(b" \n%PDF-1.7")


def test_sha256_is_deterministic(pdf_bytes: bytes) -> None:
    assert sha256_bytes(pdf_bytes) == hashlib.sha256(pdf_bytes).hexdigest()


def test_inspection_detects_revision_part_language_and_pages(pdf_bytes: bytes) -> None:
    inspection = inspect_pdf(pdf_bytes, FILENAME)

    assert inspection.revision_year == 2026
    assert inspection.part_number == 227
    assert inspection.source_language == SourceLanguage.ENGLISH
    assert inspection.pdf_physical_pages == 2
    assert inspection.checksum_sha256 == sha256_bytes(pdf_bytes)


def test_inspection_rejects_unsupported_part(pdf_bytes: bytes) -> None:
    with pytest.raises(UnsupportedPartError):
        inspect_pdf(pdf_bytes, FILENAME.replace("-227-", "-231-"))


def test_inspection_rejects_language_mismatch(pdf_bytes: bytes) -> None:
    with pytest.raises(UnsupportedLanguageError):
        inspect_pdf(pdf_bytes, FILENAME, declared_language=SourceLanguage.TELUGU)


def test_urdu_requires_a_real_pdf(pdf_bytes: bytes) -> None:
    urdu_filename = FILENAME.replace("-ENG-", "-URD-")
    assert inspect_pdf(pdf_bytes, urdu_filename).source_language == SourceLanguage.URDU
    with pytest.raises(InvalidPdfError):
        inspect_pdf(b"not a PDF", urdu_filename)


def test_corrupted_pdf_is_rejected_after_magic_validation() -> None:
    with pytest.raises(InvalidPdfError):
        inspect_pdf(b"%PDF-1.7\ncorrupted", FILENAME)


def test_render_uses_one_based_physical_page(pdf_bytes: bytes) -> None:
    rendered = PdfRenderer().render_page(pdf_bytes, physical_page=2, dpi=144)

    assert rendered.physical_page == 2
    assert rendered.dpi == 144
    assert rendered.png_bytes.startswith(b"\x89PNG\r\n\x1a\n")
    assert rendered.width_px > 0
    assert rendered.height_px > 0


def test_render_out_of_range_is_not_retryable(pdf_bytes: bytes) -> None:
    with pytest.raises(PageOutOfRangeError) as caught:
        PdfRenderer().render_page(pdf_bytes, physical_page=3, dpi=144)

    assert caught.value.retryable is False


def test_validate_endpoint_returns_inspection(client: TestClient, pdf_bytes: bytes) -> None:
    response = client.post(
        "/api/v1/documents/validate",
        files={"file": (FILENAME, pdf_bytes, "application/pdf")},
    )

    assert response.status_code == 200
    assert response.json()["part_number"] == 227
    assert response.json()["pdf_physical_pages"] == 2


def test_validate_endpoint_rejects_non_pdf(client: TestClient) -> None:
    response = client.post(
        "/api/v1/documents/validate",
        files={"file": ("roll.txt", b"not a PDF", "text/plain")},
        data={"declared_part": "227", "declared_language": "en"},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_pdf"
    assert "trace" not in response.text.lower()


def test_render_endpoint_returns_private_png(client: TestClient, pdf_bytes: bytes) -> None:
    response = client.post(
        "/api/v1/pages/render",
        files={"file": (FILENAME, pdf_bytes, "application/pdf")},
        data={"physical_page": "1", "dpi": "144"},
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.headers["cache-control"] == "private, no-store"
    assert response.headers["x-pdf-physical-page"] == "1"
    assert response.content.startswith(b"\x89PNG")
