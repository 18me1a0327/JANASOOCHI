# JANASOOCHI Codex Checkpoint

## Current Phase

Phase 2 - Extraction foundation

## Completed In This Sprint

- FastAPI service skeleton under `services/extraction-api`
- Docker runtime and test targets
- Typed environment configuration
- Explicit extraction exception hierarchy and safe API error envelopes
- Health endpoint with processing-version metadata
- `%PDF-` magic-byte validation
- SHA-256 checksum generation
- Part 227-230, English/Telugu/Urdu, revision and page-count validation
- PyMuPDF single physical-page PNG rendering
- Typed asynchronous processing-job contracts
- Existing `processing_runs` row mapping without a schema change
- Matching TypeScript Documents-to-worker contracts
- Focused GitHub Actions workflow that builds/tests the Docker test target and
  verifies the runtime container health endpoint

## Tests

- Extraction API: PASS - 17 tests
- Python compile check: PASS
- Live local Uvicorn startup and `/api/v1/health`: PASS
- Existing web TypeScript: PASS
- Existing web lint: PASS
- Existing web tests: PASS - 39 tests, 1 intentionally skipped OCR fixture
- Local Docker execution: NOT RUN - Docker CLI is unavailable on this host.
  GitHub Actions Docker test/runtime build and health verification are pending
  the packaging regression fix recorded below.

## Current Task

Sprint complete. The repository is ready for the next exact task below.

## Not Started

- Supabase-backed job repository and authenticated worker boundary
- 3x10 voter-card segmentation
- field-region crops
- English/Telugu OCR
- field parser and validation
- targeted field/card retry execution
- manually verified benchmark fixtures and accuracy report
- benchmark and processing-detail UI

## Do Not Rebuild

- Supabase Auth and role permissions
- Search
- Documents UI and current browser-side fallback
- Review foundation
- Data Quality foundation
- Administration
- PDF source viewer
- existing RLS and voter data

## Known Issues

- The development job repository is in process only. It must be replaced by the
  existing Supabase `processing_runs` table before production worker deployment.
- OCR is deliberately not configured. Health and job responses report no OCR
  engine instead of claiming OCR capability or accuracy.
- No real electoral-roll PDF or voter data is committed to the repository.
- FastAPI/Starlette currently emits two upstream deprecation warnings from its
  test client. They do not affect the service or the 17 passing tests.
- The first GitHub Docker build failed because `.dockerignore` excluded the
  focused tests. The root cause was reproduced and the exclusion was removed;
  the corrected CI run is pending.

## Next Exact Task

Implement deterministic 3-column x 10-row voter-card segmentation for a small,
authorized set of representative English and Telugu source pages. Preserve
one-based physical page numbers and normalized bounding boxes, continue after an
individual card failure, add focused synthetic geometry tests plus authorized
page fixtures outside Git, and update this checkpoint. Do not implement full-roll
OCR, ML, DL, or AI in that sprint.
