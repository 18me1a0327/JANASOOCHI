# JANASOOCHI Codex Checkpoint

## Current Phase

Cloudflare deployment — GitHub PASS; owner build-token approval required

## Deployment unblock — GitHub connected (2026-09-14)

- Read the requested checkpoint/readiness and deployment files. No repository
  audit or application/runtime changes. Existing passing gates reused.
- GitHub connection PASS: Cloudflare now shows Continue with GitHub, connected
  account 18me1a0327 and selectable JANASOOCHI. Selected that existing private
  repository and advanced to Set up your application. No new/public repo.
- Live creation form configured: project janasoochi, build
  pnpm build:cloudflare, deploy pnpm deploy:cloudflare, path '.', nonproduction
  branch builds OFF, Protect with Cloudflare Access OFF. Production branch
  main must still be independently confirmed after project creation.
- New blocker is NOT GitHub or vinext: Advanced settings proposes Create new
  token and says a user API token will be created automatically on deployment.
  Expanded permission disclosure shows account Settings(read), Workers Scripts
  (edit), KV/R2/D1/Vectorize/Queues/Pipelines/Containers/Cloudchamber/AI Search
  (edit), Connectivity Directory(read,bind), all-zone Workers Routes(edit),
  User Details/Memberships(read). These are broader than this app's bindings.
- No new token created, existing token selected, or Deploy button clicked.
  Attempts to inspect the token selector did not expose a verified existing
  narrower option. OWNER ACTION REQUIRED: explicitly approve this native
  build token's displayed permissions, or provide/select an appropriately
  scoped existing deployment token through Cloudflare (never paste its value
  into chat). Account security access must not expand silently.
- Both Supabase public build/runtime values still require configuration;
  Environment PARTIAL. Do not ask owner to click Deploy before environment
  setup is complete. No secret/service-role/frontend token configured.
- Deployment BLOCKED at token approval; URL NOT CREATED/CONFIRMED, deployed
  version/commit/timestamp unavailable. Anonymous/Auth production NOT TESTED;
  protected/role/Review/Quality/source/PWA statuses remain PARTIAL, based only
  on earlier local evidence. Mobile NOT VERIFIED; CPU NOT MEASURABLE.
- Existing TypeScript/lint/build/vinext PASS, web68PASS/1skip, local12/12smoke
  reused; no repeated build, OCR, install, data mutation or fake production QA.
- Netlify kept ACTIVE/unchanged; DNS unchanged; INR0. No Access policy, paid
  service, schema/RLS/adapter/UI/extraction change made.
- Files changed: this checkpoint and CLOUDFLARE_READINESS only. Save/push these
  real documentation changes against current private main; no empty commit.
- NEXT EXACT DEPLOYMENT TASK: obtain owner build-token approval, configure both
  existing public Supabase variables at build/runtime, verify main, trigger Git
  deployment and certify actual URL/commit/Auth/roles/Review/Quality/source/PWA
  and runtime telemetry. Then STOP deployment work. Product next task is
  Phase2F → tiny private real OCR smoke → human-verified GOLD preparation.

## Automatic deployment continuation (2026-09-14)

- Read checkpoint, readiness, package.json, wrangler.jsonc and
  vite.cloudflare.config.ts. No repo-wide audit, rewrite or dependency change.
- Configuration confirmed: pnpm/committed lockfile; documented Node22+
  (available Node24.19.0); Next16.3.4, vinext1.0.0-beta.9, Wrangler4.131.1;
  Worker janasoochi, lib/cloudflare/worker.ts, compatibility_date2026-09-13,
  nodejs_compat, workers_dev=true, assets dist/client. Commands remain
  pnpm build:cloudflare / pnpm deploy:cloudflare (generated Worker/SSR config).
- Local Supabase environment inspection printed names/booleans ONLY: expected
  existing project URL matches; public client key is present; no service-role,
  API token or secret variable is present. Cloudflare build/runtime variables
  cannot yet be certified (Environment PARTIAL). No credential was revealed.
- Cloudflare account is signed in, but current creation screen still shows
  Make something new / Connect GitHub. No JANASOOCHI repository is selectable.
  Keyboard activation did not advance; prior accessibility/Playwright attempts
  also failed. GitHub connection BLOCKED; do not assume the owner's previous
  approval is usable in this context. Wrangler whoami remains unauthenticated.
