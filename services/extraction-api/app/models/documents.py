from datetime import datetime

from pydantic import Field

from app.models.common import SourceLanguage, StrictModel


class PdfInspection(StrictModel):
    filename: str
    checksum_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    part_number: int
    source_language: SourceLanguage
    revision_year: int | None
    pdf_physical_pages: int = Field(ge=1)
    is_encrypted: bool
    validated_at: datetime


class RenderedPage(StrictModel):
    physical_page: int = Field(ge=1)
    width_px: int = Field(ge=1)
    height_px: int = Field(ge=1)
    dpi: int = Field(ge=72)
    png_bytes: bytes
