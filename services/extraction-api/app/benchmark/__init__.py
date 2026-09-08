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

__all__ = [
    "GROUND_TRUTH_CSV_COLUMNS",
    "analyze_ground_truth_coverage",
    "ground_truth_csv_template",
    "load_ground_truth_csv",
    "compare_ground_truth_dataset",
    "compare_ocr_configurations",
    "comparison_report_json",
    "edit_distance",
]

