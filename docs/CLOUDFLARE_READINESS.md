# Cloudflare Workers migration

## Consolidated production receipt — 2026-09-20 (PARTIAL)

Live Worker: https://janasoochi.anandkalidindi28.workers.dev . Final
application-changing commit `92ab8badfcf5b82c4be595f5c721632074959957`, Git build
`1f1963b6-0560-41e4-b8ef-bb0ac436e772`, active version `6d938c9b` at 100%
traffic. Build and real HTTP smoke 12/12 PASS. Supabase-backed Documents and
Data Insights production routes load under the existing Admin session; Review
continues to return paginated rows. Netlify fallback remains ACTIVE; INR0.

The owner-supplied logo is deployed under versioned 192/512 paths and safe-shell
cache v4, resolving the former cached-artwork problem without caching sensitive
application data. Manifest, service worker, icons, offline shell and anonymous
route protection pass. Mobile physical installation remains NOT VERIFIED.

Private Supabase Storage remains the permanent PDF store: 8 objects match 8
metadata rows (4 EN, 4 TE, 0 UR). No PDF is stored in Worker temp/build assets.
EN/TE ingestion is allowed; Urdu ingestion is explicitly blocked. No real data
was mutated during QA. Data Insights uses real aggregates and 3,454 canonical
slots without double-counting language editions; GOLD accuracy remains pending.

Custom-domain code readiness PASS, but no clean domain is configured. The app
has no hard-coded personal workers.dev dependency. Owner must supply/own a domain,
add it in Worker Domains & Routes, then add the exact HTTPS origin/redirect to
Supabase Auth while retaining workers.dev and Netlify during cutover.

Overall remains PARTIAL: real Viewer-session negative QA, production Review
save/verify, forced expiry, physical PWA install/offline behavior, custom domain,
and sustained Free-tier CPU safety are not fully verified. Previous active
median CPU was 16.51ms against the Free 10ms/request allowance, so risk remains.
GitHub reports the repository visibility as public despite the private-project
requirement; owner should change it to private. No Paid upgrade or DNS change.

## Low-usage QA receipt — 2026-09-14 21:54 IST (PARTIAL)

Live existing Worker https://janasoochi.anandkalidindi28.workers.dev confirmed;
version12c5094a at100%, Git main7705d062509cda7007ef3cdb8b12d8b5a015cc01.
Deployment/environment/build retained PASS; vinext and Netlify preserved.
Fresh Search tab and protected refresh retained the existing Admin session.
Prior real Admin login/logout/re-login checks reused. Viewer NOT TESTED because
no Viewer session is available. Owner must sign out/sign in as existing Viewer
on the site; never paste credentials. No user creation/reset or data mutation.
Forced expiry NOT VERIFIED; Supabase Auth/protected role matrix remain PARTIAL.

Five lightweight production PWA checks PASS: manifest, exact safe-shell SW,
offline HTML,192/512 PNG assets (actual dimensions checked), maskable purposes,
HTTPS/start_url=/search/default scope=/. Only public shell/manifest/icons cached;
authenticated navigation, API, private PDFs and Supabase data not cached.
Actual SW registration/device-offline behavior/mobile install NOT VERIFIED;
PWA PARTIAL. Netlify configured login independently HTTP200: ACTIVE.

Current dashboard293 invocations/602 subrequests/0 aggregate errors. Active
12c5094a55 invocations/medianCPU24.67ms/error rate0%; CPU-limit terminations0.
Free-tier RISK persists against documented10ms/request, not confirmed failure:
https://developers.cloudflare.com/workers/platform/limits/ . No load generation,
wall-clock-as-CPU claim, Paid purchase or adapter switch. Logs/Traces currently
Disabled after redeploy; correlated runtime logs not verified. CPU route-specific
profiling remains deferred, not falsely passed from aggregate zero errors.

