"""Human-verified benchmark infrastructure. Contains no voter data."""

from app.benchmark.ground_truth import (
    GROUND_TRUTH_CSV_COLUMNS,
    analyze_ground_truth_coverage,
    ground_truth_csv_template,
    load_ground_truth_csv,
)
from app.benchmark.comparison import (
    compare_ground_truth_dataset,
    compare_ocr_configurations,
    comparison_report_json,
    edit_distance,
)
from app.benchmark.selection import (
    comparison_report_sha256,
    freeze_selected_pipeline,
    frozen_manifest_json,
    frozen_manifest_sha256,
    select_pipeline_candidate,
)

__all__ = [
    "GROUND_TRUTH_CSV_COLUMNS",
    "analyze_ground_truth_coverage",
    "ground_truth_csv_template",
    "load_ground_truth_csv",
    "compare_ground_truth_dataset",
    "compare_ocr_configurations",
    "comparison_report_json",
    "edit_distance",
    "comparison_report_sha256",
    "freeze_selected_pipeline",
    "frozen_manifest_json",
    "frozen_manifest_sha256",
    "select_pipeline_candidate",
]