- OWNER ACTION REQUIRED: open the existing Cloudflare Workers creation screen
  in the owner's normal browser, click Connect GitHub, approve access only to
  18me1a0327/JANASOOCHI if prompted, and leave the selectable repository step
  visible. Do not grant all-repository access, create a token, buy Paid or
  publish a Hello World/static-only Worker as a shortcut.
- Deployment BLOCKED; Workers URL NOT CREATED/CONFIRMED; deployment commit,
  ID/version/timestamp unavailable. All production Auth/session/roles/Review/
  Data Quality/source/PWA QA remains unverified. Mobile NOT VERIFIED;
  live CPU NOT MEASURABLE. No production success or OCR accuracy claimed.
- Reused unchanged passing gates from the preceding run: TypeScript/lint,
  vinext compatibility/build, Next build, web68PASS/1existingOCRskip and
  built-workerd12/12smoke. Frozen install/new builds deferred until Git
  connection allows the requested deployment gate; no repeated costly checks.
- Netlify fallback independently HTTP200/login markup on this continuation,
  ACTIVE. Money INR0; no DNS/schema/RLS/OCR/source/UI changes.
- Updated local checkpoint/readiness only; existing pushed checkpoint commit
  remains 3b36632fc3d5a1ab52e45f987746c41c81c0346f. No new code commit.
- NEXT EXACT TASK: resolve the visible GitHub connection step, select existing
  private main/root '.', configure both public Supabase values at build/runtime,
  trigger native Git deployment, then certify the actual URL/commit and real
  authenticated production QA. Only afterward return to Phase2F→2G→2H→Phase3.

## Production QA / owner-requested deployment (2026-09-13)

- Read this checkpoint and CLOUDFLARE_READINESS first; migration was not rebuilt.
  Private GitHub main is 40da370c25491940731f542cae7b0c82330aac35.
- The supplied Cloudflare account is now authenticated in the browser. Its
  Workers & Pages list explicitly shows "No projects found" / "You have not
  created any projects yet", with no search filter active. September 1–13
  account activity shows 0 requests, 0ms CPU, 0 observability events and 0 build
  minutes. This is NOT evidence of a deployed Worker's runtime performance.
- Dashboard account subdomain is anandkalidindi28.workers.dev. One probe of
  the expected janasoochi hostname failed TLS handshake; it is NOT a confirmed
  deployment URL. No deployed version/commit can be certified.
- Wrangler whoami is unauthenticated here. deployments status cannot retrieve
  production state without authorization. No token requested/extracted, no
  temporary anonymous account/deployment, and no Paid upgrade enabled.
- Owner subsequently requested "Create the project and deploy it". Opened the
  existing account's Workers creation flow (NOT Pages). No Git provider is
  connected. Connect GitHub did not advance in this in-app browser; its hidden
  repository step offers Connect GitHub account but is not visible/interactable.
  Owner action requested: connect GitHub in a normal browser, grant access ONLY
  to 18me1a0327/JANASOOCHI, then expose the repository selector. Do not deploy
  Hello World/static assets as fake application success.
- Owner replied "yes, done". Refreshed the dashboard and retried the visible
  Connect GitHub control through both accessibility and Playwright. The visible
  screen still stays on Make something new; no selectable repository appears.
  DOM inspection confirms its repository step has no Git provider and is hidden
  (connection label has zero-size bounds). No new GitHub grant was made here.
  Authorization may exist in the owner's other browser but is not usable in
  this dashboard/CLI context. Resume from a visible repository selector or an
  authorized normal-terminal Wrangler deployment, not from assumed success.
- Preferred deployment continuation: existing private repo/main, root '.',
  build pnpm build:cloudflare, deploy pnpm deploy:cloudflare. Configure the
  existing NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  at build AND Worker runtime. No service-role key. Stay on Workers Free.
- Re-executed gates: typecheck PASS (also after Worker typegen), lint PASS,
  Vitest 68 PASS / 1 existing environment-gated OCR skip, vinext check PASS
  with its existing App Router StrictMode partial-support warning,
  build:cloudflare PASS, normal Next production build PASS.
- Fresh built-Worker/workerd preview: 12/12 HTTP smoke checks PASS. Covers
  home/login, anonymous + spoofed-role denial on Search/Documents/Review/
  Data Quality/Administration/Profile/Source, safe404, manifest/icons/SW/offline.
  These are LOCAL results, not production certification. Existing nine focused
  gate/wrapper tests verify fail-closed Admin checks, cookies and streaming.
