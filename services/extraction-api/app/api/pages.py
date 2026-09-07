from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile

from app.api.uploads import read_bounded_pdf
from app.core.config import Settings, get_settings
from app.core.exceptions import PageRenderError
from app.pdf.renderer import PdfRenderer


router = APIRouter(prefix="/pages", tags=["pages"])


@router.post("/render", response_class=Response)
async def render_page(
    file: Annotated[UploadFile, File()],
    physical_page: Annotated[int, Form(ge=1)] = 1,
    dpi: Annotated[int | None, Form(ge=72)] = None,
    settings: Settings = Depends(get_settings),
) -> Response:
    render_dpi = dpi or settings.default_render_dpi
    if render_dpi > settings.max_render_dpi:
        raise PageRenderError(
            "The requested render resolution exceeds the configured maximum.",
            requested_dpi=render_dpi,
            max_dpi=settings.max_render_dpi,
        )
    data = await read_bounded_pdf(file, settings.max_upload_bytes)
    rendered = PdfRenderer().render_page(data, physical_page=physical_page, dpi=render_dpi)
    return Response(
        content=rendered.png_bytes,
        media_type="image/png",
        headers={
            "X-PDF-Physical-Page": str(rendered.physical_page),
            "X-Render-Width": str(rendered.width_px),
            "X-Render-Height": str(rendered.height_px),
            "X-Render-DPI": str(rendered.dpi),
            "Cache-Control": "private, no-store",
        },
    )
