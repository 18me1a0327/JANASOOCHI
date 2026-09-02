# జనసూచి — Janasoochi

![Janasoochi logo](public/janasoochi-logo-800.png)

Authorized Pallerlamudi electoral-roll search and source verification for Parts **227, 228, 229, and 230**. The application ingests only PDFs uploaded by authorized administrators, extracts English/Telugu/Urdu records, preserves source values, and links every result back to its original physical PDF page.

## Technology

- React 19 + TypeScript + Vite
- Supabase Auth, PostgreSQL, Row Level Security, Storage, and Edge Functions
- PDF.js for text extraction and page rendering
- Tesseract.js for scanned-page OCR fallback (`eng`, `tel`, `urd`)
- Vitest and ESLint

## Local setup

Requirements: Node.js 20+, pnpm 9+, and a Supabase project.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Configure only the public browser values in `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

Never put a service-role key in a `VITE_` variable or in the browser bundle.

## Supabase setup

Apply the SQL files in `supabase/migrations` in numeric order. Migration `007_paginated_review_rpc.sql` provides the admin-only, server-side paginated Review queue and prevents oversized browser `IN (...)` requests.

Deploy the administrator user-management function:

```bash
supabase functions deploy admin-users
```

Create the first Auth user in the Supabase dashboard, then assign that user's `profiles.role` to `admin`. Public registration is intentionally disabled. Administrators can upload/process documents, review/correct OCR, verify records, and manage authorized users. Viewers can search, view documents/results, and open original source pages.

## Quality commands

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

`pnpm test:watch` runs unit tests interactively. OCR integration tests require the explicitly configured local fixture and are skipped when it is absent.

## Netlify deployment

The included `netlify.toml` builds the Vite application and redirects SPA routes to `index.html`. In Netlify, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as environment variables, then deploy the `main` branch. Do not store credentials in the repository.

## Data integrity

- Only Parts 227–230 are accepted.
- Missing fields remain `NULL`; source values are never guessed or overwritten.
- The same logical voter across language editions is counted once by Part + serial number.
- English, Telugu, and Urdu are source representations, not additional voters.
- The current logical baseline is 3,454 voters; language coverage is reported separately.
- Invalid uploads, including HTML error pages disguised as `.pdf`, are rejected.
- Low-confidence or suspicious fields remain in the Review queue with their original OCR text.
- Uploaded source PDFs and voter records remain protected by Supabase RLS.

See [REQUIREMENTS.md](REQUIREMENTS.md) for the supported product scope.

## License

Proprietary. See [LICENSE](LICENSE).
