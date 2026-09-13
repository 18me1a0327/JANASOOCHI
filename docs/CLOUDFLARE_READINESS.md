# Cloudflare deployment readiness

Checked 2026-09-13. Status: PARTIAL — no Cloudflare build/deployment exists.

## Verified current frontend

| Setting | Current value |
| --- | --- |
| Framework | Next.js 16.3.4 App Router, React 19, TypeScript |
| Root | Repository root |
| Package manager | pnpm; commit `pnpm-lock.yaml` |
| Build / runtime | `pnpm build` / `pnpm start` |
| Build output | `.next` — not a static Pages upload directory |
| Public environment names | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| Source storage / database | Existing Supabase project; unchanged |
| Fallback | Existing `netlify.toml` and public Netlify production retained |

`vite.config.ts` and `src/` retain legacy components, but `package.json` builds
Next.js. Deploying the old Vite entry would omit the current Next.js shell,
Administration and Phase 4C work. Do not deploy it as the current application.

## Pages blocker and proposed alternative

Cloudflare's current [Pages guide](https://developers.cloudflare.com/pages/framework-guides/nextjs/)
targets static Next.js exports; full-stack Next.js uses Workers. This app uses
request cookies, Supabase server authentication, protected server layouts,
administrator checks and dynamic `/source/[pdfId]` routes. Static export would
require removing/replacing working server protections and is not authorized.
Do not add a catch-all `/index.html` redirect or publish `.next` to Pages.

Owner decision required: permit **Cloudflare Workers** for the existing web app,
with a tested compatible adapter, rather than static Pages. This changes hosting
only; Supabase and the Python worker remain separate. Cloudflare recommends
vinext for new deployments; [OpenNext](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/)
adapts existing Next.js build output. The latter guide currently marks Node.js
middleware unsupported, so compatibility with Next.js 16's `proxy.ts` must be
proven before changing dependencies or declaring readiness. No adapter has been
selected/installed, and no untested Wrangler config was added.

After approval: pin adapter/Wrangler versions, prove proxy/cookie compatibility,
build and test a local Worker preview, measure bundle/free-tier limits, then
connect only the existing private GitHub repository to the owner's Cloudflare
account. Do not automatically accept a paid plan, broad GitHub permissions or
paid storage bindings. Account authorization must be performed by the owner
where required. No authenticated Cloudflare connector is available in this run.

Public environment values must be configured at build and runtime. Never put a
Supabase service-role/secret key, database password, or deployment token in a
`NEXT_PUBLIC_*` variable, Git, public asset or frontend bundle. Existing frontend
uses only the two public environment names above; OCR credentials remain backend-only.

## Routing and production smoke gate

Preserve native Next.js routes and request-time authorization. Direct-load and
refresh `/`, `/login`, `/search`, `/documents`, `/review`, `/data-quality`,
`/administration`, `/profile`, and `/source/{documentId}?page={physicalPage}&voter={recordId}`.
Confirm anonymous redirects, Viewer/Admin boundaries, sign-in/session refresh,
logout, EN/TE/UR UI, exact-source page/bbox, desktop/mobile and server errors.
Production smoke checks are BLOCKED until a compatible authenticated deployment exists.

## PWA contract (unchanged)

- `/manifest.webmanifest`: standalone, start URL `/search`, EN default, 192/512 PNG icons.
- `/sw.js`: navigation is network-first with `/offline.html` fallback. Its explicit
  cache allowlist contains only offline HTML, manifest and icons; no voter API,
  authenticated page, private PDF, search result or export is broadly cached.
- Paths are rooted at `/`; publish at an HTTPS origin root and retain the icon
  safe area. Verify installation and offline/logout behavior in the final preview.
- Do not add Cloudflare edge caching for authenticated HTML or sensitive records.

No UI, auth, RLS, database, Netlify deployment or source voter data was modified.