Review PARTIAL (reads/pagination/filters/editor-cancel verified earlier, no real
save/verify); Data Quality/source viewer PASS from retained real production
evidence. No full checks rerun and no application/schema/RLS/OCR changes.
Only checkpoint/readiness docs changed; INR0. OVERALL PARTIAL. Next exact task:
owner-assisted Viewer read/negative permission QA, then normal SSR CPU evidence.
STOP; after weekly reset and acceptance only prepare tiny EN/TE card smoke/GOLD
evidence; no OCR execution in this run. Urdu blocked pending valid official PDFs.

## Final production receipt (local) — 2026-09-14T16:07:17Z

Deployed checkpoint commit7705d062509cda7007ef3cdb8b12d8b5a015cc01.
Native Git build5f262dbc-68de-4d1c-a734-42c4feb9ad76 Success, 58s.
Production version12c5094a-7a9d-4b36-b860-9c72109f704a.
URL https://janasoochi.anandkalidindi28.workers.dev ; final HTTP smoke12/12PASS.
Upload2135.59KiB / gzip594.07KiB, startup31ms. Only two QA documents changed.
New-version CPU initially No data; previous measured16.01ms remains RISK.
Admin login/logout/re-login verified; Viewer session still pending. OVERALL
PARTIAL. Netlify ACTIVE, INR0, no DNS/Paid/schema/source-data change. Receipt
local only to avoid a self-referential documentation redeploy loop; pushed QA
checkpoint is the deployed7705d06. Next focused QA commit can carry this receipt.

## Latest real QA — 2026-09-14 (PARTIAL)

Exact Git-linked production commit da045b21c946f6dd638eb53776738379f7f75ddf;
build6f4accd3-32de-4b60-a7fb-d2919383c3f3 Success; active version
9b99f888-417c-4139-81aa-3acb20440331 at100% traffic. Actual URL unchanged.
REAL HTTP smoke12/12PASS; service-worker safe-shell source matches production.
Fresh TypeScript/lint PASS, web68PASS/1existingOCRskip, require-admin5/5PASS.
Native vinext build/deploy PASS; Next production build previously PASS with
unchanged application code. No UI/runtime/schema/RLS/extraction rewrite.

Owner-assisted Admin login/SSR/direct refresh, logout/protected rejection,
Admin login again, uploaded-record Search (Part+Serial and house alone),
Documents, paginated Review/search, correction modal/cancel, Data Quality
Part/language/view filters and reconciliation pagination, Administration
modal/cancel, private uploaded PDF paging/zoom and exact voter-card highlight
verified. No source/voter edits, OCR, archive, exports or role changes executed.
Viewer session still pending owner sign-in; local tests are not production
Viewer evidence. Forced token-expiry renewal is not separately verified.

Intermittent immediate browser load warnings later rendered successfully;
no correlated runtime stack captured. Live-only Logs enabled (persist false),
but observed stream remained empty, so full log inspection is unverified.
Telemetry75invocations/0 aggregate errors; active medianCPU16.01ms, wall117ms.
Free10ms CPU allowance has burst flexibility, not sustained safety:
https://developers.cloudflare.com/workers/platform/limits/ . Free-tier RISK.
Do not upgrade or switch adapters speculatively. Netlify independently login200,
ACTIVE; DNS unchanged; INR0. PWA assets/safe-shell PASS, mobile/offline install
NOT VERIFIED. OVERALL PARTIAL. See latest checkpoint for exact remaining task.

## Live production — 2026-09-14 (PARTIAL)

Owner approved the disclosed native build token. Existing private GitHub
18me1a0327/JANASOOCHI/main is connected, root '.', vinext and existing
pnpm build:cloudflare / pnpm deploy:cloudflare retained. Access OFF, no Paid.
Both public Supabase build/runtime variables stored encrypted; existing
zlgwpegklxzmwppghvst project retained; no service-role/deployment secrets exposed.

URL: https://janasoochi.anandkalidindi28.workers.dev
Successful retry build: ca11a8cb-e8b8-4228-80b1-dc18f39bd769
Version: 5a68e94f-8c76-4451-b49e-ecd79566c6c9
Deployment timestamp: 2026-09-14T06:01:11Z
Upload: 2135.59KiB raw / 594.62KiB gzip; startup22ms.

