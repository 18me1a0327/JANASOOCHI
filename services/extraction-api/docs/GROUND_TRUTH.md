# Human-Verified Ground Truth

Phase 2F provides a validation framework only. No voter records or claimed
accuracy figures are stored in this repository.

## Safe annotation workflow

1. Copy `ground-truth-template.csv` to a private, access-controlled location
   outside Git.
2. Select representative authorized English and Telugu voter cards across
   Parts 227, 228, 229, and 230.
3. Record the exact source PDF checksum, physical page, card index, and
   bounding box.
4. Put unmodified OCR output in the `raw_*` columns.
5. Put the human-verified transcription in the `gold_*` columns. Leave a
   value empty only when it is genuinely unavailable in the source.
6. Record the verifier's Supabase user UUID and a timezone-aware verification
   timestamp.
7. Validate the private file:

   ```powershell
   python -m app.benchmark C:\private\authorized-ground-truth.csv
   ```

The validator reports only checksum, counts, coverage gaps, and warnings. It
does not print voter fields. The normalized layer is derived deterministically
from RAW during import; GOLD is never generated or inferred.

## Required safety rules

- Never commit a populated ground-truth CSV, voter-card crop, electoral-roll
  PDF, or exported voter dataset.
- English and Telugu are distinct source records linked by Part and Serial.
- Urdu is rejected until valid Urdu source PDFs and processing support exist.
- The expected current-revision serial ranges are 1–1014 for Part 227, 1–973
  for Part 228, 1–888 for Part 229, and 1–579 for Part 230.
- A complete OCR confidence value is not an accuracy measurement.
- The approximately 480-card roadmap target is a coverage goal, not proof that
  a sample is representative or that an OCR configuration is accurate.
- Phase 2G must compare OCR configurations against the same verified GOLD
  records before reporting any measured accuracy.

