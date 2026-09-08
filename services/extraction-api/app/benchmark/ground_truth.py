from __future__ import annotations

import csv
import hashlib
import io

from pydantic import ValidationError

from app.core.exceptions import GroundTruthImportError, GroundTruthValidationError
from app.models.common import SourceLanguage
from app.models.field_regions import FieldType
from app.models.ground_truth import (
    EXPECTED_PART_SERIAL_MAX,
    GROUND_TRUTH_FIELD_MAP,
    GroundTruthCoverage,
    GroundTruthDataset,
    GroundTruthFieldValues,
    GroundTruthRecord,
)
from app.models.segmentation import BoundingBox
from app.ocr.normalization import normalize_ocr_value


MAX_GROUND_TRUTH_CSV_BYTES = 5 * 1024 * 1024

_FIELD_NAMES = tuple(GROUND_TRUTH_FIELD_MAP)
_BBOX_COLUMNS = ("bbox_x1", "bbox_y1", "bbox_x2", "bbox_y2")
GROUND_TRUTH_CSV_COLUMNS = (
    "case_id",
    "revision_code",
    "ground_truth_version",
    "part_number",
    "serial_number",
    "language",
    "source_document_checksum",
    "source_physical_page",
    "source_printed_page",
    "source_card_index",
    *_BBOX_COLUMNS,
    "verified_by",
    "verified_at",
    "verification_note",
    *(f"raw_{name}" for name in _FIELD_NAMES),
    *(f"gold_{name}" for name in _FIELD_NAMES),
)


def ground_truth_csv_template() -> str:
    """Return a header-only annotation template containing no voter records."""

    output = io.StringIO(newline="")
    csv.writer(output, lineterminator="\n").writerow(GROUND_TRUTH_CSV_COLUMNS)
    return output.getvalue()


def _required(row: dict[str, str | None], column: str, row_number: int) -> str:
    value = row.get(column)
    if value is None or not value.strip():
        raise GroundTruthValidationError(
            f"Ground-truth row {row_number} is missing required metadata.",
            row_number=row_number,
            column=column,
        )
    return value.strip()


def _optional_source_value(row: dict[str, str | None], column: str) -> str | None:
    value = row.get(column)
    return None if value is None or value == "" else value


def _optional_integer(
    row: dict[str, str | None],
    column: str,
    row_number: int,
) -> int | None:
    value = row.get(column)
    if value is None or not value.strip():
        return None
    try:
        return int(value.strip())
    except ValueError as exc:
        raise GroundTruthValidationError(
            f"Ground-truth row {row_number} contains invalid numeric metadata.",
            row_number=row_number,
            column=column,
        ) from exc


def _source_bbox(
    row: dict[str, str | None],
    row_number: int,
) -> BoundingBox | None:
    values = [row.get(column) for column in _BBOX_COLUMNS]
    present = [value is not None and bool(value.strip()) for value in values]
    if not any(present):
        return None
    if not all(present):
        raise GroundTruthValidationError(
            f"Ground-truth row {row_number} has an incomplete source bounding box.",
            row_number=row_number,
        )
    try:
        return BoundingBox(
            x1=int(values[0].strip()),  # type: ignore[union-attr]
            y1=int(values[1].strip()),  # type: ignore[union-attr]
            x2=int(values[2].strip()),  # type: ignore[union-attr]
            y2=int(values[3].strip()),  # type: ignore[union-attr]
        )
    except (TypeError, ValueError, ValidationError) as exc:
        raise GroundTruthValidationError(
            f"Ground-truth row {row_number} has an invalid source bounding box.",
            row_number=row_number,
        ) from exc


def _field_values(
    row: dict[str, str | None],
    prefix: str,
) -> GroundTruthFieldValues:
    return GroundTruthFieldValues(
        **{
            name: _optional_source_value(row, f"{prefix}_{name}")
            for name in _FIELD_NAMES
        }
    )


def _normalized_values(raw: GroundTruthFieldValues) -> GroundTruthFieldValues:
    values: dict[str, str | None] = {}
    for attribute, field_type in GROUND_TRUTH_FIELD_MAP.items():
        raw_value = getattr(raw, attribute)
        values[attribute] = (
            normalize_ocr_value(raw_value, field_type)
            if raw_value is not None
            else None
        )
    return GroundTruthFieldValues(**values)


