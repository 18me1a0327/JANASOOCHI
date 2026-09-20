# JANASOOCHI Codex Checkpoint

## Current Phase

Consolidated production completion — PARTIAL; permanent documents and Data Insights pass, custom domain and evidence-chain work remain

## Consolidated production completion — 2026-09-20

- P0 document persistence PASS on the existing architecture: the private
  `voter-pdfs` Supabase Storage bucket contains 8 objects and `uploaded_pdfs`
  contains the same 8 metadata rows (4 EN, 4 TE, 0 UR). Admin-only mutation
  and authorized read policies remain in force. A real stored Part 227 EN PDF
  reopened at physical page 1/40 after refresh; the eight documents have also
  survived multiple Cloudflare deployments and authenticated sessions. No new
  source or voter row was created, replaced, archived, deleted or bulk-verified.
- Live duplicate protection PASS: submitting the already-processed Part 230 EN
  PDF returned `This PDF has already been processed.` The follow-up database
  check remained exactly 8 private Storage objects and 8 metadata rows, proving
  that the duplicate was rejected before a second object/record was created.
- The persistence root cause was presentation/state coupling, not temporary
  Worker storage: Storage + metadata already persist before browser-side OCR,
  but a later processing error could make a successful upload look failed.
  Documents now reports permanent storage immediately and reports later OCR as
  resumable. Duplicate checksum handling remains intact. Production upload
  accepts EN/TE only; Urdu is explicitly blocked until authorized valid source
  PDFs exist, while the underlying OCR language contract remains available.
- P1 `/data-insights` PASS with real Supabase aggregates and filters. It uses
  3,454 logical voter slots (227=1,014; 228=973; 229=888; 230=579), never sums
  EN+TE as new voters, and shows 100% logical-slot extraction, EN 2,741/3,454,
  TE 1,681/3,454, 1,037 paired, 22 reconciled, 1,585 unlinked sources, 1,529
  unresolved critical issues, 721 missing serials, 662 suspicious EPICs and
  199 failed pages. GOLD accuracy and multi-revision comparison remain honest
  pending states, not fabricated metrics.
- P2 logo PASS. The owner-supplied square artwork replaces the visible login,
  sidebar, mobile-header, offline-shell and PWA icons. Deterministic 192/512
  variants preserve the full artwork. Versioned filenames and safe-shell cache
  `v4` prevent returning clients from retaining the former logo. Live mobile
  login and Documents screenshots confirmed circular, contained presentation.
- P3 application hostname independence PASS: no current workers.dev hostname is
  hard-coded in application/configuration surfaces; internal navigation remains
  relative. A clean custom domain is NOT CONFIGURED and requires an owner-owned
  domain plus Cloudflare Domain/Route and Supabase Auth redirect allowlist work.
  Current workers.dev and Netlify fallback remain active; DNS unchanged.
- Review read/pagination production query PASS; unchanged verification RPC and
  correction validation have focused coverage, but no real Review save/verify
  mutation was performed. Viewer mutation denial remains RLS/server-enforced
  but a fresh real Viewer session was not rerun in this consolidated pass.
- Final deployed application-changing commit:
  `92ab8badfcf5b82c4be595f5c721632074959957`; Cloudflare build
  `1f1963b6-0560-41e4-b8ef-bb0ac436e772`; active version `6d938c9b` at 100%
  traffic. Real production HTTP smoke 12/12 PASS after deployment. A later
  checkpoint-only commit may rebuild identical runtime code.
- Final gate: focused Vitest 49/49 PASS; TypeScript PASS; changed-surface ESLint
  PASS; vinext Cloudflare build PASS. No OCR/GOLD/ML/AI processing was started.
  Money INR0. Netlify fallback ACTIVE.
- Remaining: configure an actual custom domain; physical mobile install/offline
  behavior; real Viewer session and Review mutation QA; Cloudflare Free CPU risk
  (previous active median 16.51ms vs Free 10ms allowance); human GOLD/OCR evidence;
  enable leaked-password protection where available; repository visibility is
  currently reported public by GitHub and should be made private by the owner.
- NEXT EXACT TASK: Phase 2F — select a tiny private matched EN/TE sample, create
  human-verified GOLD evidence, then Phase 2G real OCR measurement. No full-roll
  OCR and no accuracy claim before verified GOLD exists.

## Low-usage production QA — 2026-09-14 21:54 IST

- Confirmed live version12c5094a at100% traffic, linked to existing main commit
  7705d062509cda7007ef3cdb8b12d8b5a015cc01. No deployment/app changes required.
