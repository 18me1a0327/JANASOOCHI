from __future__ import annotations

import json
import re
import unicodedata
from collections import Counter

from app.core.exceptions import BenchmarkComparisonError
from app.models.common import SourceLanguage
from app.models.field_regions import FieldType, TARGET_FIELD_TYPES
from app.models.ground_truth import GroundTruthDataset, GroundTruthRecord
from app.models.ocr_comparison import (
    AggregateOcrMetrics,
    ConfigurationBenchmark,
    FieldAccuracyMetrics,
    OcrCaseObservation,
    OcrComparisonReport,
    OcrConfiguration,
    OcrErrorClass,
    RetryImpact,
)
from app.ocr.normalization import normalize_ocr_value


_TEXT_FIELDS = frozenset({FieldType.VOTER_NAME, FieldType.RELATION_NAME})
_EPIC_PATTERN = re.compile(r"^[A-Z]{3}[0-9]{7}$")
_PUNCTUATION_PATTERN = re.compile(r"[^\w\s]", flags=re.UNICODE)
_CONFUSABLE_PAIRS = frozenset(
    {("O", "0"), ("0", "O"), ("I", "1"), ("1", "I"), ("S", "5"), ("5", "S"), ("B", "8"), ("8", "B"), ("Z", "2"), ("2", "Z")}
)


def edit_distance(reference: list[str] | str, hypothesis: list[str] | str) -> int:
    """Return deterministic Levenshtein distance for characters or tokens."""

    previous = list(range(len(hypothesis) + 1))
    for row, reference_item in enumerate(reference, start=1):
        current = [row]
        for column, hypothesis_item in enumerate(hypothesis, start=1):
            current.append(
                min(
                    current[-1] + 1,
                    previous[column] + 1,
                    previous[column - 1] + (reference_item != hypothesis_item),
                )
            )
        previous = current
    return previous[-1]


def _normalized(value: str | None, field_type: FieldType) -> str | None:
    return normalize_ocr_value(value, field_type) if value is not None else None


def _is_exact(gold: str | None, predicted: str | None, field_type: FieldType) -> bool:
    normalized_gold = _normalized(gold, field_type)
    return normalized_gold is not None and _normalized(predicted, field_type) == normalized_gold


def _classify_error(
    field_type: FieldType,
    language: SourceLanguage,
    gold: str,
    predicted: str | None,
    failure_code: str | None,
) -> OcrErrorClass:
    if failure_code:
        lowered = failure_code.casefold()
        if any(token in lowered for token in ("crop", "layout", "geometry")):
            return OcrErrorClass.CROP_LAYOUT_ISSUE
        if any(token in lowered for token in ("parse", "invalid")):
            return OcrErrorClass.FIELD_PARSER_REJECTION
    normalized_gold = _normalized(gold, field_type) or ""
    normalized_prediction = _normalized(predicted, field_type)
    if normalized_prediction is None:
        return OcrErrorClass.EMPTY_OCR
    if normalized_gold.replace(" ", "") == normalized_prediction.replace(" ", ""):
        return OcrErrorClass.SPACING_ISSUE
    without_punctuation_gold = _PUNCTUATION_PATTERN.sub("", normalized_gold)
    without_punctuation_prediction = _PUNCTUATION_PATTERN.sub("", normalized_prediction)
    if without_punctuation_gold == without_punctuation_prediction:
        return OcrErrorClass.PUNCTUATION_ISSUE
    if len(normalized_gold) == len(normalized_prediction) and any(
        (left.upper(), right.upper()) in _CONFUSABLE_PAIRS
        for left, right in zip(normalized_gold, normalized_prediction, strict=True)
        if left != right
    ):
        return OcrErrorClass.DIGIT_LETTER_CONFUSION
    if language == SourceLanguage.TELUGU and field_type in _TEXT_FIELDS:
        return OcrErrorClass.TELUGU_CHARACTER_CONFUSION
    return OcrErrorClass.WRONG_CHARACTER


