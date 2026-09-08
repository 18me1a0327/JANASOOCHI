from __future__ import annotations

from collections import Counter

import pymupdf
import pytest
from pydantic import ValidationError

from app.core.exceptions import (
    EmptyOcrResultError,
    OcrPreprocessingError,
    UnsupportedOcrLanguageError,
)
from app.models.common import SourceLanguage
from app.models.field_regions import FieldRegion, FieldType, RelativeBoundingBox
from app.models.ocr import (
    OcrAttemptStatus,
    OcrEngine,
    OcrFieldResult,
    OcrPreprocessingVariant,
    OcrRetryPolicy,
)
from app.models.segmentation import BoundingBox
from app.ocr.pipeline import recognize_card_fields
from app.ocr.preprocessing import preprocess_field_region
from app.vision.field_regions import extract_card_field_regions
from app.vision.segmentation import segment_page
from tests.segmentation_fixtures import synthetic_voter_page


def _card():
    page = synthetic_voter_page(rows=1, populated_cards=1)
    segmentation = segment_page(page)
    return extract_card_field_regions(
        page,
        segmentation.cards[0],
        SourceLanguage.ENGLISH,
    )


def _result(
    field: FieldRegion,
    language: SourceLanguage,
    version: str,
    raw_value: str,
    confidence: float | None,
) -> OcrFieldResult:
    return OcrFieldResult(
        field_type=field.field_type,
        source_language=language,
        page_bbox=field.page_bbox,
        raw_value=raw_value,
        normalized_value=raw_value.casefold(),
        ocr_engine=OcrEngine.TESSERACT,
        ocr_engine_version="test",
        field_confidence=confidence,
        processing_version=version,
    )


def test_retryable_failure_uses_bounded_variants_and_preserves_attempts() -> None:
    class Adapter:
        engine = OcrEngine.TESSERACT
        engine_version = "test"

        def __init__(self) -> None:
            self.calls: Counter[FieldType] = Counter()

        def recognize(
            self,
            field: FieldRegion,
            language: SourceLanguage,
            version: str,
        ) -> OcrFieldResult:
            self.calls[field.field_type] += 1
            if field.field_type == FieldType.EPIC and self.calls[field.field_type] < 3:
                raise EmptyOcrResultError()
            return _result(field, language, version, field.field_type.value, 0.9)

    adapter = Adapter()
    result = recognize_card_fields(_card(), adapter, "2.4.0")
    epic_attempts = [
        attempt
        for attempt in result.attempts
        if attempt.field_type == FieldType.EPIC
    ]

    assert [attempt.preprocessing_variant for attempt in epic_attempts] == [
        OcrPreprocessingVariant.ORIGINAL,
        OcrPreprocessingVariant.GRAYSCALE_HIGH_CONTRAST,
        OcrPreprocessingVariant.BINARY_OTSU,
    ]
    assert [attempt.status for attempt in epic_attempts] == [
        OcrAttemptStatus.FAILED,
        OcrAttemptStatus.FAILED,
        OcrAttemptStatus.SUCCEEDED,
    ]
    assert next(
        field for field in result.fields if field.field_type == FieldType.EPIC
    ).attempt_number == 3
    assert all(
        count == (3 if field_type == FieldType.EPIC else 1)
        for field_type, count in adapter.calls.items()
    )


def test_maximum_two_retries_marks_retryable_failure_exhausted() -> None:
    class Adapter:
        engine = OcrEngine.TESSERACT
        engine_version = "test"

        def __init__(self) -> None:
            self.calls: Counter[FieldType] = Counter()

        def recognize(
            self,
            field: FieldRegion,
            language: SourceLanguage,
            version: str,
        ) -> OcrFieldResult:
            self.calls[field.field_type] += 1
            if field.field_type == FieldType.AGE:
                raise EmptyOcrResultError()
            return _result(field, language, version, "VALUE", 0.9)

    adapter = Adapter()
    result = recognize_card_fields(_card(), adapter, "2.4.0")
    failure = result.failures[0]

    assert failure.field_type == FieldType.AGE
    assert failure.attempt_count == 3
    assert failure.retryable is True
    assert failure.retry_exhausted is True
    assert adapter.calls[FieldType.AGE] == 3
    assert len(result.fields) == 7


