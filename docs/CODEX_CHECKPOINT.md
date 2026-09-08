# JANASOOCHI Codex Checkpoint

## Current Phase

Phase 2G — OCR Accuracy Comparison (PARTIAL)

## Status

PARTIAL. The deterministic comparison framework is complete and tested, but
the repository contains zero authorized human-verified GOLD records. No real
OCR engine was scored and no accuracy percentage or winning candidate is
reported.

## Completed

- Added strict typed contracts for OCR configurations, per-case baseline and
  final-after-retry observations, field metrics, aggregates, retry impact,
  ranked configurations, and the machine-readable report.
- Enforced an identical GOLD case set for every compared configuration;
  missing, extra, duplicate, and unknown observations fail safely.
- Included failed and empty OCR outputs in the denominator rather than
  silently excluding them.
- Implemented exact normalized metrics for Serial, EPIC, voter name, relation
  name/type, house, age, and gender.
- Implemented corpus Character Error Rate and Word Error Rate for voter and
  relation names.
- Implemented EPIC invalid-format counts plus parseable age count, total
  absolute age error, and mean absolute age error.
- Added overall, English, Telugu, and Parts 227–230 aggregation.
- Added baseline-versus-final targeted-retry accuracy and absolute improvement
  for every field.
- Added retry rate, extraction failure count, empty OCR count, runtime, optional
  approximate peak memory, successful card count, and deterministic error
  classifications.
- Added deterministic privacy-safe JSON serialization containing metrics only,
  never RAW OCR or GOLD voter values.
- Added deterministic candidate ranking that prioritizes EPIC and Serial,
  followed by Telugu name quality, overall field accuracy, and runtime. This
  ranking is not populated without real measured inputs.
- Added `benchmark.ocr_comparison_v1`; service version is `0.7.0` and pipeline
  version is `2.6.0`.
- Added comparison documentation without any hard-coded benchmark numbers.
- Did not change Auth, roles, Search, Review, Administration, logo, PWA,
  deployment, Supabase schema, or RLS.

## Benchmark

- GOLD cards: 0
- English cards: 0
- Telugu cards: 0
- Parts represented: none
- Real configurations compared: none
- Tesseract: not measured
- PaddleOCR: not measured
- Targeted retry: not measured against GOLD
- Real OCR accuracy measured: no

## Metrics

- Exact field accuracy: framework implemented; real values unavailable
- CER/WER: framework implemented; real values unavailable
- Failures/empty outputs: included by contract; real values unavailable
- Retry improvement: framework implemented; real values unavailable
- Runtime/resource observations: supported by contract; real values unavailable

## Artifacts / Results

- `services/extraction-api/app/models/ocr_comparison.py`
- `services/extraction-api/app/benchmark/comparison.py`
- `services/extraction-api/tests/test_ocr_comparison.py`
- `services/extraction-api/docs/OCR_COMPARISON.md`
- No populated comparison JSON was generated because doing so would imply a
  measurement without verified GOLD input.

## Tests

- Focused OCR comparison and health tests: PASS — 17 passed.
- Complete extraction-service regression: PASS — 92 passed, 2 host-only
  Tesseract runtime skips, 3 upstream/cache warnings.
- Python compile check for `app` and `tests`: PASS.
- Synthetic metric coverage includes perfect and incorrect exact matches,
  missing/failure inclusion, normalization, CER, WER, age error, identical
  engine sample enforcement, retry before/after, EN/TE aggregation, Part-level
  aggregation, empty benchmark safety, EPIC validation/error classification,
  privacy-safe output, deterministic repeatability, and EPIC-first candidate
  ranking.

## Known Limitations / Blocking Evidence

- No authorized, manually verified English/Telugu benchmark rows are available.
- The repository contains only the header-only annotation template and no real
  voter record, voter-card crop, source PDF, or populated benchmark artifact.
- Tesseract, PaddleOCR, and preprocessing/retry variants cannot be ranked until
  the same private verified GOLD cases are processed by each configuration.
- No real OCR accuracy has been measured yet.
- Phase 2H cannot select or freeze a winner until this Phase 2G framework is run
  on a validated real Phase 2F subset spanning English, Telugu, and Parts
  227–230.
- Urdu remains outside the Phase 2G benchmark and blocked pending valid source
  files and processing support.
- FastAPI/Starlette emits two upstream test-client deprecation warnings; pytest
  also cannot write its locked local cache. These do not affect passing tests.

## Next Exact Task

Phase 2H — Select and Freeze Winning Extraction Pipeline

Before Phase 2H can proceed, securely supply a private Phase 2F GOLD CSV with a
human-verified EN/TE subset spanning Parts 227–230, validate it, run every OCR
configuration on that identical case set, and generate the private Phase 2G
comparison JSON. Do not commit voter values or source images.

