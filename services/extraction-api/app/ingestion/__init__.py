"""Source-record ingestion, reconciliation, and deterministic quality checks."""

from app.ingestion.quality import analyze_part_quality
from app.ingestion.reconciliation import reconcile_part_sources
from app.ingestion.source_records import build_page_source_records, build_source_record
from app.ingestion.verification import assess_golden_revision

__all__ = [
    "analyze_part_quality",
    "assess_golden_revision",
    "build_page_source_records",
    "build_source_record",
    "reconcile_part_sources",
]

