from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import UTC, datetime

from app.core.exceptions import (
    DatabasePersistenceError,
    ExtractionError,
    PipelineSelectionBlockedError,
)
from app.db.ingestion import PageIngestionRepository
from app.db.supabase_contracts import (
    AtomicPagePersistenceRequest,
    PageProcessingUpsert,
    SourceRecordInsert,
    build_review_issue_rows,
)
from app.ingestion.source_records import build_page_source_records
from app.models.common import PipelineVersions, SourceLanguage
from app.models.documents import RenderedPage
from app.models.field_regions import PageFieldRegionResult
from app.models.ingestion import (
    PagePersistenceStatus,
    PageProcessingState,
    SourceCardInput,
)
from app.models.ocr import OcrRetryPolicy
from app.models.segmentation import PageSegmentationResult
from app.models.worker import PageWorkOutcome, PageWorkRequest
from app.ocr.base import OcrAdapter
from app.ocr.pipeline import recognize_card_fields
from app.pdf.renderer import PdfRenderer
from app.vision.field_regions import extract_page_field_regions
from app.vision.segmentation import segment_page


logger = logging.getLogger("janasoochi.extraction.worker")

Segmenter = Callable[[RenderedPage], PageSegmentationResult]
FieldExtractor = Callable[
    [RenderedPage, PageSegmentationResult, SourceLanguage],
    PageFieldRegionResult,
]


