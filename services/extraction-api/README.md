# JANASOOCHI Extraction API

Phase 2 foundation for reliable server-side electoral-roll extraction. This
service validates and fingerprints PDFs, renders one physical page at a time,
exposes typed processing-job contracts, and deterministically segments visible
three-column voter grids into up to 30 ordered card regions. Validated English
and Telugu cards can be split into typed field crops for the eight required
voter fields. It does not yet perform OCR or full-roll processing.

## Safety boundary

- Only files with a `.pdf` filename and `%PDF-` at byte zero are accepted.
- Only Parts 227, 228, 229, and 230 are accepted.
- Only English (`en`/`ENG`), Telugu (`te`/`TEL`), and Urdu (`ur`/`URD`) are
  accepted. Urdu is never synthesized; an Urdu file must pass the same PDF
  validation as every other source.
- Upload bytes are bounded by `JANASOOCHI_EXTRACTION_MAX_UPLOAD_MIB`.
- User-facing API errors never expose a stack trace. Technical details remain
  in service logs.
- The future Supabase secret key is backend-only and must never use a
  `NEXT_PUBLIC_` name.
- Segmentation returns integer `x1, y1, x2, y2` coordinates in the rendered PNG
  coordinate system. Empty candidate cells do not become card records.

## Deterministic card segmentation

`app.vision.segment_page` detects regularly spaced horizontal grid boundaries,
validates four vertical boundaries for exactly three columns, and checks each
candidate's inner area for content. Results are ordered row first, then column;
`card_index` is positional and is never treated as an electoral-roll serial.
Non-voter pages return zero cards, while malformed and unsupported layouts use
typed extraction errors. `segment_pages` isolates an expected failure to its
physical page. `app.vision.debug.render_segmentation_overlay` creates an
in-memory development PNG with boxes and indices; it is not exposed by an API.

## Field-region extraction

`app.vision.extract_card_field_regions` applies an explicit EN or TE fixed-card
template using normalized card coordinates. It returns serial number, EPIC,
voter name, relation name/type, house number, age, and gender crops with both
card-relative and rendered-page pixel bounding boxes. Crops and development
overlays exist only in memory and are not persisted or publicly exposed.
`extract_page_field_regions` isolates an invalid card and continues the page.
Urdu has no Phase 2C template and is rejected until valid source files and a
verified layout are available.

## Local development

Requires Python 3.12 or newer.

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements-dev.txt
.\.venv\Scripts\python -m pytest
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

OpenAPI is available at `http://127.0.0.1:8000/docs`.

## Docker

```text
docker build --target test -t janasoochi-extraction-test .
docker run --rm janasoochi-extraction-test

docker build -t janasoochi-extraction-api .
docker run --rm -p 8000:8000 janasoochi-extraction-api
```

## Implemented endpoints

- `GET /api/v1/health`
- `POST /api/v1/jobs`
- `GET /api/v1/jobs/{job_id}`
- `POST /api/v1/documents/validate`
- `POST /api/v1/pages/render`

The job repository is intentionally an in-process development implementation in
this sprint. The `JobRepository` protocol and `ProcessingRunInsert` mapping are
the stable boundary for the next integration sprint. Production wiring must use
an authenticated, backend-only Supabase client and persist to the existing
`processing_runs` table; it must not place a secret key in the web application.

Processing versions are returned by `/health` and every job, and map into the
existing `processing_runs.metrics.versions` JSON field. This lets future workers
selectively reprocess records without re-running every PDF.
