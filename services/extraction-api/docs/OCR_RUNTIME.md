# Private OCR runtime preflight

This checks prerequisites only: no PDF is read, no OCR is run, no database row is
written, and runtime availability is not accuracy or a production pipeline freeze.

From `services/extraction-api`:

```powershell
python -m app.ocr.runtime
python -m app.ocr.runtime --binary 'C:\Program Files\Tesseract-OCR\tesseract.exe'
```

Exit 0 means the executable reports a version and both `eng` and `tel`; exit 2
means blocked. The JSON reports exact missing prerequisites, never subprocess
stderr, voter values or language-header private paths. A supplied executable
override must resolve and never silently falls back to another executable.

If missing, install Tesseract for Windows from the distribution linked by the
[official Tesseract documentation](https://tesseract-ocr.github.io/tessdoc/Installation.html),
including English (`eng`) and Telugu (`tel`) traineddata. Add its directory to
your process PATH, or pass `--binary` and use the same explicit path when creating
the existing `TesseractOcrAdapter`. Check `TESSDATA_PREFIX` if language data is
installed but absent from `--list-langs`. No system installer/elevation, paid
API, new OCR engine, or unrelated package is run by this preflight.

Once ready, use the existing renderer/segmentation/field/retry pipeline for a
few authorized EN/TE cards only, storing outputs privately. Do not perform a
full-roll ingestion until genuine human GOLD, comparison and freeze gates pass.
Follow `GROUND_TRUTH.md`; OCR cannot mark itself as human-verified GOLD.

