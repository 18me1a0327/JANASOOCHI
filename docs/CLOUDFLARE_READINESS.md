# Cloudflare Workers migration

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