def _record_from_row(
    row: dict[str, str | None],
    row_number: int,
) -> GroundTruthRecord:
    raw = _field_values(row, "raw")
    gold = _field_values(row, "gold")
    try:
        return GroundTruthRecord(
            case_id=_required(row, "case_id", row_number),
            revision_code=_required(row, "revision_code", row_number),
            ground_truth_version=_required(
                row,
                "ground_truth_version",
                row_number,
            ),
            part_number=int(_required(row, "part_number", row_number)),
            serial_number=int(_required(row, "serial_number", row_number)),
            source_language=SourceLanguage(
                _required(row, "language", row_number).lower()
            ),
            source_document_checksum=_required(
                row,
                "source_document_checksum",
                row_number,
            ).lower(),
            source_physical_page=int(
                _required(row, "source_physical_page", row_number)
            ),
            source_printed_page=_optional_integer(
                row,
                "source_printed_page",
                row_number,
            ),
            source_card_index=int(
                _required(row, "source_card_index", row_number)
            ),
            source_bbox=_source_bbox(row, row_number),
            raw=raw,
            normalized=_normalized_values(raw),
            gold=gold,
            verified_by=_required(row, "verified_by", row_number),
            verified_at=_required(row, "verified_at", row_number),
            verification_note=_optional_source_value(row, "verification_note"),
        )
    except GroundTruthValidationError:
        raise
    except (ValueError, ValidationError) as exc:
        raise GroundTruthValidationError(
            f"Ground-truth row {row_number} failed validation.",
            row_number=row_number,
        ) from exc


def analyze_ground_truth_coverage(
    records: list[GroundTruthRecord],
) -> GroundTruthCoverage:
    groups = {
        f"{part}:{language.value}": 0
        for part in sorted(EXPECTED_PART_SERIAL_MAX)
        for language in (SourceLanguage.ENGLISH, SourceLanguage.TELUGU)
    }
    for record in records:
        groups[f"{record.part_number}:{record.source_language.value}"] += 1

    covered_parts = sorted({record.part_number for record in records})
    covered_languages = [
        language
        for language in (SourceLanguage.ENGLISH, SourceLanguage.TELUGU)
        if any(record.source_language == language for record in records)
    ]
    missing_groups = [group for group, count in groups.items() if count == 0]
    warnings: list[str] = []
    if missing_groups:
        warnings.append(
            "Representative coverage is missing one or more Part/language groups."
        )
    if len(records) < 480:
        warnings.append(
            "The roadmap target of approximately 480 verified cards has not been reached."
        )

    return GroundTruthCoverage(
        total_records=len(records),
        counts_by_part_language=groups,
        covered_parts=covered_parts,
        covered_languages=covered_languages,
        missing_part_language_groups=missing_groups,
        recommended_target_reached=len(records) >= 480,
        warnings=warnings,
    )


def load_ground_truth_csv(payload: bytes) -> GroundTruthDataset:
    """Validate a human annotation CSV without logging or changing source values."""

    if not payload:
        raise GroundTruthImportError("The ground-truth CSV is empty.")
    if len(payload) > MAX_GROUND_TRUTH_CSV_BYTES:
        raise GroundTruthImportError("The ground-truth CSV exceeds the size limit.")
    if b"\x00" in payload:
        raise GroundTruthImportError("The ground-truth CSV contains invalid bytes.")
    try:
        text = payload.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise GroundTruthImportError(
            "The ground-truth CSV must use UTF-8 encoding."
        ) from exc

    try:
        reader = csv.DictReader(io.StringIO(text, newline=""))
        fieldnames = reader.fieldnames
        if fieldnames is None:
            raise GroundTruthImportError("The ground-truth CSV has no header.")
        if len(fieldnames) != len(set(fieldnames)):
            raise GroundTruthImportError(
                "The ground-truth CSV contains duplicate columns."
            )
        missing = sorted(set(GROUND_TRUTH_CSV_COLUMNS) - set(fieldnames))
        unexpected = sorted(set(fieldnames) - set(GROUND_TRUTH_CSV_COLUMNS))
        if missing or unexpected:
            raise GroundTruthImportError(
                "The ground-truth CSV headers do not match the required template.",
                missing_columns=missing,
                unexpected_columns=unexpected,
            )

        records: list[GroundTruthRecord] = []
        for row_number, row in enumerate(reader, start=2):
            if None in row:
                raise GroundTruthImportError(
                    f"Ground-truth row {row_number} has more values than headers.",
                    row_number=row_number,
                )
            if not any(value not in {None, ""} for value in row.values()):
                raise GroundTruthImportError(
                    f"Ground-truth row {row_number} is blank.",
                    row_number=row_number,
                )
            records.append(_record_from_row(row, row_number))
    except csv.Error as exc:
        raise GroundTruthImportError(
            "The ground-truth CSV structure is invalid."
        ) from exc

    if not records:
        raise GroundTruthImportError(
            "The ground-truth CSV contains no verified records."
        )

    revision_code = records[0].revision_code
    coverage = analyze_ground_truth_coverage(records)
    try:
        return GroundTruthDataset(
            revision_code=revision_code,
            import_checksum_sha256=hashlib.sha256(payload).hexdigest(),
            records=records,
            coverage=coverage,
        )
    except ValidationError as exc:
        raise GroundTruthValidationError(
            "The ground-truth dataset failed cross-record validation."
        ) from exc

