from __future__ import annotations

import hashlib
import json
from datetime import datetime
from uuid import UUID

from app.benchmark.comparison import comparison_report_json
from app.core.exceptions import PipelineSelectionBlockedError
from app.models.common import PipelineVersions
from app.models.field_regions import FieldType
from app.models.ocr_comparison import (
    AggregateOcrMetrics,
    ConfigurationBenchmark,
    OcrComparisonReport,
)
from app.models.pipeline_selection import (
    CandidateGateResult,
    FrozenPipelineManifest,
    PipelineSelectionPolicy,
    PipelineSelectionResult,
)


def comparison_report_sha256(report: OcrComparisonReport) -> str:
    return hashlib.sha256(comparison_report_json(report).encode("utf-8")).hexdigest()


def _evidence_blockers(
    report: OcrComparisonReport,
    policy: PipelineSelectionPolicy,
) -> list[str]:
    blockers: list[str] = []
    if report.ground_truth_checksum_sha256 is None:
        blockers.append("verified GOLD checksum is missing")
    if report.total_cards < policy.minimum_gold_cards:
        blockers.append("verified GOLD card count is below the policy minimum")
    if report.english_cards <= 0:
        blockers.append("English GOLD coverage is missing")
    if report.telugu_cards <= 0:
        blockers.append("Telugu GOLD coverage is missing")
    if set(report.parts_represented) != set(policy.required_parts):
        blockers.append("GOLD coverage does not include every required Part")
    if len(report.configurations) < policy.minimum_configuration_count:
        blockers.append("too few OCR configurations were measured")
    configuration_ids = {
        item.configuration.configuration_id for item in report.configurations
    }
    if len(configuration_ids) != len(report.configurations):
        blockers.append("comparison contains duplicate OCR configuration IDs")
    if (
        len(report.ranked_configuration_ids) != len(configuration_ids)
        or set(report.ranked_configuration_ids) != configuration_ids
    ):
        blockers.append("comparison ranking does not cover every configuration exactly once")
    return blockers


def _metric_reasons(
    metrics: AggregateOcrMetrics,
    policy: PipelineSelectionPolicy,
    scope: str,
) -> list[str]:
    reasons: list[str] = []
    for field_type, minimum in policy.minimum_exact_accuracy_by_field.items():
        measured = metrics.fields[field_type].exact_accuracy
        if measured is None:
            reasons.append(f"{scope} {field_type.value} exact accuracy is unmeasured")
        elif measured < minimum:
            reasons.append(f"{scope} {field_type.value} exact accuracy is below policy")
    for field_type, maximum in policy.maximum_character_error_rate.items():
        measured = metrics.fields[field_type].character_error_rate
        if measured is None:
            reasons.append(f"{scope} {field_type.value} CER is unmeasured")
        elif measured > maximum:
            reasons.append(f"{scope} {field_type.value} CER exceeds policy")
    for field_type, maximum in policy.maximum_word_error_rate.items():
        measured = metrics.fields[field_type].word_error_rate
        if measured is None:
            reasons.append(f"{scope} {field_type.value} WER is unmeasured")
        elif measured > maximum:
            reasons.append(f"{scope} {field_type.value} WER exceeds policy")
    return reasons


def _candidate_reasons(
    report_metrics: ConfigurationBenchmark,
    policy: PipelineSelectionPolicy,
) -> list[str]:
    reasons = _metric_reasons(report_metrics.overall, policy, "overall")
    for language in policy.required_languages:
        reasons.extend(
            _metric_reasons(
                report_metrics.by_language[language],
                policy,
                f"language:{language.value}",
            )
        )
    total = report_metrics.overall.total_cases
    if not total:
        reasons.append("configuration has no evaluated GOLD cards")
        return reasons
    failure_rate = report_metrics.overall.extraction_failure_count / total
    if failure_rate > policy.maximum_extraction_failure_rate:
        reasons.append("extraction failure rate exceeds policy")
    evaluated_fields = report_metrics.overall.evaluated_field_count
    if not evaluated_fields:
        reasons.append("configuration has no evaluated GOLD fields")
    else:
        empty_rate = report_metrics.overall.empty_ocr_count / evaluated_fields
        if empty_rate > policy.maximum_empty_ocr_rate:
            reasons.append("empty OCR rate exceeds policy")
    if policy.maximum_runtime_ms_per_card is not None:
        runtime_per_card = report_metrics.overall.runtime_ms / total
        if runtime_per_card > policy.maximum_runtime_ms_per_card:
            reasons.append("runtime per card exceeds policy")
    return reasons


