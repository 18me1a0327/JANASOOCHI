from __future__ import annotations

import csv
import hashlib
import io
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.benchmark.ground_truth import (
    GROUND_TRUTH_CSV_COLUMNS,
    analyze_ground_truth_coverage,
    ground_truth_csv_template,
    load_ground_truth_csv,
)
from app.benchmark.__main__ import main as validate_ground_truth_main
from app.core.exceptions import GroundTruthImportError, GroundTruthValidationError
from app.models.common import SourceLanguage
from app.models.ground_truth import GroundTruthRecord


def _row(**updates: str) -> dict[str, str]:
    row = {column: "" for column in GROUND_TRUTH_CSV_COLUMNS}
    row.update(
        {
            "case_id": "synthetic-227-en-1",
            "revision_code": "synthetic-revision",
            "ground_truth_version": "1.0.0",
            "part_number": "227",
            "serial_number": "1",
            "language": "en",
            "source_document_checksum": "a" * 64,
            "source_physical_page": "2",
            "source_printed_page": "1",
            "source_card_index": "1",
            "bbox_x1": "10",
            "bbox_y1": "20",
            "bbox_x2": "110",
            "bbox_y2": "220",
            "verified_by": "00000000-0000-0000-0000-000000000001",
            "verified_at": "2026-09-08T10:30:00+05:30",
            "verification_note": "Synthetic test fixture only",
            "raw_serial_number": " 001 ",
            "raw_epic": " abc 1234567 ",
            "raw_voter_name": "  SYNTHETIC PERSON  ",
            "raw_relation_name": "  SYNTHETIC RELATION  ",
            "raw_relation_type": "Father",
            "raw_house_number": " 1 - 2 ",
            "raw_age": " 42 ",
            "raw_gender": "Male",
            "gold_serial_number": "1",
            "gold_epic": "ABC1234567",
            "gold_voter_name": "Synthetic Person",
            "gold_relation_name": "Synthetic Relation",
            "gold_relation_type": "Father",
            "gold_house_number": "1-2",
            "gold_age": "42",
            "gold_gender": "Male",
        }
    )
    row.update(updates)
    return row


def _csv(*rows: dict[str, str]) -> bytes:
    output = io.StringIO(newline="")
    writer = csv.DictWriter(
        output,
        fieldnames=GROUND_TRUTH_CSV_COLUMNS,
        lineterminator="\n",
    )
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue().encode("utf-8")


def test_import_preserves_raw_normalized_and_gold_layers() -> None:
    payload = _csv(_row())
    dataset = load_ground_truth_csv(payload)
    record = dataset.records[0]

    assert record.raw.voter_name == "  SYNTHETIC PERSON  "
    assert record.normalized.voter_name == "synthetic person"
    assert record.gold.voter_name == "Synthetic Person"
    assert record.raw is not record.normalized
    assert record.normalized is not record.gold
    assert record.verification_method == "human"
    assert record.verified_at.utcoffset() is not None
    assert record.source_bbox is not None
    assert record.source_bbox.x1 == 10
    assert dataset.import_checksum_sha256 == hashlib.sha256(payload).hexdigest()


def test_missing_source_fields_remain_explicit_nulls() -> None:
    dataset = load_ground_truth_csv(
        _csv(
            _row(
                raw_epic="",
                gold_epic="",
                raw_relation_name="",
                gold_relation_name="",
            )
        )
    )
    record = dataset.records[0]

    assert record.raw.epic is None
    assert record.normalized.epic is None
    assert record.gold.epic is None
    assert record.gold.relation_name is None


@pytest.mark.parametrize(
    ("column", "value"),
    [
        ("part_number", "226"),
        ("serial_number", "1015"),
        ("language", "ur"),
        ("verified_at", "2026-09-08T10:30:00"),
        ("gold_serial_number", "2"),
        ("gold_age", "200"),
        ("gold_relation_type", "Brother"),
    ],
)
def test_invalid_ground_truth_metadata_is_rejected(
    column: str,
    value: str,
) -> None:
    with pytest.raises(GroundTruthValidationError):
        load_ground_truth_csv(_csv(_row(**{column: value})))


def test_duplicate_case_or_part_serial_language_is_rejected() -> None:
    duplicate_case = _row(serial_number="2", gold_serial_number="2")
    with pytest.raises(GroundTruthValidationError):
        load_ground_truth_csv(_csv(_row(), duplicate_case))

    duplicate_identity = _row(case_id="synthetic-second-case")
    with pytest.raises(GroundTruthValidationError):
        load_ground_truth_csv(_csv(_row(), duplicate_identity))


def test_normalized_layer_cannot_be_modified_independently() -> None:
    record = load_ground_truth_csv(_csv(_row())).records[0]
    payload = record.model_dump()
    payload["normalized"]["voter_name"] = "tampered"

    with pytest.raises(ValidationError):
        GroundTruthRecord.model_validate(payload)


def test_coverage_reports_gaps_without_accuracy_claims() -> None:
    record = load_ground_truth_csv(_csv(_row())).records[0]
    coverage = analyze_ground_truth_coverage([record])
    serialized = coverage.model_dump(mode="json")

    assert coverage.total_records == 1
    assert coverage.counts_by_part_language["227:en"] == 1
    assert len(coverage.missing_part_language_groups) == 7
    assert coverage.recommended_target_reached is False
    assert "accuracy" not in serialized


def test_all_part_language_groups_can_be_covered_without_claiming_target() -> None:
    rows: list[dict[str, str]] = []
    for part in (227, 228, 229, 230):
        for language in ("en", "te"):
            rows.append(
                _row(
                    case_id=f"synthetic-{part}-{language}-1",
                    part_number=str(part),
                    language=language,
                )
            )
    dataset = load_ground_truth_csv(_csv(*rows))

    assert dataset.coverage.missing_part_language_groups == []
    assert dataset.coverage.covered_parts == [227, 228, 229, 230]
    assert dataset.coverage.covered_languages == [
        SourceLanguage.ENGLISH,
        SourceLanguage.TELUGU,
    ]
    assert dataset.coverage.recommended_target_reached is False


def test_header_only_template_contains_no_records_and_is_not_importable() -> None:
    template = ground_truth_csv_template()

    template_path = Path(__file__).parents[1] / "docs" / "ground-truth-template.csv"
    assert template == template_path.read_text(encoding="utf-8")
    assert template.count("\n") == 1
    with pytest.raises(GroundTruthImportError):
        load_ground_truth_csv(template.encode("utf-8"))


def test_invalid_headers_encoding_and_incomplete_bbox_are_rejected() -> None:
    with pytest.raises(GroundTruthImportError):
        load_ground_truth_csv(b"not,the,required,header\n1,2,3,4\n")
    with pytest.raises(GroundTruthImportError):
        load_ground_truth_csv(b"\xff\xfe")
    with pytest.raises(GroundTruthValidationError):
        load_ground_truth_csv(_csv(_row(bbox_y2="")))


def test_cli_reports_coverage_without_printing_voter_fields(
    tmp_path,
    capsys,
) -> None:
    private_csv = tmp_path / "authorized-ground-truth.csv"
    private_csv.write_bytes(_csv(_row()))

    assert validate_ground_truth_main([str(private_csv)]) == 0
    output = capsys.readouterr().out
    assert '"status": "valid"' in output
    assert '"record_count": 1' in output
    assert "SYNTHETIC PERSON" not in output
    assert "ABC1234567" not in output

