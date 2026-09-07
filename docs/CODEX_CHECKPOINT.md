# JANASOOCHI Codex Checkpoint

## Current Phase

Phase 2B — Deterministic Card Segmentation

## Completed

- Added typed rendered-pixel `BoundingBox`, `CardRegion`,
  `PageSegmentationResult`, and page-isolated batch result contracts.
- Added deterministic three-column by up-to-ten-row grid segmentation.
- Detects voter content below page headers and above footers from visible grid
  boundaries rather than splitting the full physical page blindly.
- Validates exactly three columns, one to ten consistent rows, positive and
  in-page geometry, consistent dimensions, ordered boundaries, and row-major
  output.
- Removes empty candidate cells using deterministic inner-region ink checks;
  pages may produce zero through thirty validated cards.
- Added typed invalid-geometry and unsupported-page-layout failures using the
  existing Phase 2A exception hierarchy.
- Added batch segmentation that records an expected failure for one physical
  page and continues with all other pages.
- Added an internal, in-memory debug PNG overlay with card boxes and positional
  labels. No debug endpoint or persisted image was added.
- Advertised only the implemented deterministic segmentation capability through
  the health contract and advanced the pipeline/preprocessing versions.
- No OCR, voter fields, database migration, production UI, or source data was
  added or changed.

## Tests

- Focused Phase 2B segmentation tests: PASS — 11/11.
- Complete extraction-service regression: PASS — 28/28, including all 17
  pre-existing Phase 2A tests.
- Python compile check for `app` and `tests`: PASS.
- Covered full 3x10 layout, row-major ordering, bbox validity, partial final
  row, shorter pages, empty/non-voter page, malformed geometry, unsupported
  layout, deterministic repeatability, page-failure isolation, and debug PNG.
- Web application tests/build were not rerun because this sprint changed no web,
  Supabase, RLS, or production UI files.

## Segmentation

- Algorithm: grayscale copy, dark-line projections, regularly spaced horizontal
  boundary selection, four-boundary/three-column geometry selection, then
  deterministic per-cell inner-content validation.
- Bounding boxes: integer `x1, y1, x2, y2` values in the existing rendered PNG
  pixel coordinate system.
- Full-page behavior: a validated ten-row, three-column grid with content in all
  cells returns 30 row-major card regions.
- Partial-page behavior: shorter grids and empty final cells return only regions
  with plausible content; candidates are never promoted merely to meet an
  expected Part total.
- `card_index` is a one-based page-position index only and never an authoritative
  voter serial number.

## Files Changed

- `services/extraction-api/app/__init__.py`
- `services/extraction-api/app/api/health.py`
- `services/extraction-api/app/core/config.py`
- `services/extraction-api/app/core/exceptions.py`
- `services/extraction-api/app/models/segmentation.py`
- `services/extraction-api/app/vision/__init__.py`
- `services/extraction-api/app/vision/segmentation.py`
- `services/extraction-api/app/vision/debug.py`
- `services/extraction-api/tests/segmentation_fixtures.py`
- `services/extraction-api/tests/test_segmentation.py`
- `services/extraction-api/tests/test_health.py`
- `services/extraction-api/README.md`
- `docs/CODEX_CHECKPOINT.md`

## Known Limitations

- Tests use synthetic, non-sensitive layouts. The boundary thresholds still need
  validation against a small authorized EN/TE representative-page benchmark
  kept outside Git before full-roll processing.
- Phase 2B intentionally handles fixed, visible three-column voter grids. It does
  not yet deskew strongly rotated pages or infer layouts with missing structural
  lines.
- Content validation establishes that a region is non-empty; OCR and semantic
  voter-card validation are intentionally deferred.
- Urdu remains only a validated language contract. Real Urdu processing remains
  blocked until valid `%PDF-` source files are supplied.
- FastAPI/Starlette emits two upstream test-client deprecation warnings. Pytest
  also warns that its optional local cache directory is not writable; neither
  warning affects the 28 passing tests.

## Next Exact Task

Phase 2C — Field-Region Extraction / Card Parsing Foundation

Define deterministic field-region crops inside validated card boxes, preserve
page-relative coordinates, add typed raw field-region contracts and synthetic
tests, and do not add OCR, ML, DL, AI, or full-roll processing.
