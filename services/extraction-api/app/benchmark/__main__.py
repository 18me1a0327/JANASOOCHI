from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from app.benchmark.ground_truth import load_ground_truth_csv
from app.core.exceptions import GroundTruthImportError


def main(arguments: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Validate an authorized JANASOOCHI human ground-truth CSV without "
            "printing voter fields."
        )
    )
    parser.add_argument("csv_path", type=Path)
    options = parser.parse_args(arguments)

    try:
        payload = options.csv_path.read_bytes()
        dataset = load_ground_truth_csv(payload)
    except OSError:
        print("Unable to read the ground-truth CSV.", file=sys.stderr)
        return 1
    except GroundTruthImportError as exc:
        print(exc.message, file=sys.stderr)
        return 1

    print(
        json.dumps(
            {
                "status": "valid",
                "revision_code": dataset.revision_code,
                "import_checksum_sha256": dataset.import_checksum_sha256,
                "record_count": dataset.coverage.total_records,
                "counts_by_part_language": dataset.coverage.counts_by_part_language,
                "missing_part_language_groups": (
                    dataset.coverage.missing_part_language_groups
                ),
                "recommended_target_reached": (
                    dataset.coverage.recommended_target_reached
                ),
                "warnings": dataset.coverage.warnings,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

