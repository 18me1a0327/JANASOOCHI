# OCR Accuracy Comparison

Phase 2G provides a deterministic comparison framework. The repository still
contains no populated human-verified GOLD records, so no real OCR accuracy has
been measured yet.

## Input contract

Call `compare_ground_truth_dataset` with the validated private
`GroundTruthDataset`, a list of `OcrConfiguration` values, and one
`OcrCaseObservation` for every GOLD case and configuration. Each observation
retains baseline and final-after-retry OCR values separately, plus failure
codes, retry count, runtime, and optional approximate peak memory.

Every configuration must contain exactly the same case IDs. Missing, extra,
or duplicate observations fail the comparison instead of silently changing a
denominator. Failed fields must have a null OCR value and remain included in
the field totals.

## Metrics contract

The privacy-safe report contains no voter values. It provides:

- exact normalized accuracy, correct, incorrect, empty, failed, and evaluated
  counts for all eight voter fields;
- corpus CER and WER for voter and relation names;
- invalid-format EPIC count;
- parseable-age count, total absolute age error, and mean absolute age error;
- overall, English, Telugu, and Parts 227–230 aggregates;
- baseline-versus-final retry impact for every field;
- retry rate, extraction failures, empty OCR count, runtime, optional peak
  memory, and deterministic error classifications;
- a deterministic candidate ordering that prioritizes EPIC and Serial before
  Telugu name quality, overall field accuracy, and runtime.

Serialize the result with `comparison_report_json`. JSON keys are sorted and
no timestamp is injected, so the same validated inputs produce identical
output. Populated input and output artifacts must remain in private storage
outside Git.

The existing Data Quality UI is intentionally unchanged in Phase 2G. A later
Phase 4 integration can consume this report contract for field, language,
engine, and retry-effectiveness views without changing metric semantics.

## Current blocker

Phase 2F has no authorized human-verified rows. Tesseract, PaddleOCR, and retry
variants therefore cannot be ranked honestly. Supply a private validated EN/TE
GOLD subset spanning Parts 227–230 before running or publishing this report.

