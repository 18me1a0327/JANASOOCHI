# JANASOOCHI Codex Checkpoint

## Current Phase

Phase 2H — Select and Freeze Winning Extraction Pipeline (PARTIAL)

## Status

PARTIAL. The evidence gate, deterministic selection contract, and auditable
freeze-manifest framework are complete and tested. No OCR engine was selected,
frozen, or activated because Phase 2F contains zero authorized human-verified
GOLD records and Phase 2G contains no real measured candidates.

## Completed

- Added a strict `PipelineSelectionPolicy` requiring caller-supplied quality
  limits rather than hidden or fabricated accuracy thresholds.
- Requires Parts 227–230, English and Telugu, a verified GOLD checksum,
  configurable minimum GOLD card/configuration counts, exact-accuracy gates for
  all eight fields, CER/WER gates for names, extraction-failure and empty-output
  limits, and an optional runtime-per-card limit.
- Applies field metrics overall and independently to English and Telugu so an
  overall average cannot hide weak Telugu or a critical EPIC/Serial result.
- Validates that every measured configuration appears exactly once in the
  Phase 2G ranking.
- Selects the first ranked candidate that passes every explicit gate; blocks
  safely when evidence is incomplete or no candidate qualifies.
- Added candidate eligibility and privacy-safe rejection-reason contracts.
- Added deterministic comparison-report hashing so a selection cannot be
  reused with a different or modified report.
- Added an auditable `FrozenPipelineManifest` containing the exact engine,
  engine version, preprocessing/retry configuration, metrics snapshot, quality
  policy, GOLD/report checksums, processing versions, approver UUID,
  timezone-aware approval time, and decision reason.
- Added deterministic manifest JSON and SHA-256 generation containing no voter
  values.
- Recomputes the selection from the source report and policy during freeze so a
  fabricated/tampered eligibility result cannot be persisted.
- Requires the frozen processing engine and engine version to match the exact
  selected configuration, and rejects blank approval reasons.
- Manifest creation does not persist or activate a pipeline implicitly.
- Added `benchmark.pipeline_selection_gate_v1`; service version is `0.8.0` and
  pipeline version is `2.7.0`.
- Added focused documentation and tests.
- Did not change Auth, roles, Search, Review, Administration, logo, PWA,
  deployment, Supabase schema, RLS, or production OCR configuration.

## Selection / Freeze Result

- GOLD cards: 0
- English cards: 0
- Telugu cards: 0
- Parts represented: none
- Real measured candidates: 0
- Selected configuration: none
- Frozen manifest: none
- Production OCR engine: unset
- Real OCR accuracy measured: no

## Artifacts

- `services/extraction-api/app/models/pipeline_selection.py`
- `services/extraction-api/app/benchmark/selection.py`
- `services/extraction-api/tests/test_pipeline_selection.py`
- `services/extraction-api/docs/PIPELINE_SELECTION.md`
- No populated freeze manifest was generated or committed.

## Tests

- Focused Phase 2G/2H comparison, selection, and health tests: PASS — 30 passed.
- Complete extraction-service regression: PASS — 105 passed, 2 host-only
  Tesseract runtime skips, 3 upstream/cache warnings.
- Python compile check for `app` and `tests`: PASS.
- Covered empty/incomplete benchmark blocking, required field gates, EPIC-first
  safety, per-language Telugu protection, no-eligible-candidate behavior,
  runtime limits, exact config/version/metrics/audit capture, report-tamper
  rejection, selection recomputation, engine/version consistency, timezone
  enforcement, deterministic serialization/checksums, and absence of voter
  values in manifests.
- Reproduced one synthetic test failure caused by assuming configuration list
  order; fixed the fixture to select the failing candidate by stable ID, then
  reran all focused and full regression tests successfully.

## Known Limitations / Blocking Evidence

- No authorized, manually verified English/Telugu GOLD rows are available.
- Tesseract, PaddleOCR, preprocessing variants, and targeted retry have not
  been scored on the same real GOLD cases.
- No real Phase 2G comparison JSON exists, so no evidence-based winner can be
  selected or frozen.
- A production policy still needs explicit, authorized quality thresholds.
- Phase 2H must remain PARTIAL until the private Phase 2F/2G evidence passes
  these gates and an authorized approver records the decision.
- Urdu remains outside the benchmark/freeze decision pending valid source files
  and implemented processing support.
- FastAPI/Starlette emits two upstream test-client deprecation warnings; pytest
  cannot write its locked local cache. These do not affect passing tests.

## Next Exact Task

Phase 2F/2G Evidence Run — First Real Measured Candidate Set

Securely supply a private validated human-verified EN/TE GOLD subset spanning
Parts 227–230. Run Tesseract, PaddleOCR, and targeted-retry configurations on
the identical cases, generate the private Phase 2G comparison JSON, define the
authorized production quality policy, and rerun Phase 2H to create the first
real freeze manifest. Do not commit voter values, PDFs, or card images.

