# JANASOOCHI Codex Checkpoint

## Current Phase

Phase 4B — Review Search and Administration Improvements (PASS)

## Status

Phase 4A and Phase 4B are complete and tested on top of the existing Phase 3
ingestion foundation. Review now uses one server-filtered, enriched, keyset-
paginated RPC rather than browser-side ID lists or deep offsets. Correction,
optional source-record verification, one-issue resolution, history, and audit
creation are atomic. Administration includes current-page email/role filtering
and recent audited-export visibility.

Phase 3C real EN/TE execution remains evidence-blocked: Tesseract is unavailable
on this Windows host, Docker is unavailable, and no authorized human-verified
GOLD sample exists. Golden Revision remains correctly blocked by incomplete
source-language coverage, zero verified logical voters, unresolved Review and
reconciliation gates, and incomplete/failed source processing. Phase 4 reports
these conditions; it does not bypass them.

## Phase 4A Completed

- Added pure typed analytics for logical-voter totals, EN/TE source coverage,
  Review severity distribution, missing-field rates, and Golden gates.
- Golden gates cover logical structure, both source languages, missing,
  duplicate and unexpected serials, suspicious EPICs, failed/partial pages,
  reconciliation conflicts, Critical issues, and verification completeness.
- Added Data Quality view filters for Overview, Language Coverage, Review
  Backlog, and Missing Fields while retaining Part and source-language filters.
- Added localized English, Telugu and Urdu analytics copy and blocker labels.
- Added an explicit evidence panel stating that real OCR accuracy is unavailable
  until calculated from authorized human-verified GOLD records.
- No database migration, authentication, RLS, source data, or production
  extraction contract changed.

## Phase 4B Completed

- Added server-side Review search across issue text, name, relation, house,
  EPIC, serial, Part and filename, combined with status, severity, category,
  Part and source-language filters.
- Replaced Review offset navigation with stable `(created_at, id)` keyset
  cursors. One page returns at most 100 fully enriched rows.
- Added active-document scoping so superseded PDF issues do not contaminate the
  current Review queue.
- Added the atomic `save_review_correction_v1` RPC. It retains source values,
  appends correction history, requires a reason, updates corrected values,
  optionally verifies the source record and resolves only the selected issue,
  and writes an audit row in the same transaction.
- Both Phase 4B functions are `SECURITY INVOKER`, explicitly deny `anon`, and
  require the existing administrator role check/RLS.
- Added Review severity/status UI, source opening, correction reasons, mobile-
  safe search/filter controls, and English/Telugu/Urdu interface copy.
- Added Administration email/role filtering for the current page and a recent
  audited-export table; user creation/editing and self-demotion protection are
  unchanged.
- Consolidated browser/server Supabase clients on the current generated schema
  type file and added the new RPC contracts.

## Phase 2 Boundary

The Phase 2 engineering pipeline is complete. The earlier evidence caveat still
applies: the repository contains no populated authorized human-verified GOLD
benchmark and no real Phase 2G winner/freeze manifest. No accuracy percentage
or production OCR winner may be claimed until that private evidence exists.
Representative PDF inspection also found and fixed one real-grid segmentation
defect that the synthetic fixtures had not exposed.

## Completed

- Added strict EN/TE `SourceRecordCandidate` contracts preserving SOURCE,
  RAW, NORMALIZED, source-document/revision, physical/printed page, card index,
  bbox, exact card text, field confidence, OCR engine, and processing versions.
- Phase 3 ingestion explicitly blocks Urdu until its verified extraction path
  exists; it never synthesizes an Urdu representation.
- Added deterministic serial validation against the current revision totals.
  Missing/out-of-range serials remain NULL/unlinked and become Critical review
  candidates; card order is never used as voter serial.
- Added EPIC-format and plausible-age checks that preserve raw values and do
  not invent replacements.
- Added per-card source-record failure isolation so one malformed card does not
  discard valid cards from the same physical page.
- Added Supabase mappings for the existing `voter_records` and resumable
  `page_processing` tables. Confidence is converted from 0–1 to 0–100. The
  mapper never supplies `logical_voter_id`, `verified_by`, `verified_at`, or a
  `verified` status.
- Added EN↔TE reconciliation by Part + Serial with EPIC, house, age, and gender
  corroboration. Names are not compared literally across scripts.
- Structured conflicts, missing language sources, and duplicate same-language
  sources remain explicit and are not safe for automatic linking.
- Added Part/language completeness checks for missing, duplicate, unexpected,
  and invalid serials plus suspicious same-language EPIC reuse.
- Added a strict Golden Revision gate requiring all 3,454 expected slots exactly
  once, both EN/TE sources, both sources verified, reconciliation complete, and
  zero open Critical issues.
- Added stable document/page/card source IDs for idempotent persistence retries.
- Added source-derived Review row mapping without automatic corrections or
  verification.
- Added and applied migrations 013/014. The transactional
  `persist_extracted_page_v1` RPC checkpoints one page, caps records at 30,
  inserts source rows and Review rows, records an audit event, serializes
  concurrent retries, and rejects attempts to overwrite source evidence.
- Restricted the privileged RPC to backend `service_role` only. The Supabase
  security advisor no longer flags it as executable by signed-in users.
- Added and applied migration 015. A `page_processing` integrity trigger now
  rejects pages outside their document, mismatched processing runs, more than
  30 detected cards, extracted counts above detected counts, and review counts
  above extracted counts before any row is written.
- Added a backend Supabase repository supporting current `sb_secret_...` API-key
  headers and legacy service-role JWT compatibility; secrets stay server-only.