def _field_metrics(
    field_type: FieldType,
    pairs: list[tuple[GroundTruthRecord, OcrCaseObservation]],
    *,
    stage: str = "final",
) -> FieldAccuracyMetrics:
    correct = incorrect = missing = failures = invalid_format = 0
    char_errors = char_total = word_errors = word_total = 0
    age_error_total = age_parseable = 0
    total = 0
    for record, observation in pairs:
        gold = getattr(record.gold, field_type.value)
        if gold is None:
            continue
        total += 1
        values = getattr(observation, stage)
        failure_codes = getattr(observation, f"{stage}_failure_codes")
        predicted = getattr(values, field_type.value)
        normalized_gold = _normalized(gold, field_type) or ""
        normalized_prediction = _normalized(predicted, field_type)
        if normalized_prediction is None:
            missing += 1
            failures += field_type in failure_codes
        elif normalized_prediction == normalized_gold:
            correct += 1
        else:
            incorrect += 1
        if field_type in _TEXT_FIELDS:
            hypothesis = normalized_prediction or ""
            char_errors += edit_distance(normalized_gold, hypothesis)
            char_total += len(normalized_gold)
            gold_words = normalized_gold.split()
            word_errors += edit_distance(gold_words, hypothesis.split())
            word_total += len(gold_words)
        if field_type == FieldType.EPIC and normalized_prediction is not None:
            invalid_format += not bool(_EPIC_PATTERN.fullmatch(normalized_prediction))
        if field_type == FieldType.AGE and normalized_prediction is not None:
            try:
                age_error_total += abs(int(normalized_gold) - int(normalized_prediction))
                age_parseable += 1
            except ValueError:
                pass
    return FieldAccuracyMetrics(
        field_type=field_type,
        total_evaluated=total,
        correct_count=correct,
        incorrect_count=incorrect,
        missing_empty_count=missing,
        failure_count=failures,
        exact_accuracy=correct / total if total else None,
        character_error_rate=(char_errors / char_total if char_total else None),
        word_error_rate=(word_errors / word_total if word_total else None),
        invalid_format_count=invalid_format,
        parseable_age_count=age_parseable,
        age_absolute_error_total=(age_error_total if field_type == FieldType.AGE else None),
        age_mean_absolute_error=(age_error_total / age_parseable if age_parseable else None),
    )


def _aggregate(pairs: list[tuple[GroundTruthRecord, OcrCaseObservation]]) -> AggregateOcrMetrics:
    fields = {field_type: _field_metrics(field_type, pairs) for field_type in TARGET_FIELD_TYPES}
    before = {field_type: _field_metrics(field_type, pairs, stage="baseline") for field_type in TARGET_FIELD_TYPES}
    retry_impact: dict[FieldType, RetryImpact] = {}
    errors: Counter[OcrErrorClass] = Counter()
    successful_cards = extraction_failures = retry_cases = 0
    runtime_ms = 0.0
    memory_values: list[float] = []
    for record, observation in pairs:
        final_values = [getattr(observation.final, field.value) for field in TARGET_FIELD_TYPES]
        if any(_normalized(value, field) is not None for value, field in zip(final_values, TARGET_FIELD_TYPES, strict=True)):
            successful_cards += 1
        else:
            extraction_failures += 1
        retry_cases += observation.retry_count > 0
        runtime_ms += observation.runtime_ms
        if observation.approximate_peak_memory_mb is not None:
            memory_values.append(observation.approximate_peak_memory_mb)
        for field_type in TARGET_FIELD_TYPES:
            gold = getattr(record.gold, field_type.value)
            if gold is None:
                continue
            baseline_value = getattr(observation.baseline, field_type.value)
            final_value = getattr(observation.final, field_type.value)
            final_exact = _is_exact(gold, final_value, field_type)
            baseline_exact = _is_exact(gold, baseline_value, field_type)
            if not final_exact:
                errors[
                    _classify_error(
                        field_type,
                        record.source_language,
                        gold,
                        final_value,
                        observation.final_failure_codes.get(field_type),
                    )
                ] += 1
            if observation.retry_count and not baseline_exact:
                errors[OcrErrorClass.RETRY_RECOVERED if final_exact else OcrErrorClass.RETRY_STILL_FAILED] += 1
    for field_type in TARGET_FIELD_TYPES:
        before_metric = before[field_type]
        after_metric = fields[field_type]
        before_accuracy = before_metric.exact_accuracy
        after_accuracy = after_metric.exact_accuracy
        retry_impact[field_type] = RetryImpact(
            field_type=field_type,
            total_evaluated=after_metric.total_evaluated,
            before_correct_count=before_metric.correct_count,
            after_correct_count=after_metric.correct_count,
            before_accuracy=before_accuracy,
            after_accuracy=after_accuracy,
            absolute_improvement=(
                after_accuracy - before_accuracy
                if before_accuracy is not None and after_accuracy is not None
                else None
            ),
        )
    evaluated_fields = sum(metric.total_evaluated for metric in fields.values())
    return AggregateOcrMetrics(
        total_cases=len(pairs),
        successful_card_count=successful_cards,
        extraction_failure_count=extraction_failures,
        evaluated_field_count=evaluated_fields,
        empty_ocr_count=sum(metric.missing_empty_count for metric in fields.values()),
        retry_case_count=retry_cases,
        retry_rate=retry_cases / len(pairs) if pairs else None,
        runtime_ms=runtime_ms,
        approximate_peak_memory_mb=max(memory_values) if memory_values else None,
        fields=fields,
        retry_impact=retry_impact,
        error_class_counts={error_class: errors[error_class] for error_class in OcrErrorClass},
    )