Runtime-variable save raced the first Git deployment and published the initial
Hello World code. Reproduced production root200 instead of307; deployment
history confirmed the Add secret placeholder version. Retried unchanged Git
build after saving variables; --keep-vars retained runtime values. Re-ran
REAL production smoke: 12/12 PASS (redirects/configured login/no-store,
anonymous and spoofed-role rejection, source protection, PWA assets, safe404).
Native Linux frozen install/build/deploy PASS. No code fix/adapter change needed.
Manual build UI exposes main but no SHA (Empty commit message); remote main
2692ba913a2176773280582fe9bd96c85d482636 is not independently certified as
the deployed commit. Verify the next documentation-triggered Git build SHA.

Authenticated production QA remains pending owner sign-in on the live login
page. Auth/session refresh/logout, Admin/Viewer, Review/Quality data and private
source/card viewer cannot be called PASS from anonymous/local tests. PWA HTTP
assets PASS; actual registration/offline/auth-cache/mobile install NOT VERIFIED.

Free-tier RISK: actual initial telemetry17 invocations/0 errors, active-version
medianCPU106.3ms; mixed-version CPU P50=3.66/P90=98.41/P99=102. Do not confuse
wall-clock latency/startup with per-request CPU. Profile warm authenticated
routes before accepting Free compatibility; do not automatically upgrade.
Observability Disabled, so Worker runtime logs have not been inspected.
Netlify remains ACTIVE, DNS unchanged, INR0. OVERALL PARTIAL.
See latest CODEX_CHECKPOINT for next exact task; older blockers below historical.

## Latest unblock — GitHub PASS, build-token approval required

Cloudflare now exposes 18me1a0327/JANASOOCHI; selected the existing private repo.
Creation form is configured for janasoochi, pnpm build:cloudflare,
pnpm deploy:cloudflare, path '.', production-only builds and Access OFF.
Main branch must be verified after project creation; no deployment submitted.

Native Git build setup proposes automatically creating a user token with
Workers Scripts plus KV/R2/D1/Vectorize/Queues/Pipelines/Containers/Cloudchamber/
AI Search edit permissions, Connectivity Directory read/bind, account settings
read, all-zone Worker routes edit and user details/memberships read. Owner
approval is required before this broader access is created. No token created
or value exposed; no verified narrower existing selection was available here.
Do not click Deploy until this approval and both public Supabase build/runtime
variables are configured. No new Access policy, Paid plan or schema/RLS change.
Deployment remains BLOCKED; all production QA remains unverified. See latest
checkpoint; earlier blocked-GitHub sections below are historical.

## Automatic deployment continuation — 2026-09-14

GitHub connection BLOCKED: signed-in creation screen still stops at Connect
GitHub, with no selectable JANASOOCHI repository. Keyboard activation also
did not advance; Wrangler remains unauthenticated. OWNER ACTION REQUIRED at
this connection step in the normal browser; approve ONLY the private
18me1a0327/JANASOOCHI repo if prompted. No approval/deployment success assumed.
Local public Supabase URL/key presence validated without printing values;
Cloudflare environment remains PARTIAL. No Worker URL/version/commit confirmed.
Unchanged passing builds/tests reused; no reinstall or repeated expensive gate
while connection is blocked. Netlify login independently HTTP200, fallback
ACTIVE, INR0. See the latest checkpoint for exact continuation and QA limits.

Checked 2026-09-13. PARTIAL: builds/local anonymous QA pass. The owner is
browser-authenticated, but the supplied account has no deployed projects;
GitHub connection/deployment and signed-in production QA remain pending.

## Latest production verification

Authenticated Workers & Pages dashboard shows "No projects found", no filter,
0 requests/CPU/events/build minutes, and account subdomain
anandkalidindi28.workers.dev. This is not deployed runtime evidence. The expected
janasoochi hostname failed a single TLS probe; no production URL/version/commit
is confirmed. Wrangler authorization is unavailable in this process.

