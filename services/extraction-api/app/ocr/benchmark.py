from __future__ import annotations

from app.core.exceptions import ExtractionError
from app.models.ocr import OcrBenchmarkCase, OcrBenchmarkSummary
from app.ocr.base import OcrAdapter


def benchmark_adapter(
    adapter: OcrAdapter,
    cases: list[OcrBenchmarkCase],
    processing_version: str,
) -> OcrBenchmarkSummary:
    """Measure exact normalized accuracy only against explicitly supplied truth."""

    completed = 0
    exact_matches = 0
    failures = 0
    for case in cases:
        try:
            result = adapter.recognize(
                case.field_region,
                case.source_language,
                processing_version,
            )
        except ExtractionError:
            failures += 1
            continue
        completed += 1
        if result.normalized_value == case.expected_normalized_value:
            exact_matches += 1
    total = len(cases)
    return OcrBenchmarkSummary(
        ocr_engine=adapter.engine,
        ocr_engine_version=adapter.engine_version,
        total_cases=total,
        completed_cases=completed,
        exact_matches=exact_matches,
        failures=failures,
        exact_accuracy=exact_matches / total if total else None,
    )
