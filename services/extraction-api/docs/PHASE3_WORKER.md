# Phase 3C page worker

`PageIngestionWorker` composes the already-tested renderer, deterministic grid
segmentation, fixed field crops, targeted field OCR, source-layer validation,
Review mapping, and the backend-only atomic Supabase page RPC.

## Safety properties

- A physical page is the persistence and resume boundary.
- Render/segmentation failures receive at most two page retries.
- OCR retries remain field-specific and capped by `OcrRetryPolicy`.
- Database retries reuse the exact prepared batch; they do not rerun OCR.
- One card failure is recorded in `card_states` and cannot terminate the page.
- One page failure cannot terminate `process_pages` for later pages.
- Source records remain `unverified` or `requires_review`; the worker never sets
  logical identity, corrections, human verification, or Golden status.
- The worker refuses to start unless its OCR adapter and version match an
  explicitly selected pipeline contract.
- Urdu remains rejected by the Phase 3 work request until a verified Urdu
  extraction path exists.

`PageWorkRequest` carries private PDF bytes only inside the worker runtime. It
is not a public HTTP contract and its byte field is excluded from object
representations. `PageWorkOutcome` exposes counts and safe error codes/messages,
not source voter values.

## Runtime boundary

The orchestration is implemented and covered with synthetic fixtures. Running
it against real voter rolls still requires a private worker runtime containing
the selected EN/TE OCR engine, a server-only Supabase secret, and authorized
human source verification. No real roll OCR or database mutation is performed
by the automated tests.

