from __future__ import annotations

from app.core.exceptions import ExtractionError
from app.models.field_regions import CardFieldRegions, FieldRegion
from app.models.ocr import (
    CardOcrResult,
    OcrAttemptError,
    OcrAttemptStatus,
    OcrFieldAttempt,
    OcrFieldFailure,
    OcrFieldResult,
    OcrRetryPolicy,
)
from app.ocr.base import OcrAdapter
from app.ocr.preprocessing import preprocess_field_region


def _should_retry_result(
    result: OcrFieldResult,
    policy: OcrRetryPolicy,
) -> bool:
    if result.field_confidence is None:
        return policy.retry_when_confidence_missing
    return (
        policy.retry_below_confidence is not None
        and result.field_confidence < policy.retry_below_confidence
    )


def _best_result(results: list[OcrFieldResult]) -> OcrFieldResult:
    """Prefer the highest real confidence and keep the earliest result on ties."""

    return max(
        results,
        key=lambda result: (
            result.field_confidence
            if result.field_confidence is not None
            else -1.0
        ),
    )


def _recognize_field_with_retries(
    field: FieldRegion,
    card: CardFieldRegions,
    adapter: OcrAdapter,
    processing_version: str,
    policy: OcrRetryPolicy,
) -> tuple[OcrFieldResult | None, OcrFieldFailure | None, list[OcrFieldAttempt]]:
    attempts: list[OcrFieldAttempt] = []
    successful_results: list[OcrFieldResult] = []
    variants = policy.variants[: policy.max_retries + 1]

    for attempt_number, variant in enumerate(variants, start=1):
        try:
            prepared_field = preprocess_field_region(field, variant)
            recognized = adapter.recognize(
                prepared_field,
                card.source_language,
                processing_version,
            )
            result = recognized.model_copy(
                update={
                    "attempt_number": attempt_number,
                    "preprocessing_variant": variant,
                }
            )
            successful_results.append(result)
            attempts.append(
                OcrFieldAttempt(
                    field_type=field.field_type,
                    attempt_number=attempt_number,
                    preprocessing_variant=variant,
                    status=OcrAttemptStatus.SUCCEEDED,
                    result=result,
                )
            )
            has_another_attempt = attempt_number < len(variants)
            if not has_another_attempt or not _should_retry_result(result, policy):
                return _best_result(successful_results), None, attempts
        except ExtractionError as exc:
            attempts.append(
                OcrFieldAttempt(
                    field_type=field.field_type,
                    attempt_number=attempt_number,
                    preprocessing_variant=variant,
                    status=OcrAttemptStatus.FAILED,
                    error=OcrAttemptError(
                        error_code=exc.code,
                        message=exc.message,
                        retryable=exc.retryable,
                    ),
                )
            )
            has_another_attempt = attempt_number < len(variants)
            if exc.retryable and has_another_attempt:
                continue
            if successful_results:
                return _best_result(successful_results), None, attempts
            return (
                None,
                OcrFieldFailure(
                    field_type=field.field_type,
                    error_code=exc.code,
                    message=exc.message,
                    retryable=exc.retryable,
                    attempt_count=attempt_number,
                    retry_exhausted=exc.retryable and not has_another_attempt,
                ),
                attempts,
            )

    if successful_results:
        return _best_result(successful_results), None, attempts
    raise RuntimeError("OCR retry loop ended without a result or expected failure")


def recognize_card_fields(
    card: CardFieldRegions,
    adapter: OcrAdapter,
    processing_version: str,
    retry_policy: OcrRetryPolicy | None = None,
) -> CardOcrResult:
    """Recognize fields independently with at most two targeted retries each."""

    policy = retry_policy or OcrRetryPolicy()
    fields: list[OcrFieldResult] = []
    failures: list[OcrFieldFailure] = []
    attempts: list[OcrFieldAttempt] = []
    for field in card.fields:
        result, failure, field_attempts = _recognize_field_with_retries(
            field,
            card,
            adapter,
            processing_version,
            policy,
        )
        attempts.extend(field_attempts)
        if result is not None:
            fields.append(result)
        if failure is not None:
            failures.append(failure)
    return CardOcrResult(
        physical_page_number=card.physical_page_number,
        card_index=card.card_index,
        source_language=card.source_language,
        fields=fields,
        failures=failures,
        attempts=attempts,
    )