- Reopened Search in a fresh browser tab: existing Admin session persisted.
  Protected Search refresh retained server-rendered Admin authorization.
  Prior owner-assisted login/logout/re-login evidence is retained, not rerun.
  FORCED EXPIRY: NOT VERIFIED; no artificial expiry test performed.
- Viewer production: NOT TESTED. Available session is Admin, not Viewer.
  Owner must sign out and use the existing Viewer account on the live site;
  never provide passwords in chat. Do not create/reset users or infer Viewer
  RLS/mutation PASS from local tests or an Admin session.
- Lightweight REAL HTTP checks: manifest, sw.js, offline.html and both icons
  PASS (5/5). PNG IHDR dimensions exactly192x192 and512x512; both maskable.
  Manifest standalone/start_url=/search/default resolved scope=/ over HTTPS.
  Deployed SW matches local source after line-ending normalization. Its only
  cached URLs are the public offline shell/manifest/icons; navigation is
  network-only with offline fallback, API/private PDFs/cross-origin Supabase
  data are not cached. Actual registration/offline-device behavior and physical
  mobile installation remain NOT VERIFIED; PWA overall PARTIAL.
- Netlify login HTTP200 and configured login-title: PASS; fallback ACTIVE.
- Current dashboard:293 invocations across versions,602 subrequests,0 errors.
  Active12c5094a:55 invocations, median CPU24.67ms, error rate0%, traffic100%.
  Exceeded CPU Time Limits0. Current-version evidence supersedes initially
  empty metrics and retains FREE-TIER RISK, not PASS or proven failure.
  Documented Workers Free10ms/HTTP request with occasional isolate flexibility:
  https://developers.cloudflare.com/workers/platform/limits/ . CPU is not
  wall time. No synthetic load, paid upgrade or speculative adapter change.
  Worker Logs/Traces currently Disabled after Git redeploy; aggregate metrics
  are available, but correlated runtime-log inspection remains unverified.
- Reused earlier verified Admin, paginated Review/read/editor-cancel, Data
  Quality and private source/page/bbox evidence. Review save/verify deliberately
  untested against real data. Auth PARTIAL for unexercised refresh/expiry paths;
  Protected routes PARTIAL until real Viewer negative authorization is tested.
- No code/schema/RLS/source edits, full build/test reruns, OCR or paid work.
  Only these two QA documents updated. Money INR0. OVERALL PARTIAL.
- NEXT EXACT TASK: owner-assisted Viewer sign-in, then Search/Documents/source
  reads and direct Administration/admin-mutation denial checks without voter
  writes. Separately correlate/profile normal SSR CPU before Free-tier acceptance.
  STOP here; do not start Phase2F/G/H. After acceptance/weekly reset, tiny private
  OCR smoke instructions only: select one existing EN card and corresponding TE
  Part+Serial card, preserve raw/normalized output and source page/bbox privately,
  obtain human GOLD values, then measure; no full roll and no claimed accuracy.
  Urdu remains BLOCKED until valid official Urdu PDFs are supplied.

## Final deployment receipt — 2026-09-14T16:07:17Z

- Focused two-document checkpoint commit7705d062509cda7007ef3cdb8b12d8b5a015cc01
  pushed to private main. Git diff verified exactly CODEX_CHECKPOINT and
  CLOUDFLARE_READINESS; no application code, PDFs, datasets or credentials.
- Native build5f262dbc-68de-4d1c-a734-42c4feb9ad76 confirmed Success (58s)
  and exact Git SHA7705d06. Production version12c5094a-7a9d-4b36-b860-9c72109f704a,
  deployed2026-09-14T16:07:17Z at the existing confirmed Workers URL.
  Upload2135.59KiB / gzip594.07KiB; startup31ms. Supabase variables retained.
- AFTER final success, REAL HTTP smoke again12/12PASS. No false conversion
  of local tests into production results. Final version CPU initially No data;
  prior version's measured16.01ms CPU retains Free-tier RISK, not PASS.
- Owner repeatedly returned as Admin, not Viewer. Logout and Admin re-login
  verified; real Viewer authorization remains pending owner-assisted sign-in.
  Current task is PARTIAL, not complete. No Paid/DNS/fallback change made.
- This final receipt is local only; preceding QA checkpoint was pushed in the
  deployed7705d06 commit. Avoid a documentation-only recursive redeploy merely
  to embed its own resulting deployment receipt. Capture it in the next focused
  commit when Viewer/runtime QA actually progresses.

## Production QA continuation — 2026-09-14

