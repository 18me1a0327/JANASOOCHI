# JANASOOCHI Codex Checkpoint

## Current Phase

Phase 2E — Targeted OCR Retry / Recovery

## Completed

- Added a typed `OcrRetryPolicy` with a hard maximum of two retries (three
  total attempts per field).
- Added a fixed deterministic attempt order: original crop,
  grayscale/high-contrast crop, then Otsu-binarized crop.
- Added in-memory preprocessing that keeps the original PNG bytes and
  page-relative bounding box unchanged.
- Retries only the field that failed. Successful fields on the same voter card
  are not rerun, and one exhausted field does not stop the remaining fields.
- Retries expected extraction errors only when their existing exception
  contract marks them retryable. Non-retryable errors stop immediately.
- Added optional low-confidence retry controlled by an explicit caller-supplied
  threshold. No confidence threshold or confidence value is invented.
- Selects the successful attempt with the highest actual engine confidence;
  ties remain stable and deterministic.
- Preserves every attempt with field, attempt number, preprocessing variant,
  success result or safe error, and retryability.
- Added terminal failure metadata for attempt count and whether the retry budget
  was exhausted.
- Added typed preprocessing failure handling without exposing decoder stack
  traces through the extraction contract.
- Advanced the service to `0.5.0`, pipeline to `2.4.0`, preprocessing to
  `1.3.0`, and advertised `ocr.targeted_retry_v1` through health.
- Added no page/document-wide retry, full-roll OCR, database migration,
  Supabase/RLS change, web UI change, or production deployment change.

## Tests

- Focused OCR/retry/health tests: PASS — 21 passed, 2 host-only Tesseract
  runtime skips.
- Complete local extraction-service regression: PASS — 60 passed, 2 host-only
  Tesseract runtime skips (62 collected).
- Python compile check for `app` and `tests`: PASS.
- Docker GitHub Actions regression: PASS — 62/62 tests.
- Docker production runtime image build: PASS.
- Docker runtime `/api/v1/health` check: PASS.
- CI evidence:
  https://github.com/18me1a0327/JANASOOCHI/actions/runs/34218422620
- Covered bounded retry count, variant order, retryable recovery,
  non-retryable short circuit, isolated exhausted field, opt-in
  low-confidence retry, best real-confidence selection, missing confidence,
  attempt history, immutable source bytes/geometry, deterministic
  preprocessing, malformed image handling, and invalid policy rejection.
- Reproduced malformed PNG handling: PyMuPDF raised `FzErrorFormat` outside
  the initial exception tuple. Added the PyMuPDF `FzErrorBase` family to the
  safe preprocessing boundary and reran focused and full suites to PASS.
- Web tests/build were not rerun because no web, Supabase, RLS, or UI file was
  changed.

## Retry Contract

- Maximum attempts per field: 3 (original plus no more than 2 retries).
- Attempt 1: `original`.
- Attempt 2: `grayscale_high_contrast`.
- Attempt 3: `binary_otsu`.
- Default retry trigger: an expected exception whose contract is retryable.
- Optional retry trigger: actual confidence below an explicit threshold, or
  missing confidence when the caller explicitly opts in.
- Scope: one page/card/field crop; never the full page or document.
- Persistence boundary: the typed result is serializable for later resumable
  job storage, but Phase 2E does not change the database.

## Files Changed

- `services/extraction-api/app/__init__.py`
- `services/extraction-api/app/api/health.py`
- `services/extraction-api/app/core/config.py`
- `services/extraction-api/app/core/exceptions.py`
- `services/extraction-api/app/models/ocr.py`
- `services/extraction-api/app/ocr/__init__.py`
- `services/extraction-api/app/ocr/pipeline.py`
- `services/extraction-api/app/ocr/preprocessing.py`
- `services/extraction-api/tests/test_health.py`
- `services/extraction-api/tests/test_ocr_retry.py`
- `services/extraction-api/README.md`
- `docs/CODEX_CHECKPOINT.md`

## Known Limitations

- Retry attempts are returned by typed contracts but are not persisted to
  Supabase in this phase.
- Deskew, sharpening, and denoise variants were intentionally not added because
  no representative benchmark evidence yet shows they improve these fixed
  field crops.
- Production EN/TE accuracy remains unmeasured until manually verified,
  representative ground truth exists.
- Phase 2C field templates still require calibration against a small authorized
  representative sample kept outside Git.
- PaddleOCR remains optional and was not downloaded or benchmarked.
- Urdu OCR remains blocked until valid `%PDF-` Urdu source files are supplied
  and verified.
- FastAPI/Starlette emits two upstream test-client deprecation warnings. They do
  not affect the 62 passing Docker tests.

## Next Exact Task

Phase 2F — Human-Verified Benchmark / Ground Truth

Create benchmark-ground-truth contracts and safe import/validation
infrastructure for representative authorized English and Telugu records across
Parts 227–230. Preserve RAW, NORMALIZED, and GOLD separately. Include source
page and verifier audit fields. If real manually verified ground truth is not
available, complete only the framework and report Phase 2F as PARTIAL; never
fabricate accuracy numbers or voter data.

