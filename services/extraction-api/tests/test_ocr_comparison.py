from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

import pytest

from app.benchmark.comparison import (
    compare_ocr_configurations,
    comparison_report_json,
)
from app.core.exceptions import BenchmarkComparisonError
from app.models.common import SourceLanguage
from app.models.field_regions import FieldType
from app.models.ground_truth import (
    GROUND_TRUTH_FIELD_MAP,
    GroundTruthFieldValues,
    GroundTruthRecord,
)
from app.models.ocr import OcrEngine
from app.models.ocr_comparison import (
    OcrCaseObservation,
    OcrConfiguration,
    OcrErrorClass,
)
from app.ocr.normalization import normalize_ocr_value


def _values(**updates: str | None) -> GroundTruthFieldValues:
    values: dict[str, str | None] = {
        "serial_number": "1",
        "epic": "ABC1234567",
        "voter_name": "Sample Person",
        "relation_name": "Sample Relation",
        "relation_type": "Father",
        "house_number": "1-2",
        "age": "42",
        "gender": "Male",
    }
    values.update(updates)
    return GroundTruthFieldValues(**values)


def _record(
    case_id: str = "case-227-en-1",
    *,
    part: int = 227,
    serial: int = 1,
    language: SourceLanguage = SourceLanguage.ENGLISH,
    gold: GroundTruthFieldValues | None = None,
) -> GroundTruthRecord:
    verified = gold or _values(serial_number=str(serial))
    raw = verified.model_copy(deep=True)
    normalized = GroundTruthFieldValues(
        **{
            name: (
                normalize_ocr_value(getattr(raw, name), field_type)
                if getattr(raw, name) is not None
                else None
            )
            for name, field_type in GROUND_TRUTH_FIELD_MAP.items()
        }
    )
    return GroundTruthRecord(
        case_id=case_id,
        revision_code="synthetic-revision",
        ground_truth_version="1.0.0",
        part_number=part,
        serial_number=serial,
        source_language=language,
        source_document_checksum="a" * 64,
        source_physical_page=2,
        source_card_index=1,
        raw=raw,
        normalized=normalized,
        gold=verified,
        verified_by=UUID("00000000-0000-0000-0000-000000000001"),
        verified_at=datetime(2026, 9, 8, tzinfo=timezone.utc),
    )


def _configuration(configuration_id: str = "tesseract-original") -> OcrConfiguration:
    return OcrConfiguration(
        configuration_id=configuration_id,
        ocr_engine=OcrEngine.TESSERACT,
        ocr_engine_version="synthetic-test",
        preprocessing_configuration="original",
        targeted_retry_enabled=True,
    )


def _observation(
    record: GroundTruthRecord,
    *,
    configuration_id: str = "tesseract-original",
    baseline: GroundTruthFieldValues | None = None,
    final: GroundTruthFieldValues | None = None,
    baseline_failure_codes: dict[FieldType, str] | None = None,
    final_failure_codes: dict[FieldType, str] | None = None,
    retry_count: int = 0,
    runtime_ms: float = 10,
) -> OcrCaseObservation:
    return OcrCaseObservation(
        case_id=record.case_id,
        configuration_id=configuration_id,
        baseline=baseline or record.gold.model_copy(deep=True),
        final=final or record.gold.model_copy(deep=True),
        baseline_failure_codes=baseline_failure_codes or {},
        final_failure_codes=final_failure_codes or {},
        retry_count=retry_count,
        runtime_ms=runtime_ms,
        approximate_peak_memory_mb=32,
    )


def _report(record: GroundTruthRecord, observation: OcrCaseObservation):
    return compare_ocr_configurations([record], [_configuration()], [observation])


def test_perfect_exact_match_sample_is_one_hundred_percent() -> None:
    record = _record()
    metrics = _report(record, _observation(record)).configurations[0].overall
    assert all(metric.exact_accuracy == 1 for metric in metrics.fields.values())
    assert metrics.successful_card_count == 1


def test_incorrect_exact_field_uses_the_full_denominator() -> None:
    record = _record()
    final = record.gold.model_copy(update={"gender": "Female"})
    metric = _report(record, _observation(record, final=final)).configurations[0].overall.fields[FieldType.GENDER]
    assert (metric.total_evaluated, metric.correct_count, metric.incorrect_count) == (1, 0, 1)
    assert metric.exact_accuracy == 0


def test_missing_ocr_output_and_failure_are_not_dropped() -> None:
    record = _record()
    missing = record.gold.model_copy(update={"epic": None})
    metric = _report(
        record,
        _observation(record, final=missing, final_failure_codes={FieldType.EPIC: "empty_ocr_result"}),
    ).configurations[0].overall.fields[FieldType.EPIC]
    assert (metric.total_evaluated, metric.missing_empty_count, metric.failure_count) == (1, 1, 1)
    assert metric.exact_accuracy == 0


def test_documented_normalization_is_applied_before_exact_comparison() -> None:
    record = _record(gold=_values(voter_name="Sample Person", epic="ABC1234567"))
    final = record.gold.model_copy(update={"voter_name": "  SAMPLE   PERSON ", "epic": "abc 1234567"})
    metrics = _report(record, _observation(record, final=final)).configurations[0].overall.fields
    assert metrics[FieldType.VOTER_NAME].exact_accuracy == 1
    assert metrics[FieldType.EPIC].exact_accuracy == 1