class PageIngestionWorker:
    """Run and checkpoint one physical page without promoting source records."""

    def __init__(
        self,
        *,
        repository: PageIngestionRepository,
        ocr_adapter: OcrAdapter,
        versions: PipelineVersions,
        renderer: PdfRenderer | None = None,
        segmenter: Segmenter = segment_page,
        field_extractor: FieldExtractor = extract_page_field_regions,
        retry_policy: OcrRetryPolicy | None = None,
    ) -> None:
        self.repository = repository
        self.ocr_adapter = ocr_adapter
        self.versions = versions
        self.renderer = renderer or PdfRenderer()
        self.segmenter = segmenter
        self.field_extractor = field_extractor
        self.retry_policy = retry_policy or OcrRetryPolicy()
        self._validate_pipeline_contract()

    def _validate_pipeline_contract(self) -> None:
        if (
            not self.versions.ocr_engine
            or not self.versions.ocr_engine_version
            or self.versions.ocr_engine != self.ocr_adapter.engine.value
            or self.versions.ocr_engine_version != self.ocr_adapter.engine_version
        ):
            raise PipelineSelectionBlockedError(
                "The worker OCR adapter does not match an explicitly selected pipeline.",
                configured_engine=self.versions.ocr_engine,
                adapter_engine=self.ocr_adapter.engine.value,
            )

    def _recognize_page(
        self,
        request: PageWorkRequest,
        rendered: RenderedPage,
        segmentation: PageSegmentationResult,
        processing_attempt: int,
    ) -> tuple[AtomicPagePersistenceRequest, list[str]]:
        warnings = list(segmentation.warnings)
        if not segmentation.cards:
            state = self._page_state(
                request,
                processing_attempt=processing_attempt,
                status=PagePersistenceStatus.COMPLETED,
                records_detected=0,
                records_extracted=0,
                review_records=0,
                cards=[],
            )
            return AtomicPagePersistenceRequest(page=state, records=[]), warnings

        field_page = self.field_extractor(rendered, segmentation, request.source_language)
        card_by_index = {card.card_index: card for card in segmentation.cards}
        source_cards: list[SourceCardInput] = []
        card_failures: dict[int, dict[str, object]] = {
            failure.card_index: {
                "card_index": failure.card_index,
                "status": "requires_review",
                "error_code": failure.error_code,
                "retryable": failure.retryable,
            }
            for failure in field_page.failures
        }

        for card in field_page.cards:
            try:
                ocr_result = recognize_card_fields(
                    card,
                    self.ocr_adapter,
                    self.versions.pipeline_version,
                    self.retry_policy,
                )
                original_card_text = "\n".join(
                    field.raw_value for field in ocr_result.fields if field.raw_value
                )
                source_cards.append(
                    SourceCardInput(
                        ocr_result=ocr_result,
                        card_bbox=card.card_bbox,
                        original_card_text=original_card_text,
                        printed_page_number=request.printed_page_number,
                    )
                )
            except ExtractionError as exc:
                card_failures[card.card_index] = {
                    "card_index": card.card_index,
                    "status": "requires_review",
                    "error_code": exc.code,
                    "retryable": exc.retryable,
                }
            except Exception:
                logger.exception(
                    "Unexpected voter-card processing failure",
                    extra={
                        "document_id": str(request.document_id),
                        "physical_page_number": request.physical_page_number,
                        "card_index": card.card_index,
                    },
                )
                card_failures[card.card_index] = {
                    "card_index": card.card_index,
                    "status": "requires_review",
                    "error_code": "unexpected_card_error",
                    "retryable": False,
                }

        ingestion = build_page_source_records(
            document_id=request.document_id,
            revision_identifier=request.revision_identifier,
            part_number=request.part_number,
            source_language=request.source_language,
            physical_page_number=request.physical_page_number,
            cards=source_cards,
            versions=self.versions,
        )
        records = [SourceRecordInsert(**record.model_dump()) for record in ingestion.records]
        review_issues = [
            issue
            for record in ingestion.records
            for issue in build_review_issue_rows(record)
        ]
        for failure in ingestion.failures:
            card_failures[failure.card_index] = {
                "card_index": failure.card_index,
                "status": "requires_review",
                "error_code": failure.error_code,
                "retryable": failure.retryable,
            }

        record_by_index = {record.card_index: record for record in ingestion.records}
        card_states: list[dict[str, object]] = []
        for card_index in sorted(card_by_index):
            if card_index in card_failures:
                card_states.append(card_failures[card_index])
                continue
            record = record_by_index[card_index]
            card_states.append(
                {
                    "card_index": card_index,
                    "row_index": card_by_index[card_index].row_index,
                    "column_index": card_by_index[card_index].column_index,
                    "bbox": card_by_index[card_index].bbox.model_dump(mode="json"),
                    "status": "requires_review" if record.requires_review else "extracted",
                    "issue_codes": [issue.code for issue in record.issues],
                }
            )

        if card_failures or ingestion.review_candidate_count:
            status = PagePersistenceStatus.REQUIRES_REVIEW
        elif warnings:
            status = PagePersistenceStatus.COMPLETED_WITH_WARNINGS
        else:
            status = PagePersistenceStatus.COMPLETED
        if card_failures:
            warnings.append(
                f"{len(card_failures)} voter-card region(s) require human review."
            )

        state = self._page_state(
            request,
            processing_attempt=processing_attempt,
            status=status,
            records_detected=segmentation.validated_card_count,
            records_extracted=len(records),
            review_records=ingestion.review_candidate_count,
            cards=card_states,
            error_message="Page requires review." if card_failures else None,
        )
        return (
            AtomicPagePersistenceRequest(
                page=state,
                records=records,
                review_issues=review_issues,
            ),
            warnings,
        )

    def _page_state(
        self,
        request: PageWorkRequest,
        *,
        processing_attempt: int,
        status: PagePersistenceStatus,
        records_detected: int,
        records_extracted: int,
        review_records: int,
        cards: list[dict[str, object]],
        error_message: str | None = None,
    ) -> PageProcessingUpsert:
        state = PageProcessingState(
            document_id=request.document_id,
            processing_run_id=request.processing_run_id,
            physical_page_number=request.physical_page_number,
            printed_page_number=request.printed_page_number,
            status=status,
            attempts=processing_attempt,
            records_detected=records_detected,
            records_extracted=records_extracted,
            review_records=review_records,
            error_message=error_message,
            cards=cards,
            updated_at=datetime.now(UTC),
        )
        return PageProcessingUpsert(**state.model_dump())

    def _prepare_page(
        self,
        request: PageWorkRequest,
        processing_attempt: int,
    ) -> tuple[AtomicPagePersistenceRequest, list[str]]:
        rendered = self.renderer.render_page(
            request.pdf_bytes,
            physical_page=request.physical_page_number,
            dpi=request.render_dpi,
        )
        segmentation = self.segmenter(rendered)
        return self._recognize_page(request, rendered, segmentation, processing_attempt)

    async def _persist_failure(
        self,
        request: PageWorkRequest,
        processing_attempts: int,
        exc: ExtractionError,
    ) -> PageWorkOutcome:
        state = self._page_state(
            request,
            processing_attempt=processing_attempts,
            status=PagePersistenceStatus.REQUIRES_REVIEW,
            records_detected=0,
            records_extracted=0,
            review_records=0,
            cards=[],
            error_message=exc.message,
        )
        try:
            persisted = await self.repository.persist_page(
                AtomicPagePersistenceRequest(page=state, records=[])
            )
        except DatabasePersistenceError:
            logger.exception("Unable to persist a failed page checkpoint")
            return PageWorkOutcome(
                document_id=request.document_id,
                processing_run_id=request.processing_run_id,
                physical_page_number=request.physical_page_number,
                status=PagePersistenceStatus.FAILED,
                processing_attempts=processing_attempts,
                persistence_attempts=1,
                records_detected=0,
                records_extracted=0,
                review_records=0,
                persisted=False,
                error_code=exc.code,
                error_message=exc.message,
            )
        return PageWorkOutcome(
            document_id=request.document_id,
            processing_run_id=request.processing_run_id,
            physical_page_number=request.physical_page_number,
            status=PagePersistenceStatus.REQUIRES_REVIEW,
            processing_attempts=processing_attempts,
            persistence_attempts=1,
            records_detected=0,
            records_extracted=0,
            review_records=0,
            persisted=True,
            page_id=persisted.page_id,
            inserted_review_issues=persisted.inserted_review_issues,
            error_code=exc.code,
            error_message=exc.message,
        )

    async def process_page(self, request: PageWorkRequest) -> PageWorkOutcome:
        prepared: AtomicPagePersistenceRequest | None = None
        warnings: list[str] = []
        processing_attempts = 0
        persistence_attempts = 0
        last_error: ExtractionError | None = None

        while processing_attempts < 3:
            processing_attempts += 1
            try:
                prepared, warnings = self._prepare_page(request, processing_attempts)
                break
            except ExtractionError as exc:
                last_error = exc
                if not exc.retryable or processing_attempts == 3:
                    return await self._persist_failure(request, processing_attempts, exc)

        if prepared is None:
            assert last_error is not None
            return await self._persist_failure(request, processing_attempts, last_error)

        while persistence_attempts < 3:
            persistence_attempts += 1
            try:
                persisted = await self.repository.persist_page(prepared)
                page = prepared.page
                return PageWorkOutcome(
                    document_id=request.document_id,
                    processing_run_id=request.processing_run_id,
                    physical_page_number=request.physical_page_number,
                    status=page.status,
                    processing_attempts=processing_attempts,
                    persistence_attempts=persistence_attempts,
                    records_detected=page.records_detected,
                    records_extracted=page.records_extracted,
                    review_records=page.review_records,
                    persisted=True,
                    page_id=persisted.page_id,
                    inserted_records=persisted.inserted_records,
                    idempotent_records=persisted.idempotent_records,
                    inserted_review_issues=persisted.inserted_review_issues,
                    warnings=warnings,
                )
            except DatabasePersistenceError as exc:
                last_error = exc
                if persistence_attempts == 3:
                    break

        assert last_error is not None
        page = prepared.page
        return PageWorkOutcome(
            document_id=request.document_id,
            processing_run_id=request.processing_run_id,
            physical_page_number=request.physical_page_number,
            status=PagePersistenceStatus.FAILED,
            processing_attempts=processing_attempts,
            persistence_attempts=persistence_attempts,
            records_detected=page.records_detected,
            records_extracted=page.records_extracted,
            review_records=page.review_records,
            persisted=False,
            warnings=warnings,
            error_code=last_error.code,
            error_message=last_error.message,
        )

    async def process_pages(self, requests: list[PageWorkRequest]) -> list[PageWorkOutcome]:
        """Process requests independently so one failed page cannot stop the batch."""

        outcomes: list[PageWorkOutcome] = []
        for request in requests:
            try:
                outcomes.append(await self.process_page(request))
            except Exception:
                logger.exception(
                    "Unexpected page worker failure",
                    extra={
                        "document_id": str(request.document_id),
                        "physical_page_number": request.physical_page_number,
                    },
                )
                outcomes.append(
                    PageWorkOutcome(
                        document_id=request.document_id,
                        processing_run_id=request.processing_run_id,
                        physical_page_number=request.physical_page_number,
                        status=PagePersistenceStatus.FAILED,
                        processing_attempts=1,
                        persistence_attempts=0,
                        records_detected=0,
                        records_extracted=0,
                        review_records=0,
                        persisted=False,
                        error_code="unexpected_page_error",
                        error_message="Unable to process this page.",
                    )
                )
        return outcomes

