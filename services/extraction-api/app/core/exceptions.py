from typing import Any, ClassVar


class ExtractionError(Exception):
    """Base class for expected, user-safe extraction failures."""

    code: ClassVar[str] = "extraction_error"
    default_message: ClassVar[str] = "Unable to process the extraction request."
    status_code: ClassVar[int] = 422
    retryable: ClassVar[bool] = False

    def __init__(self, message: str | None = None, **details: Any) -> None:
        super().__init__(message or self.default_message)
        self.message = message or self.default_message
        self.details = details


class InvalidPdfError(ExtractionError):
    code = "invalid_pdf"
    default_message = "Unable to open PDF."
    status_code = 400


class UnsupportedPartError(ExtractionError):
    code = "unsupported_part"
    default_message = (
        "Unsupported electoral roll. This application supports only "
        "Pallerlamudi Parts 227, 228, 229 and 230."
    )
    status_code = 422


class UnsupportedLanguageError(ExtractionError):
    code = "unsupported_language"
    default_message = "Only English, Telugu and Urdu source PDFs are supported."
    status_code = 422


class DuplicateDocumentError(ExtractionError):
    code = "duplicate_document"
    default_message = "This PDF has already been processed."
    status_code = 409


class PageRenderError(ExtractionError):
    code = "page_render_error"
    default_message = "Unable to process this page."
    retryable = True


class PageOutOfRangeError(PageRenderError):
    code = "page_out_of_range"
    default_message = "The requested physical PDF page does not exist."
    retryable = False
    status_code = 404


class GridDetectionError(ExtractionError):
    code = "grid_detection_error"
    default_message = "Unable to detect the voter-card grid."
    retryable = True


class CardSegmentationError(ExtractionError):
    code = "card_segmentation_error"
    default_message = "Unable to segment the voter card."
    retryable = True


class OcrTimeoutError(ExtractionError):
    code = "ocr_timeout"
    default_message = "OCR timed out for this field."
    retryable = True


class EmptyOcrResultError(ExtractionError):
    code = "empty_ocr_result"
    default_message = "OCR did not return readable text."
    retryable = True


class InvalidSerialError(ExtractionError):
    code = "invalid_serial"
    default_message = "The extracted serial number is invalid."


class InvalidEpicError(ExtractionError):
    code = "invalid_epic"
    default_message = "The extracted EPIC value is invalid."


class JobNotFoundError(ExtractionError):
    code = "job_not_found"
    default_message = "Processing job not found."
    status_code = 404