- Git-triggered production build 6f4accd3-32de-4b60-a7fb-d2919383c3f3 succeeded
  for da045b21c946f6dd638eb53776738379f7f75ddf. Cloudflare links the exact Git
  commit to active version 9b99f888-417c-4139-81aa-3acb20440331, 100% traffic.
  Existing vinext/full-stack runtime and private repository/main retained.
- REAL Worker smoke re-run: 12/12 PASS. Production sw.js byte-equivalent to
  the local safe-shell source after line-ending normalization. Netlify login
  independently HTTP200 with login-title; fallback ACTIVE/unchanged.
- Supabase Auth settings HTTP200 using the existing public client credential;
  email/password enabled, Google disabled. No Auth configuration changed.
- Owner signed in directly: server-rendered Search/profile authorization shows
  Admin. Direct protected navigation/refresh retained the session. Sign out
  then direct Administration correctly redirected to Login. Owner subsequently
  signed in as Admin again, proving login-after-logout. Forced token-expiry
  renewal/cookie-attribute inspection has not been separately exercised.
- Real Search: Part228 AND Serial1 returned one uploaded English record.
  Clear filters, House001 alone across all supported parts returned two rows
  and "Voters listed under House Number 001". No family inference or data edit.
- Documents loads eight saved EN/TE sources and their real page/record/review
  states. PDF upload/resume/archive were NOT executed (deployment-only QA;
  no full OCR or voter/source mutations). Refresh/direct access exercised.
- Review reads paginated enriched rows, moves to page2, filters Part227 and
  a no-match query, and displays a safe empty result. Native Clear restores
  the queue. Correction editor opened and closed; save/verify not executed
  against real voter data. Historical giant IN bug did not recur.
- Private source: Documents opened uploaded EN Part227 PDF, physical1/40,
  Next selected page2 and zoom110→125%. Review Source opened uploaded TE
  Part227 physical39/40 with the linked voter-card highlight. Exact source
  URL includes voter reference; anonymous source access remains rejected.
- Data Quality real Supabase metrics render; no fabricated GOLD accuracy.
  Part228 + English + Revision view produced Expected973/Extracted973 and
  reconciliation drill-down moved page1→page2 of74. Admin Administration
  loads existing authorized users; create-user dialog opened/cancelled without
  changing credentials. Exports and role changes NOT executed.
- Some immediate browser navigation/refresh observations showed "This page
  couldn't load" before later successful rendering. No application stack or
  correlated Worker exception captured; do not invent a code root cause or
  label these resolved. Native browser controls plus settled observations
  proved the working routes; preserve this intermittent reliability caveat.
- Live-only diagnostic Logs enabled through Cloudflare UI (invocation_logs
  true, persist false), without paid service or application/schema change.
  Live stream connected but received no events during observed requests;
  complete runtime-log inspection remains UNVERIFIED. No log data exported.
- Dashboard telemetry75 invocations, zero aggregate invocation errors;
  active9b99f888 medianCPU16.01ms, medianwall117ms, Supabase101 subrequests.
  Earlier active5a68 median12.04ms, initial106.3ms. CPU and wall time are NOT
  equivalent. Workers Free documented allowance10ms/request, with occasional
  burst flexibility: https://developers.cloudflare.com/workers/platform/limits/ .
  FREE-TIER RISK persists; zero errors does not prove sustained compatibility.
  Do not upgrade automatically or change adapters without a verified blocker.
- Fresh final local gate: tsc --noEmit PASS; eslint . PASS; vitest run68PASS /
  1existingOCRskip (9 passing test files / 1 skipped). Focused require-admin
  suite5/5PASS. Native vinext build/deploy PASS; normal Next production build
  previously PASS with unchanged application source. No expensive re-OCR.
- Viewer account exists in Administration, but owner-assisted Viewer session
  still not supplied. Current sign-in is Admin again. Viewer direct-route,
  server-side role and private-source permissions remain PARTIAL despite the
  five passing local authorization tests. Owner asked to sign in as Viewer
  on the live site (never paste credentials). Do not create/reset a test user.
- PWA assets/safe-shell contract PASS; physical mobile installation/offline
  browser cache inspection remain NOT VERIFIED. No sensitive offline cache
  added. Money INR0; Netlify ACTIVE; DNS unchanged; no voter/source writes.
- OVERALL PARTIAL. Changed files remain this checkpoint and readiness only.
  NEXT EXACT TASK: obtain Viewer session, finish real permission/session QA,
  correlate intermittent loads with Worker logs and profile Free-tier SSR CPU.
  Only after acceptance: Phase2F → tiny private OCR smoke → human GOLD.

