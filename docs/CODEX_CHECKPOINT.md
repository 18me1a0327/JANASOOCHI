# JANASOOCHI Codex Checkpoint

## Current Phase

Phase 2C — Field-Region Extraction / Card Parsing Foundation

## Completed

- Added typed `FieldType`, normalized `RelativeBoundingBox`, `FieldRegion`,
  `CardFieldRegions`, per-card failure, and page result contracts.
- Added all eight required target regions: serial number, EPIC, voter name,
  relation name, relation type, house number, age, and gender.
- Added explicit, versioned English and Telugu fixed-card templates using
  normalized card coordinates. Urdu intentionally has no Phase 2C template.
- Converted normalized card coordinates to deterministic rendered-page integer
  `x1, y1, x2, y2` bounding boxes while keeping every box inside its parent
  card.
- Added lossless in-memory PNG cropping from the original rendered page without
  altering the source image or writing sensitive crops to disk.
- Added page-level extraction that isolates an invalid card and continues all
  remaining valid cards.
- Added safe typed failures for unsupported templates, invalid field geometry,
  field extraction, and rendered-page/segmentation contract mismatch.
- Added an in-memory development overlay for parent-card and field boxes. It is
  not persisted and no public API endpoint was added.
- Advanced the service/pipeline/preprocessing versions and advertised only the
  implemented EN/TE field-region capability through `/health`.
- No OCR, confidence values, voter values, parsing inference, database change,
  web UI change, or production deployment change was introduced.

## Tests

- Focused Phase 2C field-region tests: PASS — 12/12.
- Complete extraction-service regression: PASS — 40/40, including all 28
  pre-existing Phase 2A/2B tests.
- Python compile check for `app` and `tests`: PASS.
- Covered normal EN geometry, explicit TE geometry, normalized scaling, actual
  PNG crop dimensions, card containment, invalid geometry, unsupported Urdu
  template, deterministic repeatability, per-card failure isolation, page
  contract mismatch, non-voter pages, source immutability, and debug overlay.
- Initial scaling assertion was reproduced and traced to expected one-pixel
  floor/ceil quantization at different resolutions. The assertion was corrected
  to a one-pixel tolerance and the focused and full suites were rerun to PASS.
- Web tests/build were not rerun because no web, Supabase, RLS, or UI file was
  changed.

## Field-Region Contract

- Template representation: normalized zero-to-one coordinates relative to the
  validated parent card.
- Output representation: both normalized coordinates and integer rendered-page
  pixel `x1, y1, x2, y2` coordinates.
- Crop behavior: PNG bytes exist only in memory; no filesystem/database storage
  helper or endpoint was added.
- Ordering: the eight target fields have a stable typed contract order.
- Language behavior: EN and TE use separately identified templates. A future
  template may evolve independently without translating or replacing source
  content.
- Failure behavior: invalid cards produce typed failure rows while valid cards
  from the same page continue.

## Files Changed

- `services/extraction-api/app/__init__.py`
- `services/extraction-api/app/api/health.py`
- `services/extraction-api/app/core/config.py`
- `services/extraction-api/app/core/exceptions.py`
- `services/extraction-api/app/models/field_regions.py`
- `services/extraction-api/app/vision/__init__.py`
- `services/extraction-api/app/vision/field_regions.py`
- `services/extraction-api/app/vision/debug.py`
- `services/extraction-api/tests/segmentation_fixtures.py`
- `services/extraction-api/tests/test_field_regions.py`
- `services/extraction-api/tests/test_health.py`
- `services/extraction-api/README.md`
- `docs/CODEX_CHECKPOINT.md`

## Known Limitations

- Field template ratios are verified with synthetic, non-sensitive fixtures.
  They must be calibrated against a small authorized representative set of real
  English and Telugu cards kept outside Git before OCR benchmarking.
- Phase 2C extracts image regions only. It does not recognize text, parse voter
  fields, infer missing values, or report accuracy/confidence.
- Strongly rotated/damaged pages and cards without the Phase 2B fixed grid remain
  outside the deterministic template contract.
- Urdu field extraction remains blocked until valid `%PDF-` Urdu source files
  and their card geometry are verified.
- FastAPI/Starlette emits two upstream test-client deprecation warnings. Pytest
  also reports its optional local cache directory is not writable; neither
  affects the 40 passing tests.

## Next Exact Task

Phase 2D — English + Telugu OCR

Add field-specific OCR adapter contracts and a small EN/TE benchmark harness for
the in-memory Phase 2C crops. Preserve raw OCR exactly, report confidence only
when supplied by the real engine, use synthetic or authorized fixtures outside
Git, and do not run full-roll OCR, ML, DL, or AI.
