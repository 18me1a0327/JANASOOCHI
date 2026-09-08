# JANASOOCHI Codex Checkpoint

## Current Phase

Phase 2F — Human-Verified Benchmark / Ground Truth (PARTIAL)

## Completed

- Added strict typed contracts for benchmark records, field layers, datasets,
  and Part/language coverage.
- Preserved RAW OCR, deterministic NORMALIZED values, and human-entered GOLD
  values as separate immutable layers.
- Required revision code, ground-truth version, supported Part and serial,
  English/Telugu source language, PDF SHA-256, physical page, card index,
  optional printed page/bounding box, human verifier UUID, and timezone-aware
  verification timestamp.
- Enforced current-revision serial ranges: Part 227 = 1–1014, Part 228 =
  1–973, Part 229 = 1–888, and Part 230 = 1–579.
- Rejected Urdu, unsupported Parts, out-of-range serials, malformed source
  evidence, invalid human audit metadata, implausible verified ages,
  non-canonical relation types, mismatched GOLD serials, duplicate case IDs,
  and duplicate Part/Serial/language identities.
- Added a UTF-8 CSV importer with a 5 MiB limit, exact schema validation, safe
  row-level errors, and import SHA-256.
- Added coverage reporting for all eight EN/TE Part groups and the roadmap's
  approximate 480-card target without producing an accuracy field.
- Added a privacy-safe CLI that prints only checksum, counts, gaps, and
  warnings—not voter values.
- Added a header-only CSV template containing no voter records and documented
  the private annotation workflow.
- Added Git ignore safeguards for populated ground-truth CSV/JSON files.
- Advanced the service to `0.6.0` and pipeline to `2.5.0`; advertised only
  the implemented `benchmark.ground_truth_import_v1` capability.
- Added no voter data, voter-card images, accuracy claims, database migration,
  Supabase/RLS change, web UI change, or production deployment change.

## Tests

- Focused ground-truth/health tests: PASS — 17/17.
- Complete local extraction-service regression: PASS — 76 passed, 2 host-only
  Tesseract runtime skips (78 collected).
- Python compile check for `app` and `tests`: PASS.
- Docker GitHub Actions regression: PASS — 78/78 tests.
- Docker production runtime image build: PASS.
- Docker runtime `/api/v1/health` check: PASS.
- Final CI evidence:
  https://github.com/18me1a0327/JANASOOCHI/actions/runs/34220988255
- Covered RAW/NORMALIZED/GOLD separation, explicit source nulls, Part/language
  restrictions, serial ranges, verifier audit requirements, GOLD field
  validation, duplicate detection, coverage gaps, no accuracy output,
  header-only template safety, malformed imports, source bbox validation, and
  privacy-safe CLI output.
- Reproduced a working-directory-dependent template test and fixed it by
  resolving the template relative to the test module.
- Reproduced a Docker-only missing-template failure and fixed it by copying
  `docs` into the test stage only; the production runtime remains unchanged.
- Reproduced an extra trailing newline introduced during remote text upload and
  replaced the CSV through a byte-preserving Base64 blob upload. The final
  Docker run passed.
- Web tests/build were not rerun because no web, Supabase, RLS, or UI file was
  changed.

## Ground-Truth Contract

- Languages: English and Telugu only.
- Identity inside this revision: Part + Serial + source language.
- Evidence: source PDF checksum + physical page + card index + optional bbox.
- RAW: exact OCR/source text as supplied; never modified.
- NORMALIZED: deterministic values derived from RAW during import.
- GOLD: manually verified values only; never inferred from RAW/NORMALIZED.
- Audit: human method, Supabase verifier UUID, timezone-aware timestamp.
- Coverage: counts and missing Part/language groups only.
- Accuracy: intentionally unavailable until real verified records exist.

## Files Changed

- `.gitignore`
- `services/extraction-api/app/__init__.py`
- `services/extraction-api/app/api/health.py`
- `services/extraction-api/app/benchmark/__init__.py`
- `services/extraction-api/app/benchmark/__main__.py`
- `services/extraction-api/app/benchmark/ground_truth.py`
- `services/extraction-api/app/core/config.py`
- `services/extraction-api/app/core/exceptions.py`
- `services/extraction-api/app/models/ground_truth.py`
- `services/extraction-api/docs/GROUND_TRUTH.md`
- `services/extraction-api/docs/ground-truth-template.csv`
- `services/extraction-api/Dockerfile`
- `services/extraction-api/tests/test_ground_truth.py`
- `services/extraction-api/tests/test_health.py`
- `services/extraction-api/README.md`
- `docs/CODEX_CHECKPOINT.md`

## Known Limitations / Blocking Evidence

- No authorized, manually verified English/Telugu benchmark rows were supplied
  in this sprint. The repository contains zero populated ground-truth records.
- Because GOLD is absent, no OCR field accuracy, CER, WER, engine comparison,
  or 95–100% accuracy claim can be calculated.
- The approximate 480-card roadmap target has not started; statistical
  representativeness cannot be claimed from framework tests.
- Populated ground truth must remain private and outside Git.
- Phase 2G is blocked until at least a small real, human-verified EN/TE subset
  spanning Parts 227–230 passes this validator.
- Urdu remains blocked until valid `%PDF-` Urdu source files and processing
  support exist.
- FastAPI/Starlette emits two upstream test-client deprecation warnings. They do
  not affect the 78 passing Docker tests.

## Next Exact Task

Phase 2F continuation — First Authorized Human-Verified Subset

Copy the header-only template to private storage, manually verify a small
representative English and Telugu subset spanning Parts 227–230 against exact
source PDF pages/cards, validate it with `python -m app.benchmark <private.csv>`,
and provide only the private authorized file through a secure workspace path.
Do not commit it. Do not begin Phase 2G or report accuracy until this evidence
passes validation.