- Wrangler deploy --dry-run again reproduces native esbuild parent-drive
  access denial, despite dist/server/index.js existing. Local official Vite
  workerd preview succeeds. Use Cloudflare Git/Linux build or owner's normal
  terminal; do not switch adapter or repeatedly retry the sandbox path.
- Production authenticated Viewer/Admin, cookie refresh/logout, Supabase SSR,
  Review/Data Quality/source highlighting, PWA installation and Worker logs
  remain NOT TESTED: no live Worker or authorized Worker session is available.
  Real per-request CPU is NOT MEASURABLE. Free-tier SSR CPU remains a RISK;
  zero account activity must not be reported as a performance PASS.
- Netlify fallback independently HTTP200 with login markup at
  https://janasoochi.netlify.app/login; unchanged, ACTIVE. Money spent INR0.
- Only checkpoint/readiness documentation changed. No UI, adapter, OCR, schema,
  RLS, authentication or Netlify configuration changes; no real data or secrets.
- NEXT DEPLOYMENT ACTION: owner GitHub connection approval, configure both
  public variables, deploy existing Worker, record returned URL/version, run
  scripts/cloudflare-smoke.mjs against HTTPS production and the real signed-in
  Viewer/Admin/session/source/PWA matrix, then inspect logs/CPU. Keep Netlify.
- NEXT EXACT PRODUCT TASK after production QA: return to real OCR/GOLD evidence,
  Phase 2F → Phase 2G → Phase 2H → finish Phase 3. No fabricated Golden/accuracy.

## Cloudflare Workers migration (2026-09-13)

- Owner approved Workers (not Pages) and supplied existing account dashboard.
  Pinned vinext 1.0.0-beta.9 selected; no blocking imported-API gap, no OpenNext.
  Beta adapter: App Router StrictMode wrapping partial.
- Separate Vite/Workers config, typed no-store response wrapper and deployment
  scripts preserve Next/Netlify, UI, Supabase/Auth/RLS/schema and OCR unchanged.
- Actual Worker build PASS. build:cloudflare runs next typegen afterward to fix
  reproduced stale .next validator types. No TypeScript/validation disabling.
- TypeScript/lint/Next production build PASS; web 68 PASS/1 existing OCR fixture
  skip; 12/12 built-workerd HTTP smoke checks PASS. Nine added unit cases cover
  existing server Admin gate and redirect/cookie/streaming/failure wrapper.
- Auth/protected routes PARTIAL: anonymous/spoofed-role protection PASS on all
  workspace/source routes; EN/TE/UR UI and anonymous Admin refresh PASS.
  Signed-in Viewer/Admin/session refresh/logout/exact source QA not certified.
- Authenticated local workerd outbound fetch reproduced AuthRetryableFetchError,
  safe login redirect after retries. Node Supabase settings HTTP200/email on/
  Google off; not a DB outage. Native sandbox egress unresolved; no TLS/auth bypass.
- Supabase PARTIAL: existing config preserved/settings PASS; production untested.
  Google/callback N/A. PWA PARTIAL: assets/privacy tests PASS, production install/
  mobile/offline/logout pending. No sensitive client asset or cache added.
- Free tier RISK: 56 client assets; 106 Worker JS modules, 2,186,647 raw bytes,
  637,273 summed gzip bytes (estimate, not upload verification). Live SSR/proxy/
  Admin/Review/Quality/Source CPU not measured; no Paid binding/feature enabled.
- Deployment URL NONE: dashboard login and Wrangler owner OAuth pending. Official
  authorization page handed to owner. Local Wrangler dry-run hits esbuild's
  denied parent-drive scan; official Vite workerd preview works with private temp
  XDG/log state. Repeat dry-run/deploy in normal terminal/Cloudflare Linux build.
- Netlify fallback ACTIVE: Node /login HTTP200/login markup; DNS unchanged.
  Money spent INR0. No PDFs/voter exports/crops/secrets/build output committed.
- Files: package.json, pnpm-lock.yaml, pnpm-workspace.yaml, .gitignore,
  vite.cloudflare.config.ts, wrangler.jsonc, lib/cloudflare/worker.ts + test,
  lib/auth/require-admin.test.ts, scripts/cloudflare-smoke.mjs, README.md,
  docs/CLOUDFLARE_READINESS.md and this checkpoint.
- Commit/push: f10f10050f8f00966728afdd03583b4bb5fb7f63 on private main,
  focused 13-file migration diff inspected; no real data/secrets/build outputs.
  Owner OAuth attempt expired without approval; rerun wrangler login to deploy.
  Do not initialize/reset/add the entire untracked local tree.
