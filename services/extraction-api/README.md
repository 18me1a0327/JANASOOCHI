# JANASOOCHI Extraction API

Phase 2 foundation for reliable server-side electoral-roll extraction. This
service validates and fingerprints PDFs, renders one physical page at a time,
exposes typed processing-job contracts, and deterministically segments visible
three-column voter grids into up to 30 ordered card regions. Validated English
and Telugu cards can be split into typed field crops for the eight required
voter fields. Field-specific English and Telugu OCR adapters are available; the
service still does not perform full-roll processing.

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

## English and Telugu OCR

The default Docker image includes Tesseract plus verified `eng` and `tel`
language packs. The adapter sends in-memory PNG bytes through standard input,
uses numeric/alphanumeric restrictions for Serial, Age, and EPIC, and never
writes a field crop to disk. Raw engine transcription is retained separately
from normalized search/validation text. Confidence is nullable and is populated
only from an engine-reported value.

A lazy PaddleOCR v3 text-recognition adapter supports the official English and
Telugu mobile recognition model contracts. Its heavyweight runtime and model
downloads are intentionally excluded from the default Search/runtime image;
install `requirements-paddle.txt` only in a controlled benchmark worker. The
benchmark helper reports exact normalized accuracy solely against explicitly
supplied expected values and does not claim production accuracy.

## Targeted OCR retry and recovery

`app.ocr.recognize_card_fields` retries only the field that produced a
retryable OCR error. A field receives at most two retries after the original
attempt, using the fixed sequence `original`,
`grayscale_high_contrast`, and `binary_otsu`. Successful fields on the same
card are not rerun, and a terminal field failure does not stop the remaining
fields.

Every attempt records its number, preprocessing variant, engine result or
user-safe error, and retryability. Original crop bytes and geometry are never
modified. Low-confidence retry is opt-in through `OcrRetryPolicy`; the service
does not invent a confidence threshold. When an explicit threshold triggers
multiple successful attempts, the result with the highest real engine
confidence is selected while all attempts remain in the typed result. This
module does not retry whole pages or documents and does not persist attempts;
future job storage can serialize the result without rerunning successful work.

## Human-verified benchmark ground truth

Phase 2F adds strict, engine-independent ground-truth contracts and a
header-only CSV template. Each annotation links to a revision, supported Part
and serial, EN/TE source edition, PDF checksum, physical page, card index,
optional bounding box, Supabase verifier UUID, and timezone-aware verification
timestamp. RAW, deterministically NORMALIZED, and human-entered GOLD values
remain separate.

Validate a private authorized annotation file with:

```powershell
python -m app.benchmark C:\private\authorized-ground-truth.csv
```

The validator prints coverage metadata only, never voter fields. It rejects
Urdu, unsupported Parts, out-of-range serials, malformed evidence, invalid
verifier audit data, mismatched GOLD serials, duplicate cases, and duplicate
Part/Serial/language identities. See `docs/GROUND_TRUTH.md`. No populated
ground-truth file, voter crop, or accuracy claim is committed by this phase.

## OCR accuracy comparison

Phase 2G adds a typed, privacy-safe comparison framework for evaluating
Tesseract, PaddleOCR, preprocessing, and targeted-retry configurations against
the identical validated GOLD case set. It reports exact field metrics, name
CER/WER, invalid EPIC formats, age error, EN/TE and Part-level aggregates,
retry impact, failures, runtime, optional memory observations, and deterministic
error classes. Machine-readable JSON contains metrics only and never voter
values. See `docs/OCR_COMPARISON.md`.

No populated human-verified GOLD records currently exist in this repository,
so no real OCR accuracy or winning configuration is reported.

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

