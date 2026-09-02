# Janasoochi MVP Requirements

## Supported scope

- Pallerlamudi electoral-roll Parts 227, 228, 229, and 230 only.
- Authorized source PDFs only; no scraping, external voter databases, placeholder APIs, or fabricated records.
- English (`en`), Telugu (`te`), and Urdu (`ur`) source documents and UI presentation.
- Supabase Auth with `admin` and `viewer` roles enforced by routes, RLS, and server-side functions.

## Required workflow

1. Admin uploads a PDF.
2. Validate PDF payload and supported Part.
3. Detect source language and prevent duplicate checksums.
4. Save the authorized source in Supabase Storage.
5. Process each physical page independently using embedded text or OCR fallback.
6. Retry a failed page at most twice; mark it for review and continue the document.
7. Store source values, normalized search values, page numbers, confidence, and bounding boxes when available.
8. Reconcile language-specific records to one logical voter.
9. Search with optional AND filters and controlled fuzzy name matching.
10. Open the exact original source page for verification.
11. Preserve original OCR values when an administrator saves corrections or marks a record verified.

## Review queue

- Server-side pagination with 25, 50, or 100 rows per page; default 50.
- Database-side filters for severity/category, Part, and source language.
- One paginated RPC joins issue, voter, page, and document data.
- No browser query may construct a mass voter-ID `IN (...)` list.
- Session, permission, query, and network failures must have distinct user messages.

## Counting model

- The electoral population is the logical voter total, not the sum of language copies.
- Part + serial number identifies the baseline logical voter.
- Language coverage reports linked, unavailable, and requires-review representations separately.
- A language switch must not change the logical total.

## Security and privacy

- Public registration is disabled.
- Only admins can upload, replace/delete documents, edit OCR, verify records, or manage accounts.
- Service-role credentials are server-side only.
- All exposed tables/storage objects use RLS.
- No secrets, credentials, source PDFs, OCR page images, or exported voter datasets belong in Git.

## Release gate

- TypeScript, lint, unit tests, and production build pass.
- Authentication, role restrictions, search, source viewing, Review pagination, correction, verification, language switching, responsive navigation, and SPA deep links are tested.
- No blank screens, raw stack traces, fake success messages, dead controls, or known oversized Review queries.
