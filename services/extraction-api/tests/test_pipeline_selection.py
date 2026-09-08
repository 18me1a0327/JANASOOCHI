from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

import pytest
from pydantic import ValidationError

from app.benchmark.comparison import compare_ocr_configurations
from app.benchmark.selection import (
    freeze_selected_pipeline,
    frozen_manifest_json,
    frozen_manifest_sha256,
    select_pipeline_candidate,
)
from app.core.exceptions import PipelineSelectionBlockedError
from app.models.common import PipelineVersions, SourceLanguage
from app.models.field_regions import FieldType, TARGET_FIELD_TYPES
from app.models.ground_truth import (
    GROUND_TRUTH_FIELD_MAP,
    GroundTruthFieldValues,
    GroundTruthRecord,
)
from app.models.ocr import OcrEngine
from app.models.ocr_comparison import OcrCaseObservation, OcrConfiguration
from app.models.pipeline_selection import PipelineSelectionPolicy
from app.ocr.normalization import normalize_ocr_value


def _values(serial: int, **updates: str | None) -> GroundTruthFieldValues:
    values: dict[str, str | None] = {
        "serial_number": str(serial),
        "epic": f"ABC{serial:07d}",
        "voter_name": "Verified Person",
        "relation_name": "Verified Relation",
        "relation_type": "Father",
        "house_number": "1-2",
        "age": "42",
        "gender": "Male",
    }
    values.update(updates)
    return GroundTruthFieldValues(**values)


def _record(part: int, language: SourceLanguage, serial: int) -> GroundTruthRecord:
    gold = _values(serial)
    raw = gold.model_copy(deep=True)
    normalized = GroundTruthFieldValues(
        **{
            name: normalize_ocr_value(getattr(raw, name), field_type)
            for name, field_type in GROUND_TRUTH_FIELD_MAP.items()
        }
    )
    return GroundTruthRecord(
        case_id=f"case-{part}-{language.value}-{serial}",
        revision_code="synthetic-revision",
        ground_truth_version="1.0.0",
        part_number=part,
        serial_number=serial,
        source_language=language,
        source_document_checksum="a" * 64,
        source_physical_page=2,
        source_card_index=serial,
        raw=raw,
        normalized=normalized,
        gold=gold,
        verified_by=UUID("00000000-0000-0000-0000-000000000001"),
        verified_at=datetime(2026, 9, 8, tzinfo=timezone.utc),
    )


def _records() -> list[GroundTruthRecord]:
    return [
        _record(part, language, language_index)
        for part in (227, 228, 229, 230)
        for language_index, language in enumerate(
            (SourceLanguage.ENGLISH, SourceLanguage.TELUGU),
            start=1,
        )
    ]


def _configuration(configuration_id: str) -> OcrConfiguration:
    return OcrConfiguration(
        configuration_id=configuration_id,
        ocr_engine=(
            OcrEngine.TESSERACT
            if configuration_id.startswith("tesseract")
            else OcrEngine.PADDLEOCR
        ),
        ocr_engine_version="synthetic-test",
        preprocessing_configuration="original",
        targeted_retry_enabled=True,
    )


def _observation(
    record: GroundTruthRecord,
    configuration_id: str,
    *,
    final: GroundTruthFieldValues | None = None,
    runtime_ms: float = 10,
) -> OcrCaseObservation:
    return OcrCaseObservation(
        case_id=record.case_id,
        configuration_id=configuration_id,
        baseline=record.gold.model_copy(deep=True),
        final=final or record.gold.model_copy(deep=True),
        runtime_ms=runtime_ms,
        approximate_peak_memory_mb=32,
    )


