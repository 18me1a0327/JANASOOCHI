# JANASOOCHI Codex Checkpoint

## Current Phase

Phase 2D — English + Telugu OCR

## Completed

- Added typed OCR engine, field-result, field-failure, card-result, benchmark
  case, and benchmark-summary contracts.
- Added an actual Tesseract subprocess adapter that accepts Phase 2C crops in
  memory through standard input and does not create temporary voter-card files.
- Added deterministic field profiles: numeric recognition for serial/age,
  restricted uppercase alphanumeric recognition for EPIC, English recognition
  for English names, Telugu recognition for Telugu names, and mixed
  Telugu/English recognition for Telugu house-number fields.
- Added a lazy PaddleOCR v3 recognition adapter for the English and Telugu
  mobile recognition models. The optional Paddle runtime is isolated in
  `requirements-paddle.txt` and is not installed or downloaded by the default
  service image.
- Preserved every engine's raw output separately from normalized search values.
  Confidence remains null unless the selected engine returns a real score.
- Added per-field OCR failure isolation so one failed field does not terminate
  the remaining fields on the card.
- Added a small exact-normalized benchmark harness whose denominators come only
  from explicitly supplied expected values; it does not manufacture a
  production accuracy percentage.
- Added narrowly scoped OCR errors for unavailable engines, execution failures,
  malformed output, and unsupported OCR languages.
- Added English and Telugu Tesseract language packs to the Docker runtime and
  verified their presence during image construction.
- Updated the processing versions and health capabilities for the implemented
  Phase 2D behavior.
- Kept Urdu OCR blocked and made no full-roll, database, Supabase, RLS, web UI,
  or production deployment changes.

## Tests

- Focused local OCR suite: PASS — 12 passed, 2 skipped. The two runtime tests
  were skipped because Tesseract is not installed on the Windows host.
- Complete local extraction-service regression: PASS — 52 passed, 2 skipped
  (54 collected).
- Python compile check for `app` and `tests`: PASS.
- Docker GitHub Actions regression: PASS — 54/54 tests, including real
  Tesseract English/Telugu runtime checks.
- Docker production runtime image build: PASS.
- Docker runtime `/api/v1/health` check: PASS.
- CI evidence:
  https://github.com/18me1a0327/JANASOOCHI/actions/runs/34163754952
- Reproduced an invalid Paddle confidence failure and traced it to validation
  occurring only inside the installed backend. Added validation at the adapter
  boundary, then reran the focused suite to PASS.
- Reproduced a stale health-test failure that prohibited every OCR capability.
  Removed only that obsolete Phase 2A assertion, then reran the full regression
  suite to PASS.
- Web tests/build were not rerun because no web, Supabase, RLS, or UI file was
  changed.

## OCR Behavior

- Serial and age: numeric Tesseract whitelist and numeric normalization.
- EPIC: uppercase alphanumeric Tesseract whitelist and normalization.
- English names/relations: English OCR profile.
- Telugu names/relations: Telugu OCR profile.
- Telugu house numbers: mixed `tel+eng` OCR profile.
- Raw OCR text: retained exactly as returned by the engine.
- Normalized text: stored separately for deterministic search/validation use.
- Confidence: actual engine score only; otherwise null.
- PaddleOCR: explicit lazy adapter with injectable backend for deterministic
  tests; no model is silently downloaded by the default service.
- Failure isolation: a field failure becomes a typed failure entry while other
  fields on the card continue.

## Files Changed

- `services/extraction-api/app/__init__.py`
- `services/extraction-api/app/api/health.py`
- `services/extraction-api/app/core/config.py`
- `services/extraction-api/app/core/exceptions.py`
- `services/extraction-api/app/models/ocr.py`
- `services/extraction-api/app/ocr/__init__.py`
- `services/extraction-api/app/ocr/base.py`
- `services/extraction-api/app/ocr/normalization.py`
- `services/extraction-api/app/ocr/tesseract.py`
- `services/extraction-api/app/ocr/paddle.py`
- `services/extraction-api/app/ocr/pipeline.py`
- `services/extraction-api/app/ocr/benchmark.py`
- `services/extraction-api/Dockerfile`
- `services/extraction-api/requirements-paddle.txt`
- `services/extraction-api/tests/test_ocr.py`
- `services/extraction-api/tests/test_health.py`
- `services/extraction-api/README.md`
- `docs/CODEX_CHECKPOINT.md`

## Known Limitations

- Production EN/TE accuracy has not been measured against representative,
  manually verified real voter-card ground truth. A confidence value is not an
  accuracy result.
- The optional PaddleOCR runtime/models are not installed in the default Docker
  image and were not downloaded or benchmarked in this sprint.
- The Docker suite verifies both installed Tesseract language packs and English
  runtime recognition; Telugu raw-value preservation and adapter behavior are
  covered deterministically, while representative Telugu transcription quality
  remains a later benchmark task.
- Phase 2C field templates still require calibration against a small authorized
  representative sample kept outside Git.
- There is no full-document OCR run, persistence integration, retry policy, or
  production accuracy claim in Phase 2D.
- Urdu OCR remains blocked until valid `%PDF-` Urdu source files are supplied
  and verified.
- FastAPI/Starlette emits two upstream test-client deprecation warnings. They do
  not affect the 54 passing Docker tests.

## Next Exact Task

Phase 2E — Targeted OCR Retry / Recovery

Add bounded field/card-level retry orchestration (maximum two retries) using
explicit preprocessing variants and retryability rules. Preserve every attempt,
engine result, and error; never retry an entire document for one failed field;
keep page/job processing resumable; and do not begin full-roll OCR or accuracy
benchmarking.

