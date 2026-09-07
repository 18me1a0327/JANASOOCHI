import pymupdf

from app.core.exceptions import ExtractionError, InvalidPdfError, PageOutOfRangeError, PageRenderError
from app.models.documents import RenderedPage
from app.pdf.validator import validate_pdf_magic


class PdfRenderer:
    def render_page(self, data: bytes, physical_page: int, dpi: int) -> RenderedPage:
        validate_pdf_magic(data)
        if physical_page < 1:
            raise PageOutOfRangeError(physical_page=physical_page)

        try:
            document = pymupdf.open(stream=data, filetype="pdf")
        except Exception as exc:
            raise InvalidPdfError(reason="pdf_parser_rejected_file") from exc

        try:
            if document.needs_pass:
                raise InvalidPdfError(reason="encrypted_pdf")
            if physical_page > document.page_count:
                raise PageOutOfRangeError(
                    physical_page=physical_page,
                    page_count=document.page_count,
                )
            page = document.load_page(physical_page - 1)
            pixmap = page.get_pixmap(dpi=dpi, alpha=False, colorspace=pymupdf.csRGB)
            png = pixmap.tobytes("png")
            return RenderedPage(
                physical_page=physical_page,
                width_px=pixmap.width,
                height_px=pixmap.height,
                dpi=dpi,
                png_bytes=png,
            )
        except ExtractionError:
            raise
        except Exception as exc:
            raise PageRenderError(physical_page=physical_page) from exc
        finally:
            document.close()