def test_character_error_rate_is_calculated_for_names() -> None:
    record = _record(gold=_values(voter_name="abcd"))
    final = record.gold.model_copy(update={"voter_name": "abxd"})
    metric = _report(record, _observation(record, final=final)).configurations[0].overall.fields[FieldType.VOTER_NAME]
    assert metric.character_error_rate == pytest.approx(0.25)


def test_word_error_rate_is_calculated_for_names() -> None:
    record = _record(gold=_values(relation_name="one two"))
    final = record.gold.model_copy(update={"relation_name": "one too"})
    metric = _report(record, _observation(record, final=final)).configurations[0].overall.fields[FieldType.RELATION_NAME]
    assert metric.word_error_rate == pytest.approx(0.5)


def test_age_absolute_numeric_error_is_reported() -> None:
    record = _record(gold=_values(age="42"))
    final = record.gold.model_copy(update={"age": "45"})
    metric = _report(record, _observation(record, final=final)).configurations[0].overall.fields[FieldType.AGE]
    assert metric.parseable_age_count == 1
    assert metric.age_absolute_error_total == 3
    assert metric.age_mean_absolute_error == 3


def test_engine_comparison_requires_the_identical_gold_case_set() -> None:
    first = _record()
    second = _record("case-228-en-2", part=228, serial=2)
    configs = [_configuration(), _configuration("paddle-original")]
    observations = [
        _observation(first),
        _observation(second),
        _observation(first, configuration_id="paddle-original"),
    ]
    with pytest.raises(BenchmarkComparisonError):
        compare_ocr_configurations([first, second], configs, observations)


def test_complete_engine_comparison_uses_every_gold_case() -> None:
    first = _record()
    second = _record("case-228-en-2", part=228, serial=2)
    configs = [_configuration(), _configuration("paddle-original")]
    observations = [
        _observation(first),
        _observation(second),
        _observation(first, configuration_id="paddle-original"),
        _observation(second, configuration_id="paddle-original"),
    ]
    report = compare_ocr_configurations([first, second], configs, observations)
    assert [item.overall.total_cases for item in report.configurations] == [2, 2]


def test_targeted_retry_before_after_improvement_is_measured() -> None:
    record = _record()
    baseline = record.gold.model_copy(update={"epic": "ABC1234568"})
    impact = _report(
        record,
        _observation(record, baseline=baseline, retry_count=1),
    ).configurations[0].overall.retry_impact[FieldType.EPIC]
    assert impact.before_accuracy == 0
    assert impact.after_accuracy == 1
    assert impact.absolute_improvement == 1


def test_english_and_telugu_are_aggregated_separately() -> None:
    english = _record()
    telugu = _record(
        "case-227-te-2",
        serial=2,
        language=SourceLanguage.TELUGU,
        gold=_values(serial_number="2", voter_name="పరీక్ష పేరు"),
    )
    report = compare_ocr_configurations(
        [english, telugu],
        [_configuration()],
        [_observation(english), _observation(telugu)],
    )
    summary = report.configurations[0].by_language
    assert summary[SourceLanguage.ENGLISH].total_cases == 1
    assert summary[SourceLanguage.TELUGU].total_cases == 1


def test_part_level_aggregation_includes_all_supported_parts() -> None:
    part_227 = _record()
    part_230 = _record("case-230-en-2", part=230, serial=2)
    report = compare_ocr_configurations(
        [part_227, part_230],
        [_configuration()],
        [_observation(part_227), _observation(part_230)],
    )
    parts = report.configurations[0].by_part
    assert parts[227].total_cases == 1
    assert parts[228].total_cases == 0
    assert parts[230].total_cases == 1


def test_empty_benchmark_is_safe_and_contains_no_accuracy_claim() -> None:
    report = compare_ocr_configurations([], [_configuration()], [])
    assert report.total_cards == 0
    assert report.configurations[0].overall.fields[FieldType.EPIC].exact_accuracy is None
    assert report.warnings == ["No real OCR accuracy measured yet: verified GOLD records are unavailable."]


def test_comparison_output_is_deterministic_and_privacy_safe() -> None:
    record = _record()
    arguments = ([record], [_configuration()], [_observation(record)])
    first = comparison_report_json(compare_ocr_configurations(*arguments))
    second = comparison_report_json(compare_ocr_configurations(*arguments))
    assert first == second
    assert "Sample Person" not in first
    assert "ABC1234567" not in first


def test_invalid_epic_and_error_classes_are_reported() -> None:
    record = _record()
    baseline = record.gold.model_copy(update={"epic": "ABC123456O"})
    final = record.gold.model_copy(update={"epic": "BAD"})
    aggregate = _report(
        record,
        _observation(record, baseline=baseline, final=final, retry_count=1),
    ).configurations[0].overall
    assert aggregate.fields[FieldType.EPIC].invalid_format_count == 1
    assert aggregate.error_class_counts[OcrErrorClass.WRONG_CHARACTER] == 1
    assert aggregate.error_class_counts[OcrErrorClass.RETRY_STILL_FAILED] == 1


def test_candidate_ranking_prioritizes_epic_over_speed() -> None:
    record = _record()
    wrong_epic = record.gold.model_copy(update={"epic": "ABC1234568"})
    report = compare_ocr_configurations(
        [record],
        [_configuration("fast-bad-epic"), _configuration("slow-good-epic")],
        [
            _observation(
                record,
                configuration_id="fast-bad-epic",
                final=wrong_epic,
                runtime_ms=1,
            ),
            _observation(
                record,
                configuration_id="slow-good-epic",
                runtime_ms=100,
            ),
        ],
    )
    assert report.ranked_configuration_ids == ["slow-good-epic", "fast-bad-epic"]