- Next exact task: owner Wrangler authorization, Workers Free deployment from
  nonrestricted build, full signed-in role/session/source/PWA/mobile + live CPU QA.
  Keep Netlify canonical until those gates pass. See hosting guide.

## Final Master Continuation (2026-09-13)

- Read the complete owner continuation brief and current checkpoint; inspected
  only relevant hosting/OCR/PWA files. Local Git has no commits and the project
  files are untracked; the private GitHub repository remains the authoritative
  commit history. Do not initialize/reset or indiscriminately add this tree.
- Stage A: verified Next.js 16.3.4, root pnpm build, `.next` runtime output,
  request-cookie authentication/proxy, admin server layouts and dynamic source
  routes. Static Cloudflare Pages cannot preserve this application unchanged.
  No Vite fallback, static-export conversion, new adapter, or redirect was added.
- Stage B: BLOCKED pending owner approval to use compatible Cloudflare Workers
  hosting rather than static Pages and account authorization. No Cloudflare
  connector/environment credentials are available. See
  `docs/CLOUDFLARE_READINESS.md` for exact current settings and compatibility gate.
- Stage C: added a typed, read-only `python -m app.ocr.runtime` preflight with
  explicit executable override, known-path discovery, bounded version/language
  probes and safe errors. Live probe: no Tesseract executable; eng/tel absent.
  No winget/Docker/Tesseract command was available; common install paths absent.
  No system installer, paid service, OCR job or source persistence was run.
- Stage D/E/F: no populated authorized human GOLD sample exists in the
  repository; measured OCR comparison and production freeze remain BLOCKED.
  Existing private CSV verifier/template remain intact; OCR is never GOLD.
- Stage G/H and Phase 5/7 remain evidence-gated; Phase 6 is deferred unless a
  real benchmark justifies it. No verified/Golden count or accuracy was invented.
- Added five tests executing the actual service worker: public cache allowlist,
  sensitive/cross-origin/mutation bypass, network-only authenticated navigation,
  offline fallback, and standalone manifest/asset paths. No UI/PWA redesign.
- Supabase advisor still reports only leaked-password protection disabled.
  Current docs make this Pro-plan-and-above; no paid upgrade/config change made.
- Money spent this run: INR 0. New paid services: none. No DB migration.
- Files changed: `docs/CLOUDFLARE_READINESS.md`, this checkpoint,
  `lib/pwa/service-worker.test.ts`,
  `services/extraction-api/app/ocr/runtime.py`,
  `services/extraction-api/tests/test_ocr_runtime.py`,
  `services/extraction-api/docs/OCR_RUNTIME.md`.
- Tests: focused OCR/runtime/GOLD regression 44 passed, 2 native-runtime skips;
  web 59 passed, 1 environment-gated skip; TypeScript/lint/Next production build
  PASS; full extraction regression 154 passed, 2 native-runtime skips, 3 existing
  upstream/cache warnings; Python compilation PASS. No full-roll OCR or real
  accuracy benchmark was run.
- Next exact task: obtain owner decision for Cloudflare Workers compatibility
  work and a free EN/TE Tesseract runtime. Then tiny private OCR smoke test and
  genuine human GOLD annotation; never skip the comparison/freeze evidence gates.

## Status

Phase 4A, Phase 4B and Phase 4C are complete and tested on top of the existing Phase 3
ingestion foundation. Review now uses one server-filtered, enriched, keyset-
paginated RPC rather than browser-side ID lists or deep offsets. Correction,
optional source-record verification, one-issue resolution, history, and audit
creation are atomic. Administration includes current-page email/role filtering
and recent audited-export visibility. Data Quality now includes a current-
revision matrix and keyset-paginated EN↔TE reconciliation evidence with exact
source-page actions.

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

## Phase 4C Completed

- Added an admin-only current-revision summary by Part showing expected logical
  slots, active EN/TE documents, revision identifiers, language-linked slots,
  paired/reconciled slots, missing editions, duplicate sources, EPIC conflicts,
  unlinked source rows and verified logical slots.
- Added an admin-only reconciliation evidence RPC with stable
  `(Part, serial, row key)` keyset pagination, bounded pages and server-side
  status/text filters. It returns fully enriched EN and TE source evidence in
  one request and never constructs browser-side UUID lists.
