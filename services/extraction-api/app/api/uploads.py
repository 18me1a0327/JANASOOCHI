from pathlib import Path

from fastapi import UploadFile

from app.core.exceptions import InvalidPdfError
from app.pdf.validator import ALLOWED_CONTENT_TYPES


async def read_bounded_pdf(upload: UploadFile, max_bytes: int) -> bytes:
    if not upload.filename or Path(upload.filename).suffix.lower() != ".pdf":
        raise InvalidPdfError(reason="invalid_extension")
    if upload.content_type and upload.content_type.lower() not in ALLOWED_CONTENT_TYPES:
        raise InvalidPdfError(reason="invalid_content_type", content_type=upload.content_type)

    chunks: list[bytes] = []
    size = 0
    while chunk := await upload.read(1024 * 1024):
        size += len(chunk)
        if size > max_bytes:
            raise InvalidPdfError(reason="file_too_large", max_bytes=max_bytes)
        chunks.append(chunk)
    if size == 0:
        raise InvalidPdfError(reason="empty_upload")
    return b"".join(chunks)