Owner requested project creation/deployment. Workers creation flow is open, but
no Git provider is connected and Connect GitHub did not advance in the in-app
browser. Owner must connect GitHub in a normal browser and approve ONLY the
existing private 18me1a0327/JANASOOCHI repository. Do not grant all-repository
access, publish an empty Worker or use temporary anonymous deployment.
Owner reported completion, but refreshing/retrying with accessibility and
Playwright still did not expose a selectable repository in this session.
The provider-connection step remains hidden. Account approval is not certified
as usable here; a visible repository selector or authorized Wrangler deployment
is needed to continue.

Continue with root '.', main branch, build pnpm build:cloudflare and deploy
pnpm deploy:cloudflare. Both existing public Supabase variables are required
at build and runtime. Never configure a service-role key in the web Worker.
No paid service enabled; Netlify fallback remains active.

Re-run results: TypeScript/lint/68 web tests PASS (one existing skip), vinext
check/Worker build/Next build PASS, fresh built-workerd smoke 12/12 PASS.
Wrangler dry-run still fails native esbuild parent-drive access in this sandbox;
use Git/Linux build or the owner's normal terminal rather than changing adapters.
All real authenticated production routes, logs and per-request CPU remain
unverified. See CODEX_CHECKPOINT for exact continuation and evidence boundaries.

## Adapter/build

