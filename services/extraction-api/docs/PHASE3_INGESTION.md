# Phase 3 — Source Ingestion and Reconciliation

## Boundary

This phase adds deterministic contracts for moving one extracted card through:

`SOURCE → RAW → NORMALIZED → RECONCILED → REVIEW`

It does not declare a voter verified and does not create a Golden Revision.
Those states require authorized review of real source evidence.

## Source records

Each candidate preserves the document, revision identifier, supported Part,
source language, physical and printed pages, positional card index, rendered
page bounding box, exact block-level OCR text, raw fields, normalized fields,
field confidence, engine/version, and processing versions.

Only English and Telugu are enabled. Urdu remains blocked until valid source
PDFs, a verified layout, and an implemented extraction path exist.

Validation does not repair source values:

- Serial must be numeric and within the configured Part range to become an
  identity key. Missing or invalid serials remain NULL/unlinked and require
  review.
- EPIC format problems are retained and flagged; no EPIC is invented.
- Age is stored as a number only when it fits the current database constraint.
- One malformed card becomes an isolated card failure; other page cards remain
  persistable.

## EN↔TE reconciliation

Within one revision, Part + Serial is the primary logical slot. The engine then
corroborates EPIC, normalized house number, age, and normalized gender. It does
not compare English and Telugu names literally. A structured conflict,
duplicate language source, invalid identity, or missing language representation
remains explicit and cannot be auto-verified.

## Completeness and conflict report

For each Part and language the report returns:

- expected serial count;
- total and valid source records;
- distinct expected serials;
- every missing serial;
- duplicate serial counts;
- invalid/unexpected source-record IDs;
- suspicious EPIC reuse across different serials;
- reconciliation status counts.

The expected totals are structural validation slots only: 227 = 1,014, 228 =
973, 229 = 888, and 230 = 579 (3,454 total). Missing slots do not generate fake
voter attributes or source records.

## Persistence safety

`SourceRecordInsert` maps only a validated candidate to the existing Supabase
schema. It never supplies `logical_voter_id`, `verified_by`, `verified_at`, or a
`verified` status. `PageProcessingUpsert` maps physical-page progress and card
states to the existing resumable page table. Production repository wiring must
remain backend-only and authenticated; no Supabase secret belongs in the web
bundle.

Migrations 013 and 014 install `persist_extracted_page_v1` as a transactional,
backend-service-only RPC. It serializes concurrent attempts for the same page,
validates document/Part/language/page ownership, caps the batch at 30 records,
rejects VERIFIED or logical-link fields, creates Review rows idempotently, and
writes one audit event. An identical stable record ID can be retried; a retry
that would change preserved source evidence is rejected instead of overwritten.

The backend repository sends current `sb_secret_...` credentials only through
the `apikey` header. A legacy service-role JWT additionally uses the bearer
header for compatibility. Both remain backend-only.

## Current production-data gate

The existing database has 3,454 expected logical slots and eight EN/TE source
documents. Aggregate inspection found substantial missing/invalid serial
coverage in some source editions and zero verified logical slots. Therefore a
Golden Revision must remain blocked until affected pages/cards are reprocessed
with measured OCR and reviewed against their PDFs.

`assess_golden_revision` enforces that boundary. It requires every one of the
3,454 configured slots exactly once, both language sources, both sources marked
verified, a reconciled state, and zero open Critical issues. It reports blockers
and never changes source or canonical records.

