# Extraction Pipeline Selection and Freeze

Phase 2H adds an evidence gate and auditable freeze-manifest contract. It does
not select or activate an OCR engine in the current repository because Phase
2G has zero human-verified GOLD records and no measured candidates.

## Selection gate

`select_pipeline_candidate` accepts a privacy-safe Phase 2G report and an
explicit `PipelineSelectionPolicy`. The policy supplies the minimum GOLD card
count and measured configuration count, exact-accuracy gates for all eight
fields, CER/WER limits for names, failure and empty-output limits, and an
optional runtime-per-card limit. No accuracy threshold is hidden or hard-coded
by the selector.

Selection is blocked unless the report has:

- a verified GOLD checksum;
- English and Telugu coverage;
- Parts 227, 228, 229, and 230 coverage;
- enough cards and measured configurations for the supplied policy;
- one complete, duplicate-free ranking containing every configuration.

Every exact/CER/WER gate is applied both overall and independently to English
and Telugu. This prevents a high overall average from hiding weak Telugu or a
critical field such as EPIC. The first ranked candidate that passes every gate
is selected; if none passes, no manifest is created.

## Freeze manifest

`freeze_selected_pipeline` verifies that the selection belongs to the exact
comparison report, then captures:

- report and GOLD checksums;
- the complete selection policy;
- exact OCR engine, engine version, preprocessing and retry configuration;
- the selected metrics snapshot;
- pipeline, preprocessing, parser, and OCR processing versions;
- approving user UUID, timezone-aware approval time, and decision reason.

`frozen_manifest_json` and `frozen_manifest_sha256` produce deterministic,
privacy-safe artifacts containing no voter values. Creating a manifest does
not silently activate it. Persistence and production activation must be an
explicit later operation after real evidence exists.

## Current blocker

No real pipeline may be selected or frozen until a private validated Phase 2F
GOLD subset spanning EN/TE and all four Parts has been processed through each
Phase 2G candidate on the identical cases. No populated manifest is committed.

