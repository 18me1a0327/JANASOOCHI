from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.api.uploads import read_bounded_pdf
from app.core.config import Settings, get_settings
from app.models.common import SourceLanguage
from app.models.documents import PdfInspection
from app.pdf.validator import inspect_pdf


router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/validate", response_model=PdfInspection)
async def validate_document(
    file: Annotated[UploadFile, File()],
    declared_part: Annotated[int | None, Form()] = None,
    declared_language: Annotated[SourceLanguage | None, Form()] = None,
    settings: Settings = Depends(get_settings),
) -> PdfInspection:
    data = await read_bounded_pdf(file, settings.max_upload_bytes)
    return inspect_pdf(
        data,
        filename=file.filename or "",
        declared_part=declared_part,
        declared_language=declared_language,
    )