Pinned vinext 1.0.0-beta.9, @vinext/cloudflare 1.0.0-beta.7,
@cloudflare/vite-plugin 1.54.8, @vitejs/plugin-rsc 0.5.34,
react-server-dom-webpack 19.2.8 and Wrangler 4.131.1.
The [official guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
recommends vinext; the [adapter docs](https://github.com/cloudflare/vinext)
support this Next.js 16 App Router/proxy/cookies/SSR/dynamic-route usage.
vinext check found no blocking imported-API gaps (4/4 Next modules supported,
9 pages/5 layouts). App Router StrictMode wrapping is partial; adapter remains
beta. OpenNext was not added: no blocking feature gap found. Compatibility
coverage is NOT OCR accuracy.

Separate vite.cloudflare.config.ts preserves legacy Vite tests and normal
Next/Netlify commands/configuration. No Pages/static export/SPA catch-all.
Use Node22+ and committed pnpm lockfile:

```bash
pnpm install
pnpm check:cloudflare
pnpm build:cloudflare
pnpm preview:cloudflare --port 8787
# Another terminal:
pnpm smoke:cloudflare http://localhost:8787
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Output: dist/server/wrangler.json, Worker/SSR JS, dist/client public assets.
build:cloudflare finishes with next typegen because vinext overwrites
.next/types/routes.d.ts and otherwise conflicts with stale Next validators.
Reproduced and fixed without weakening TypeScript.

Official Cloudflare Vite preview runs the built Worker in workerd. Wrangler
preview/deploy dry-run hits esbuild's denied parent-drive directory scan in
this Windows sandbox. Repeat dry-run/upload verification in a normal terminal
or Cloudflare Linux build. For sandbox preview only, use private temporary
XDG_CONFIG_HOME/WRANGLER_LOG_PATH directories to avoid denied global tool-state
writes. Never put tool state under public assets.

## Security/environment

lib/cloudflare/worker.ts delegates unchanged to vinext's typed App Router
handler, adding private/no-store to Worker responses including redirects/RSC.
Config headers alone missed redirects (caught in smoke tests). Wrapper preserves
status, location, streaming body and multiple Set-Cookie headers. ASSETS serves
public files first; hashed JS/CSS retain immutable caching. html_handling=none
preserves exact /offline.html. No KV/Images/D1/R2/AI/cache binding enabled.

Supabase getUser validation, server profile/Admin gates, private Storage/RLS and
browser refresh/logout remain unchanged. No schema migration or OCR move.

| Variable name | Classification | Usage |
| --- | --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | PUBLIC | Build + Worker runtime |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | PUBLIC, not service-role | Build + Worker runtime |
| CLOUDFLARE_ACCOUNT_ID | SERVER-ONLY deployment metadata | Existing owner's account |
| CLOUDFLARE_API_TOKEN | SECRET, optional | CI/deploy only; not created here |

Legacy VITE_SUPABASE aliases are public but not Worker requirements. No actual
values printed. No service-role/secret key in frontend. Configure both public
names at build and runtime. Vite emits ignored dist/server/.dev.vars for local
preview; never commit/publish it. No secrets exist in dist/client.
OAuth credentials stay in private Wrangler state, never Git.

## Exact pending owner action

Supplied account dashboard redirected to login; wrangler whoami unauthenticated.
Official OAuth page opened for owner approval; no password/token requested.
The attempt expired without approval; no deployment URL was created.
If authorization expires, run in the owner's normal terminal:

```bash
pnpm exec wrangler login
pnpm exec wrangler whoami
```

Set CLOUDFLARE_ACCOUNT_ID to the existing account shown in the supplied dashboard
URL. Stay on Workers Free. Build with the two public Supabase values; configure
the same two under Worker's runtime Variables before deployment:

```bash
pnpm build:cloudflare
pnpm exec wrangler deploy --config dist/server/wrangler.json --dry-run
pnpm deploy:cloudflare
pnpm smoke:cloudflare https://THE-RETURNED-WORKER-URL
```

deploy:cloudflare uses --keep-vars to retain dashboard runtime configuration.
No anonymous temporary production deployment. For Cloudflare Git builds,
connect ONLY the existing private JANASOOCHI repo: root ".", build command
pnpm build:cloudflare, deploy command pnpm deploy:cloudflare, both public
variables in build/runtime settings. Owner approves any new GitHub permissions.
No new repository integration/paid CI/DNS change was enabled here.

## Evidence/limits

- TypeScript/lint/Next production build/actual Worker build PASS.
- Web 68 passed, 1 existing real-OCR fixture skip. New tests: five server Admin
  gate cases + four cookie/streaming/redirect/failure response-wrapper cases.
- Built-workerd HTTP smoke 12/12 PASS: home/login, seven protected routes
  (anonymous and spoofed role), manifest/icons, SW/exact offline path, safe404.
- Browser EN/TE/UR switch/persistence and anonymous Admin direct load/refresh PASS.
  Owner interaction initially yielded signed-in workspace requests, but this is
  not a complete independently certified signed-in role/refresh/source QA run.
- Later authenticated local request reproduced workerd AuthRetryableFetchError
  (outbound fetch internal error); eventually safe login redirect, not stacktrace.
  Node Supabase settings probe HTTP200/email on/Google off. Do not call DB down.
  Sandbox-specific authenticated native egress unresolved; no TLS/auth bypass.
- Google/callback N/A: not implemented/configured. No unrelated OAuth feature added.
- PWA privacy/shell tests pass. Production HTTPS installation, mobile, signed-in
  source highlights, refresh/logout/offline and real Viewer/Admin matrix pending.
- Netlify fallback /login independently HTTP200 with login markup, unchanged.
- No real voter PDFs/crops/exports, secrets or build artifacts added to Git.

[Free limits](https://developers.cloudflare.com/workers/platform/limits/):
10ms CPU/request, 100k requests/day, 3MB compressed Worker, 50 external
subrequests. Measured 56 client assets (~4.73MB), 106 Worker/SSR JS modules:
2,186,647 raw bytes; 637,273 summed per-module gzip bytes. This is an estimate,
NOT Wrangler's final upload size. Static assets do not count as Worker JS.

Free-tier fit RISK: no live CPU telemetry without deployment. Elapsed local
time includes network wait, not billed CPU. Risk: login/proxy, all authenticated
SSR, especially Admin/Review/Quality/Source. Admin path can make ~5 Supabase
calls (proxy getUser, workspace getUser/profile, Admin getUser/profile), plus
bounded refresh retries. Search/lists remain paginated browser-to-Supabase;
PDF/OCR/benchmarks remain outside Workers. If normal requests repeatedly exceed
Free CPU, report NOT SAFE and retain Netlify; never buy Paid/weaken auth/cache
private HTML as a shortcut.

Money spent INR0. Netlify fallback ACTIVE; DNS unchanged. Next: owner Wrangler
authorization, deploy from nonrestricted build, full signed-in role/session/
source/PWA/mobile and live CPU QA before changing the canonical production host.