## Live Workers deployment — 2026-09-14

- Owner explicitly approved the disclosed native build-token access. Created
  janasoochi using the existing private 18me1a0327/JANASOOCHI repository,
  main/root '.', vinext, pnpm build:cloudflare / pnpm deploy:cloudflare.
  Nonproduction builds and Cloudflare Access remain OFF. No paid plan enabled.
- Both existing public Supabase values configured as encrypted build and
  runtime variables. Expected project zlgwpegklxzmwppghvst retained. No
  service-role key, token value, source PDF or voter dataset exposed/committed.
- Native frozen-lockfile Linux install/build/deploy PASS. Cloudflare uses
  pnpm10.11.1 and Node24.18.0. Existing application code is unchanged.
- First build 9f4ad596-d17b-4fdb-90b9-4f226beb4f09 succeeded, but saving runtime
  variables during that build deployed the initial Hello World version over
  the application. Reproduced: all routes HTTP200 plain Hello world; production
  smoke failed root redirect assertion (200 != 307). Deployment history showed
  a later dashboard Add secret placeholder version. Smallest fix: retry the
  unchanged Git build AFTER variables were saved; --keep-vars preserves them.
- Retried build ca11a8cb-e8b8-4228-80b1-dc18f39bd769 PASS, deployed at
  2026-09-14T06:01:11Z, version 5a68e94f-8c76-4451-b49e-ecd79566c6c9.
  Total upload 2135.59KiB / gzip594.62KiB; Worker startup22ms.
- Confirmed live URL: https://janasoochi.anandkalidindi28.workers.dev .
  Git main was 2692ba913a2176773280582fe9bd96c85d482636 before both builds;
  manual-build UI exposes main but no commit association (Empty commit message).
  Do not claim an independently certified deployment SHA from that alone.
- REAL production command: node scripts/cloudflare-smoke.mjs
  https://janasoochi.anandkalidindi28.workers.dev — 12/12 PASS after retry.
  Root307/search; configured login200/no-store; anonymous and role=admin spoof
  blocked on search/documents/review/data-quality/administration/profile/source;
  manifest/icons/sw/offline assets load; unknown route safe404.
- Existing unchanged gates reused: TypeScript/lint/Next build/vinext build PASS,
  web68PASS/1existingOCRskip and local12/12smoke. No expensive repeated OCR/build.
- Production login opens normally. Owner asked to sign in directly with an
  existing Admin account; no authorized production session/password available
  to the agent yet. Auth login/refresh/logout, authenticated SSR, Viewer/Admin,
  Review/Quality data and private source viewing remain PARTIAL/NOT TESTED.
- PWA production manifest/icons/service worker/offline HTML HTTP checks PASS;
  unchanged SW source caches only the explicit safe shell. Real registration,
  offline behavior, authenticated cache boundary and physical mobile install
  are not yet independently verified (PWA PARTIAL; mobile NOT VERIFIED).
- Actual dashboard telemetry: 17 invocations across versions, zero invocation
  errors; active 5a68e94f medianCPU106.3ms. Mixed-version CPU P50=3.66,
  P90=98.41, P99=102; wall-time percentiles tracked separately. Small initial
  sample includes placeholder requests. FREE-TIER RISK: high active-version
  CPU is not acceptable evidence of free-tier safety; obtain per-route warm
  authenticated metrics before accepting migration. No Paid upgrade made.
- Workers Observability explicitly Disabled. No runtime exception log stream
  inspected; zero aggregate errors is not equivalent to inspected Worker logs.
  Dashboard console accessibility warnings are not application runtime errors.
- Netlify fallback ACTIVE/unchanged; DNS unchanged; INR0. No UI, schema/RLS,
  adapter, extraction infrastructure or voter/source-data mutation.
- Only changed files: this checkpoint and CLOUDFLARE_READINESS. Push focused
  docs and verify the resulting native Git-triggered build's SHA/version; do
  not create an empty commit or rebuild application modules.
- OVERALL PARTIAL. NEXT EXACT TASK: complete owner-assisted production Admin
  and Viewer/session/source QA and investigate measured per-route CPU on Free.
  After Cloudflare QA genuinely passes, STOP deployment work; product task
  Phase2F → tiny private real OCR smoke → human-verified GOLD preparation.
  Urdu remains blocked until valid source PDFs; no accuracy/GOLD fabricated.

Earlier sections below are historical snapshots, not the current status.

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