def _ranking_key(benchmark: ConfigurationBenchmark) -> tuple[float, ...]:
    def accuracy(field_type: FieldType) -> float:
        measured = benchmark.overall.fields[field_type].exact_accuracy
        return measured if measured is not None else -1.0

    valid_accuracies = [metric.exact_accuracy for metric in benchmark.overall.fields.values() if metric.exact_accuracy is not None]
    overall = sum(valid_accuracies) / len(valid_accuracies) if valid_accuracies else -1.0
    measured_telugu_name = benchmark.by_language[SourceLanguage.TELUGU].fields[FieldType.VOTER_NAME].exact_accuracy
    telugu_name = measured_telugu_name if measured_telugu_name is not None else -1.0
    return (-accuracy(FieldType.EPIC), -accuracy(FieldType.SERIAL_NUMBER), -telugu_name, -overall, benchmark.overall.runtime_ms)


def compare_ocr_configurations(
    records: list[GroundTruthRecord],
    configurations: list[OcrConfiguration],
    observations: list[OcrCaseObservation],
    *,
    revision_code: str | None = None,
    ground_truth_checksum_sha256: str | None = None,
) -> OcrComparisonReport:
    """Compare configurations on the identical verified case set without logging values."""

    case_map = {record.case_id: record for record in records}
    if len(case_map) != len(records):
        raise BenchmarkComparisonError("Ground-truth case IDs must be unique.")
    config_map = {configuration.configuration_id: configuration for configuration in configurations}
    if len(config_map) != len(configurations):
        raise BenchmarkComparisonError("OCR configuration IDs must be unique.")
    unknown = sorted({item.configuration_id for item in observations} - set(config_map))
    if unknown:
        raise BenchmarkComparisonError("Observations reference an unknown OCR configuration.", count=len(unknown))

    benchmarks: list[ConfigurationBenchmark] = []
    expected_cases = set(case_map)
    for configuration in sorted(configurations, key=lambda item: item.configuration_id):
        selected = [item for item in observations if item.configuration_id == configuration.configuration_id]
        if not configuration.targeted_retry_enabled and any(item.retry_count for item in selected):
            raise BenchmarkComparisonError(
                "A no-retry configuration cannot contain retried observations.",
                configuration_id=configuration.configuration_id,
            )
        selected_map = {item.case_id: item for item in selected}
        if len(selected_map) != len(selected):
            raise BenchmarkComparisonError("Each configuration must contain one observation per GOLD case.")
        if set(selected_map) != expected_cases:
            raise BenchmarkComparisonError(
                "Every OCR configuration must use the identical GOLD case set.",
                configuration_id=configuration.configuration_id,
                missing_case_count=len(expected_cases - set(selected_map)),
                unexpected_case_count=len(set(selected_map) - expected_cases),
            )
        pairs = [(case_map[case_id], selected_map[case_id]) for case_id in sorted(expected_cases)]
        benchmarks.append(
            ConfigurationBenchmark(
                configuration=configuration,
                overall=_aggregate(pairs),
                by_language={
                    language: _aggregate([pair for pair in pairs if pair[0].source_language == language])
                    for language in (SourceLanguage.ENGLISH, SourceLanguage.TELUGU)
                },
                by_part={
                    part: _aggregate([pair for pair in pairs if pair[0].part_number == part])
                    for part in (227, 228, 229, 230)
                },
            )
        )
    ranked = sorted(benchmarks, key=lambda item: (*_ranking_key(item), item.configuration.configuration_id))
    warnings: list[str] = []
    if not records:
        warnings.append("No real OCR accuracy measured yet: verified GOLD records are unavailable.")
    if not configurations:
        warnings.append("No OCR configurations were supplied for comparison.")
    return OcrComparisonReport(
        revision_code=revision_code,
        ground_truth_checksum_sha256=ground_truth_checksum_sha256,
        total_cards=len(records),
        english_cards=sum(record.source_language == SourceLanguage.ENGLISH for record in records),
        telugu_cards=sum(record.source_language == SourceLanguage.TELUGU for record in records),
        parts_represented=sorted({record.part_number for record in records}),
        configurations=benchmarks,
        ranked_configuration_ids=[item.configuration.configuration_id for item in ranked],
        warnings=warnings,
    )


def compare_ground_truth_dataset(
    dataset: GroundTruthDataset,
    configurations: list[OcrConfiguration],
    observations: list[OcrCaseObservation],
) -> OcrComparisonReport:
    return compare_ocr_configurations(
        dataset.records,
        configurations,
        observations,
        revision_code=dataset.revision_code,
        ground_truth_checksum_sha256=dataset.import_checksum_sha256,
    )


def comparison_report_json(report: OcrComparisonReport) -> str:
    """Serialize a privacy-safe, reproducible metrics artifact without voter values."""

    return json.dumps(
        report.model_dump(mode="json"),
        ensure_ascii=False,
        indent=2,
        sort_keys=True,
    ) + "\n"