def _policy(**updates) -> PipelineSelectionPolicy:
    values = {
        "policy_id": "synthetic-policy",
        "policy_version": "1.0.0",
        "minimum_gold_cards": 8,
        "minimum_exact_accuracy_by_field": {
            field_type: 0.70 for field_type in TARGET_FIELD_TYPES
        },
        "maximum_character_error_rate": {
            FieldType.VOTER_NAME: 0.30,
            FieldType.RELATION_NAME: 0.30,
        },
        "maximum_word_error_rate": {
            FieldType.VOTER_NAME: 0.30,
            FieldType.RELATION_NAME: 0.30,
        },
        "maximum_extraction_failure_rate": 0.10,
        "maximum_empty_ocr_rate": 0.10,
        "maximum_runtime_ms_per_card": 100,
    }
    values.update(updates)
    return PipelineSelectionPolicy(**values)


def _report(
    *,
    bad_epic_for: str | None = None,
    bad_telugu_name_for: str | None = None,
    runtimes: dict[str, float] | None = None,
):
    records = _records()
    configuration_ids = ("tesseract-original", "paddle-original")
    observations: list[OcrCaseObservation] = []
    for configuration_id in configuration_ids:
        for record in records:
            final = record.gold.model_copy(deep=True)
            if configuration_id == bad_epic_for:
                final = final.model_copy(update={"epic": "BAD"})
            if (
                configuration_id == bad_telugu_name_for
                and record.source_language == SourceLanguage.TELUGU
                and record.part_number == 227
            ):
                final = final.model_copy(update={"voter_name": "Wrong Name"})
            observations.append(
                _observation(
                    record,
                    configuration_id,
                    final=final,
                    runtime_ms=(runtimes or {}).get(configuration_id, 10),
                )
            )
    return compare_ocr_configurations(
        records,
        [_configuration(item) for item in configuration_ids],
        observations,
        revision_code="synthetic-revision",
        ground_truth_checksum_sha256="b" * 64,
    )


def test_empty_phase_2g_report_blocks_selection() -> None:
    empty = compare_ocr_configurations([], [], [])
    with pytest.raises(PipelineSelectionBlockedError) as captured:
        select_pipeline_candidate(empty, _policy())
    assert "verified GOLD checksum is missing" in captured.value.details["blockers"]


def test_missing_language_or_part_coverage_blocks_selection() -> None:
    record = _record(227, SourceLanguage.ENGLISH, 1)
    report = compare_ocr_configurations(
        [record],
        [_configuration("tesseract-original"), _configuration("paddle-original")],
        [
            _observation(record, "tesseract-original"),
            _observation(record, "paddle-original"),
        ],
        ground_truth_checksum_sha256="b" * 64,
    )
    with pytest.raises(PipelineSelectionBlockedError):
        select_pipeline_candidate(report, _policy(minimum_gold_cards=1))


def test_policy_requires_explicit_gates_for_every_field() -> None:
    with pytest.raises(ValidationError):
        _policy(minimum_exact_accuracy_by_field={FieldType.EPIC: 0.9})


def test_critical_epic_gate_rejects_a_candidate() -> None:
    report = _report(bad_epic_for="tesseract-original")
    report = report.model_copy(
        update={"ranked_configuration_ids": ["tesseract-original", "paddle-original"]}
    )
    selection = select_pipeline_candidate(report, _policy())
    assert selection.selected_configuration_id == "paddle-original"
    rejected = selection.candidates[0]
    assert rejected.eligible is False
    assert any("epic exact accuracy" in reason for reason in rejected.rejection_reasons)


def test_language_gate_prevents_overall_average_from_hiding_telugu_error() -> None:
    report = _report(bad_telugu_name_for="tesseract-original")
    policy = _policy(
        minimum_exact_accuracy_by_field={
            field_type: (0.80 if field_type == FieldType.VOTER_NAME else 0.70)
            for field_type in TARGET_FIELD_TYPES
        }
    )
    selection = select_pipeline_candidate(report, policy)
    candidate = next(
        item for item in selection.candidates if item.configuration_id == "tesseract-original"
    )
    assert candidate.eligible is False
    assert "language:te voter_name exact accuracy is below policy" in candidate.rejection_reasons