def test_non_retryable_failure_stops_after_original_attempt() -> None:
    class Adapter:
        engine = OcrEngine.TESSERACT
        engine_version = "test"

        def __init__(self) -> None:
            self.calls: Counter[FieldType] = Counter()

        def recognize(
            self,
            field: FieldRegion,
            language: SourceLanguage,
            version: str,
        ) -> OcrFieldResult:
            self.calls[field.field_type] += 1
            if field.field_type == FieldType.RELATION_TYPE:
                raise UnsupportedOcrLanguageError()
            return _result(field, language, version, "VALUE", 0.9)

    adapter = Adapter()
    result = recognize_card_fields(_card(), adapter, "2.4.0")
    failure = result.failures[0]

    assert failure.attempt_count == 1
    assert failure.retryable is False
    assert failure.retry_exhausted is False
    assert adapter.calls[FieldType.RELATION_TYPE] == 1


def test_explicit_low_confidence_retry_selects_best_real_result() -> None:
    class Adapter:
        engine = OcrEngine.TESSERACT
        engine_version = "test"

        def __init__(self) -> None:
            self.calls: Counter[FieldType] = Counter()

        def recognize(
            self,
            field: FieldRegion,
            language: SourceLanguage,
            version: str,
        ) -> OcrFieldResult:
            self.calls[field.field_type] += 1
            if field.field_type == FieldType.VOTER_NAME:
                confidence = 0.42 if self.calls[field.field_type] == 1 else 0.91
                return _result(
                    field,
                    language,
                    version,
                    f"name attempt {self.calls[field.field_type]}",
                    confidence,
                )
            return _result(field, language, version, "VALUE", 0.9)

    result = recognize_card_fields(
        _card(),
        Adapter(),
        "2.4.0",
        OcrRetryPolicy(retry_below_confidence=0.8),
    )
    voter_name = next(
        field for field in result.fields if field.field_type == FieldType.VOTER_NAME
    )
    voter_attempts = [
        attempt
        for attempt in result.attempts
        if attempt.field_type == FieldType.VOTER_NAME
    ]

    assert voter_name.raw_value == "name attempt 2"
    assert voter_name.field_confidence == 0.91
    assert voter_name.attempt_number == 2
    assert [attempt.result.raw_value for attempt in voter_attempts if attempt.result] == [
        "name attempt 1",
        "name attempt 2",
    ]


def test_missing_confidence_is_not_retried_without_explicit_policy() -> None:
    class Adapter:
        engine = OcrEngine.TESSERACT
        engine_version = "test"

        def __init__(self) -> None:
            self.calls: Counter[FieldType] = Counter()

        def recognize(
            self,
            field: FieldRegion,
            language: SourceLanguage,
            version: str,
        ) -> OcrFieldResult:
            self.calls[field.field_type] += 1
            return _result(field, language, version, "VALUE", None)

    adapter = Adapter()
    result = recognize_card_fields(_card(), adapter, "2.4.0")

    assert not result.failures
    assert all(count == 1 for count in adapter.calls.values())
    assert all(field.field_confidence is None for field in result.fields)


def test_preprocessing_variants_are_deterministic_and_do_not_mutate_source() -> None:
    field = _card().fields[0]
    original_bytes = field.crop_png_bytes

    first_contrast = preprocess_field_region(
        field,
        OcrPreprocessingVariant.GRAYSCALE_HIGH_CONTRAST,
    )
    second_contrast = preprocess_field_region(
        field,
        OcrPreprocessingVariant.GRAYSCALE_HIGH_CONTRAST,
    )
    binary = preprocess_field_region(field, OcrPreprocessingVariant.BINARY_OTSU)

    assert field.crop_png_bytes == original_bytes
    assert first_contrast.crop_png_bytes == second_contrast.crop_png_bytes
    assert first_contrast.crop_png_bytes != original_bytes
    assert binary.crop_png_bytes != original_bytes
    for derived in (first_contrast, binary):
        assert derived.page_bbox == field.page_bbox
        assert derived.crop_width == field.crop_width
        assert derived.crop_height == field.crop_height


def test_malformed_retry_crop_becomes_isolated_non_retryable_failure() -> None:
    field = _card().fields[0].model_copy(
        update={"crop_png_bytes": b"\x89PNG\r\n\x1a\nbroken"}
    )

    with pytest.raises(OcrPreprocessingError):
        preprocess_field_region(
            field,
            OcrPreprocessingVariant.GRAYSCALE_HIGH_CONTRAST,
        )


def test_retry_policy_cannot_exceed_two_retries_or_reorder_original() -> None:
    with pytest.raises(ValidationError):
        OcrRetryPolicy(max_retries=3)
    with pytest.raises(ValidationError):
        OcrRetryPolicy(
            max_retries=1,
            variants=(
                OcrPreprocessingVariant.BINARY_OTSU,
                OcrPreprocessingVariant.ORIGINAL,
            ),
        )