def select_pipeline_candidate(
    report: OcrComparisonReport,
    policy: PipelineSelectionPolicy,
) -> PipelineSelectionResult:
    """Select the first ranked candidate that passes explicit evidence gates."""

    blockers = _evidence_blockers(report, policy)
    if blockers:
        raise PipelineSelectionBlockedError(
            "Pipeline selection is blocked by insufficient benchmark evidence.",
            blocker_count=len(blockers),
            blockers=blockers,
        )
    by_id = {
        item.configuration.configuration_id: item
        for item in report.configurations
    }
    candidate_results: list[CandidateGateResult] = []
    for rank, configuration_id in enumerate(report.ranked_configuration_ids, start=1):
        reasons = _candidate_reasons(by_id[configuration_id], policy)
        candidate_results.append(
            CandidateGateResult(
                configuration_id=configuration_id,
                report_rank=rank,
                eligible=not reasons,
                rejection_reasons=reasons,
            )
        )
    selected = next(
        (candidate for candidate in candidate_results if candidate.eligible),
        None,
    )
    if selected is None:
        raise PipelineSelectionBlockedError(
            "No measured OCR configuration passes the selection policy.",
            candidate_count=len(candidate_results),
        )
    return PipelineSelectionResult(
        source_report_sha256=comparison_report_sha256(report),
        selected_configuration_id=selected.configuration_id,
        policy=policy,
        candidates=candidate_results,
    )


def freeze_selected_pipeline(
    report: OcrComparisonReport,
    selection: PipelineSelectionResult,
    processing_versions: PipelineVersions,
    *,
    approved_by: UUID,
    approved_at: datetime,
    decision_reason: str,
    manifest_version: str = "1.0.0",
) -> FrozenPipelineManifest:
    """Create an auditable manifest; callers must persist/activate it explicitly."""

    report_hash = comparison_report_sha256(report)
    if selection.source_report_sha256 != report_hash:
        raise PipelineSelectionBlockedError(
            "The selection does not belong to this comparison report."
        )
    selected = next(
        (
            item
            for item in report.configurations
            if item.configuration.configuration_id
            == selection.selected_configuration_id
        ),
        None,
    )
    if selected is None:
        raise PipelineSelectionBlockedError(
            "The selected OCR configuration is missing from the report."
        )
    if report.ground_truth_checksum_sha256 is None:
        raise PipelineSelectionBlockedError(
            "A verified GOLD checksum is required before freezing a pipeline."
        )
    return FrozenPipelineManifest(
        manifest_version=manifest_version,
        source_report_sha256=report_hash,
        ground_truth_checksum_sha256=report.ground_truth_checksum_sha256,
        selection_policy=selection.policy,
        selected_configuration=selected.configuration,
        selected_metrics=selected,
        processing_versions=processing_versions,
        approved_by=approved_by,
        approved_at=approved_at,
        decision_reason=decision_reason,
    )


def frozen_manifest_json(manifest: FrozenPipelineManifest) -> str:
    """Return deterministic, privacy-safe JSON suitable for versioned storage."""

    return json.dumps(
        manifest.model_dump(mode="json"),
        ensure_ascii=False,
        indent=2,
        sort_keys=True,
    ) + "\n"


def frozen_manifest_sha256(manifest: FrozenPipelineManifest) -> str:
    return hashlib.sha256(frozen_manifest_json(manifest).encode("utf-8")).hexdigest()