- Added a typed `PageIngestionWorker` composing render → segment → fixed field
  crops → targeted OCR → SOURCE/RAW/NORMALIZED candidates → Review mapping →
  atomic page persistence.
- Page-level render/geometry failures retry at most twice; individual card
  failures remain isolated; one failed page cannot stop later page requests.
- Database retries reuse the exact prepared page batch and never rerun OCR.
- The worker refuses an unset or mismatched OCR engine/version contract and
  continues to reject Urdu ingestion.
- Tested real page 7 geometry from 227 EN, 228 TE, and 229 TE. A repeating
  internal-line bug was reproduced and fixed by periodic outer-boundary
  selection. Results were 30 full, 14 valid partial, and 30 full cards.
- Added Phase 3 documentation and health capabilities; extraction service is
  `0.11.0`, pipeline `3.2.0`, parser `2.0.0`.
- Fixed the root lint failure by excluding locked Python cache/virtualenv paths
  from the JavaScript ESLint scan.
- No live voter row was inserted/updated, no record was auto-verified, and no UI
  redesign or deployment change was made.

## Live Aggregate Assessment (2026-09-09)

- Supported EN/TE documents: 8
- Source rows: 6,727
- Expected active logical slots: 3,454
- Quarantined/inactive legacy logical rows: 721
- Source rows currently linked to a logical slot: 5,142
- Verified source rows: 72
- Verified logical slots: 0
- Open Review issues: 4,283 (1,529 Critical; 2,754 Informational)
- Resolved Review issues: 75

Distinct expected serial coverage observed:

- Part 227 EN: 301 / 1,014; TE: 932 / 1,014
- Part 228 EN: 973 / 973; TE: 80 / 973
- Part 229 EN: 888 / 888; TE: 122 / 888
- Part 230 EN: 579 / 579; TE: 547 / 579

These are aggregate integrity measurements, not OCR accuracy. The incomplete
serial coverage is the immediate ingestion blocker. Invalid/missing source
serials must be re-extracted or human-reviewed from their own source pages;
they must not be inferred from card position or neighboring voters.

## Tests

- Focused Phase 3/segmentation/migration tests: PASS — 43 passed.
- Focused Phase 3C worker tests: PASS — 9 passed.
- Complete extraction-service regression: PASS — 145 passed, 2 host-only
  Tesseract runtime skips, 3 upstream/cache warnings.
- Python compile check: PASS.
- Web unit tests: PASS — 50 passed, 1 environment-gated skip, including 6
  Phase 4A analytics tests and 5 Phase 4B Review/Admin helper tests.
- Web TypeScript: PASS.
- Web lint: PASS after reproducing and fixing locked `.pytest_cache` traversal.
- Web production build: PASS; all application routes generated.
- Live Phase 4B query check: PASS — 5/4,283 open rows returned; the next
  keyset page returned 5 rows with zero overlap.
- Live function security check: PASS — both Phase 4B functions are security
  invoker, `anon` execute is false, and authenticated execute is true subject
  to the explicit admin check/RLS.

## Artifacts

- `services/extraction-api/app/models/ingestion.py`
- `services/extraction-api/app/models/reconciliation.py`
- `services/extraction-api/app/models/verification.py`
- `services/extraction-api/app/ingestion/source_records.py`
- `services/extraction-api/app/ingestion/reconciliation.py`
- `services/extraction-api/app/ingestion/quality.py`
- `services/extraction-api/app/ingestion/verification.py`
- `services/extraction-api/app/db/supabase_contracts.py`
- `services/extraction-api/app/db/ingestion.py`
- `services/extraction-api/app/models/worker.py`
- `services/extraction-api/app/worker/page_processor.py`
- `services/extraction-api/docs/PHASE3_INGESTION.md`
- `services/extraction-api/docs/PHASE3_WORKER.md`
- `supabase/migrations/013_phase3_atomic_page_ingestion.sql`
- `supabase/migrations/014_phase3_persistence_security.sql`
- `supabase/migrations/015_page_processing_integrity.sql`
- `supabase/migrations/016_phase4b_review_admin.sql`
- `src/AdvancedReviewPage.tsx`
- `src/review.ts`
- `components/admin-console.tsx`
- `lib/admin/user-filter.ts`
- focused tests in `services/extraction-api/tests/`

## Known Limitations / Blockers

- The backend repository, live RPC, and page worker are ready, but the worker
  has not run against a real voter page in an OCR-capable private environment.
- Three real pages were segmented without retaining crops, but no real card OCR
  or source-record persistence was run.
- Tesseract is not installed on this Windows host and Docker is unavailable;
  the production worker image includes EN/TE Tesseract but is not running here.
- Serial extraction coverage is severely incomplete for 227 EN, 228 TE, and
  229 TE; 227 TE and 230 TE also have gaps.
- No logical voter is human-verified, so Golden Revision is correctly blocked.
- The real GOLD benchmark/winning OCR freeze evidence remains absent.
- Phase 4A can report trustworthy database aggregates now, but measured OCR
  accuracy, verified/golden counts, and final reconciliation remain unavailable
  until the Phase 3 evidence blockers above are resolved.

## Do Not Rebuild

- Auth, role controls, Search, Documents, Review, Data Quality,
  Administration, PWA, source viewer, RLS, the 3,454 expected-slot schema, and
  all Phase 2 extraction modules.

## Next Exact Task

Phase 4C — Revision Analytics and Reconciliation Drill-down

Add deterministic Part/language/reconciliation drill-downs using existing live
aggregates and paginated source evidence. Do not claim measured OCR accuracy or
Golden readiness until the Phase 3 evidence blockers are resolved.