def test_no_candidate_passing_policy_blocks_freeze() -> None:
    report = _report(bad_epic_for="tesseract-original")
    failing = next(
        item
        for item in report.configurations
        if item.configuration.configuration_id == "tesseract-original"
    )
    paddle = next(
        item
        for item in report.configurations
        if item.configuration.configuration_id == "paddle-original"
    )
    report = report.model_copy(
        update={
            "configurations": [
                failing,
                paddle.model_copy(
                    update={
                        "overall": failing.overall,
                        "by_language": failing.by_language,
                    }
                ),
            ]
        }
    )
    with pytest.raises(PipelineSelectionBlockedError):
        select_pipeline_candidate(report, _policy())


def test_runtime_gate_can_skip_the_first_ranked_candidate() -> None:
    report = _report(
        runtimes={"tesseract-original": 150, "paddle-original": 10}
    ).model_copy(
        update={"ranked_configuration_ids": ["tesseract-original", "paddle-original"]}
    )
    selection = select_pipeline_candidate(
        report,
        _policy(maximum_runtime_ms_per_card=100),
    )
    assert selection.selected_configuration_id == "paddle-original"


def test_freeze_manifest_captures_exact_versions_metrics_and_audit() -> None:
    report = _report()
    selection = select_pipeline_candidate(report, _policy())
    versions = PipelineVersions(
        pipeline_version="2.6.0",
        preprocessing_version="1.3.0",
        parser_version="1.1.0",
        ocr_engine="paddleocr",
        ocr_engine_version="synthetic-test",
    )
    manifest = freeze_selected_pipeline(
        report,
        selection,
        versions,
        approved_by=UUID("00000000-0000-0000-0000-000000000002"),
        approved_at=datetime(2026, 9, 8, tzinfo=timezone.utc),
        decision_reason="Synthetic test approval only",
    )
    assert manifest.status == "frozen"
    assert manifest.selected_configuration.configuration_id == selection.selected_configuration_id
    assert manifest.processing_versions == versions
    assert manifest.ground_truth_checksum_sha256 == "b" * 64


def test_freeze_rejects_selection_from_another_report() -> None:
    report = _report()
    selection = select_pipeline_candidate(report, _policy())
    tampered = report.model_copy(update={"revision_code": "different-revision"})
    with pytest.raises(PipelineSelectionBlockedError):
        freeze_selected_pipeline(
            tampered,
            selection,
            PipelineVersions(
                pipeline_version="2.6.0",
                preprocessing_version="1.3.0",
                parser_version="1.1.0",
            ),
            approved_by=UUID("00000000-0000-0000-0000-000000000002"),
            approved_at=datetime(2026, 9, 8, tzinfo=timezone.utc),
            decision_reason="Synthetic test approval only",
        )


def test_freeze_requires_timezone_aware_approval() -> None:
    report = _report()
    selection = select_pipeline_candidate(report, _policy())
    with pytest.raises(ValidationError):
        freeze_selected_pipeline(
            report,
            selection,
            PipelineVersions(
                pipeline_version="2.6.0",
                preprocessing_version="1.3.0",
                parser_version="1.1.0",
            ),
            approved_by=UUID("00000000-0000-0000-0000-000000000002"),
            approved_at=datetime(2026, 9, 8),
            decision_reason="Synthetic test approval only",
        )


def test_frozen_manifest_serialization_and_checksum_are_deterministic() -> None:
    report = _report()
    selection = select_pipeline_candidate(report, _policy())
    arguments = {
        "approved_by": UUID("00000000-0000-0000-0000-000000000002"),
        "approved_at": datetime(2026, 9, 8, tzinfo=timezone.utc),
        "decision_reason": "Synthetic test approval only",
    }
    versions = PipelineVersions(
        pipeline_version="2.6.0",
        preprocessing_version="1.3.0",
        parser_version="1.1.0",
    )
    first = freeze_selected_pipeline(report, selection, versions, **arguments)
    second = freeze_selected_pipeline(report, selection, versions, **arguments)
    assert frozen_manifest_json(first) == frozen_manifest_json(second)
    assert frozen_manifest_sha256(first) == frozen_manifest_sha256(second)
    assert "Verified Person" not in frozen_manifest_json(first)
    assert "ABC0000001" not in frozen_manifest_json(first)

