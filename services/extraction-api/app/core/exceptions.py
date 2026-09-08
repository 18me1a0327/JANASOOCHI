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


class InvalidCardGeometryError(CardSegmentationError):
    code = "invalid_card_geometry"
    default_message = "The detected voter-card geometry is invalid."
    retryable = False


class UnsupportedPageLayoutError(CardSegmentationError):
    code = "unsupported_page_layout"
    default_message = "This page does not use the supported three-column voter layout."
    retryable = False


class FieldRegionExtractionError(ExtractionError):
    code = "field_region_extraction_error"
    default_message = "Unable to extract voter-card field regions."
    retryable = True


class InvalidFieldRegionGeometryError(FieldRegionExtractionError):
    code = "invalid_field_region_geometry"
    default_message = "The voter-card field-region geometry is invalid."
    retryable = False


class UnsupportedCardTemplateError(FieldRegionExtractionError):
    code = "unsupported_card_template"
    default_message = "No field-region template is available for this source layout."
    retryable = False


class PageContractMismatchError(FieldRegionExtractionError):
    code = "page_contract_mismatch"
    default_message = "The rendered page and segmentation result do not match."
    retryable = False


class OcrTimeoutError(ExtractionError):
    code = "ocr_timeout"
    default_message = "OCR timed out for this field."
    retryable = True


class OcrEngineUnavailableError(ExtractionError):
    code = "ocr_engine_unavailable"
    default_message = "The configured OCR engine is unavailable."
    status_code = 503
    retryable = True


class OcrExecutionError(ExtractionError):
    code = "ocr_execution_error"
    default_message = "The OCR engine could not process this field."
    retryable = True


class OcrOutputParseError(ExtractionError):
    code = "ocr_output_parse_error"
    default_message = "The OCR engine returned an unreadable response."
    retryable = True


class UnsupportedOcrLanguageError(ExtractionError):
    code = "unsupported_ocr_language"
    default_message = "OCR is currently enabled only for English and Telugu source records."
    retryable = False


class EmptyOcrResultError(ExtractionError):
    code = "empty_ocr_result"
    default_message = "OCR did not return readable text."
    retryable = True


class OcrPreprocessingError(ExtractionError):
    code = "ocr_preprocessing_error"
    default_message = "Unable to prepare this field for another OCR attempt."
    retryable = False


class GroundTruthImportError(ExtractionError):
    code = "ground_truth_import_error"
    default_message = "Unable to import the ground-truth dataset."
    status_code = 400
    retryable = False


class GroundTruthValidationError(GroundTruthImportError):
    code = "ground_truth_validation_error"
    default_message = "The ground-truth dataset failed validation."


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