- Reconciliation continues to use Part + Serial as identity and EPIC, normalized
  house, age and gender as corroboration. Cross-script names are displayed but
  are not treated as a literal identity match.
- Added source-page actions for both language editions, retaining document,
  physical/printed page and bounding-box references.
- Added multilingual EN/TE/UR interface copy for the new drill-down. Urdu is
  interface-only here and no Urdu source data is synthesized.
- Applied migration `phase4c_revision_reconciliation_drilldown` to the existing
  Supabase project. No source record or verification state was changed.

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
- Web unit tests: PASS — 54 passed, 1 environment-gated skip, including 6
  Phase 4A analytics tests, 5 Phase 4B Review/Admin helper tests and 4 Phase 4C
  reconciliation helper tests.
- Web TypeScript: PASS.
- Web lint: PASS after reproducing and fixing locked `.pytest_cache` traversal.
- Web production build: PASS; all application routes generated.
- Live Phase 4B query check: PASS — 5/4,283 open rows returned; the next
  keyset page returned 5 rows with zero overlap.
- Live function security check: PASS — both Phase 4B functions are security
  invoker, `anon` execute is false, and authenticated execute is true subject
  to the explicit admin check/RLS.
- Live Phase 4C summary check: PASS — all four Parts returned with one current
  revision identifier per Part and logical totals kept separate from language
  source-row totals.
- Live Phase 4C pagination check: PASS — two five-row evidence pages returned
  with zero overlap; 5,039 canonical/unlinked evidence rows are represented.
- Live Phase 4C filter check: PASS — Part 227 returns 18 deterministic EPIC
  conflicts without exposing source values in the aggregate check.
- Live Phase 4C function security check: PASS — both functions are security
  invoker, `anon` execute is false, and authenticated execution remains subject
  to the explicit administrator check and RLS.

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
- `components/reconciliation-drilldown.tsx`
- `lib/admin/user-filter.ts`
- `lib/data-quality/reconciliation.ts`
- `lib/data-quality/reconciliation.test.ts`
- `supabase/migrations/20260912154648_phase4c_revision_reconciliation_drilldown.sql`
- focused tests in `services/extraction-api/tests/`

## Known Limitations / Blockers

- Deployment root cause confirmed in the authenticated Netlify dashboard on
  2026-09-13: the team has exhausted deploy credits and is running on operational
  credits, which keep published sites online but cannot fund production deploys.
  Git-connected deploys ARE firing; the Phase 4C commit
  `bd8cb85ca608955be5bdcfd63d35038f18d5ffa5` was explicitly skipped with
  "Skipped due to account credit usage exceeded" (deploy
  `6aa5769a87d41200085ee85c`). Do not repeat MCP uploads or rebuild the app.
  Deployment requires the next Netlify billing-cycle allowance or an account-owner
  approved paid upgrade; no paid upgrade was enabled.
  The public production login at `https://janasoochi.netlify.app/login` was opened
  successfully and still serves the September 8 published deployment. Production
  Phase 4B/4C control verification remains deferred until those changes publish.
  Netlify production `NEXT_PUBLIC_SUPABASE_URL` was verified against the existing
  project `https://zlgwpegklxzmwppghvst.supabase.co`; both Next.js and legacy Vite
  publishable-key environment entries are present. No key was revealed/changed.
- Phase 4B is pushed to GitHub at commit
  `5d6294c73ac5d0efee166651ad874f4aef48d3cd`. Two authorized Netlify upload
  attempts on 2026-09-10 reached the upload service but ended with Netlify
  `500 Internal Server Error`; no new deploy was registered. Production remains
  on ready deploy `6a9ff223ff4ba4000898dbdd` and therefore does not yet include
  Phase 4B. Retry deployment from the linked Netlify project; do not rebuild or
  recommit Phase 4B.
- A further authorized Netlify retry on 2026-09-12 again reached the upload
  service but ended with the same `500 Internal Server Error`; no deploy was
  registered. Do not loop on the same MCP upload route. Use a Git-connected
  Netlify build or Netlify dashboard retry when that authenticated route is
  available.
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

Production deployment recovery, then Phase 4D — Data Quality Export and Audit
Drill-down.

Once deploy credits renew (or the owner authorizes a paid upgrade), publish the
tested Phase 4B/4C commit through the existing Git-connected Netlify project.
Do not retry deployment while Netlify explicitly blocks production deploys.
Then add audited, admin-only quality
snapshot exports without claiming measured OCR accuracy or Golden readiness
until the Phase 3 evidence blockers are resolved.
