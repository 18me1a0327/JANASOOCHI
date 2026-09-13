"""Private, read-only Tesseract preflight. This does not run OCR or qualify GOLD."""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
from pathlib import Path

from pydantic import BaseModel, Field


class OcrRuntimeReport(BaseModel):
    ready: bool = False
    binary: str | None = None
    engine_version: str | None = None
    available_languages: list[str] = Field(default_factory=list)
    missing_languages: list[str] = Field(default_factory=lambda: ["eng", "tel"])
    blockers: list[str] = Field(default_factory=list)


def discover_binary(explicit: str | None = None) -> str | None:
    # An explicit override must not silently fall back to a different engine.
    if explicit:
        return shutil.which(explicit)
    binary = shutil.which("tesseract")
    if binary:
        return binary
    candidates = [
        Path(os.environ.get("ProgramFiles", "C:/Program Files")) / "Tesseract-OCR/tesseract.exe",
        Path(os.environ.get("LOCALAPPDATA", "C:/Users/Default/AppData/Local"))
        / "Programs/Tesseract-OCR/tesseract.exe",
    ]
    return next((str(path) for path in candidates if path.is_file()), None)


def inspect_runtime(explicit: str | None = None) -> OcrRuntimeReport:
    binary = discover_binary(explicit)
    if binary is None:
        return OcrRuntimeReport(blockers=["Tesseract executable unavailable. Install Tesseract with eng and tel traineddata, then rerun preflight."])
    try:
        version = subprocess.run([binary, "--version"], capture_output=True, timeout=10, check=False)
        languages = subprocess.run([binary, "--list-langs"], capture_output=True, timeout=10, check=False)
    except subprocess.TimeoutExpired:
        return OcrRuntimeReport(binary=binary, blockers=["Tesseract runtime probe timed out."])
    except OSError:
        return OcrRuntimeReport(binary=binary, blockers=["Unable to execute Tesseract runtime probe."])
    if version.returncode != 0 or languages.returncode != 0:
        return OcrRuntimeReport(binary=binary, blockers=["Tesseract version/language probe failed. Check installation and TESSDATA_PREFIX privately."])
    lines = version.stdout.decode("utf-8", errors="replace").splitlines()
    if not lines or not lines[0].startswith("tesseract ") or not lines[0].removeprefix("tesseract ").strip():
        return OcrRuntimeReport(binary=binary, blockers=["Unrecognized Tesseract version response."])
    # Tesseract's list header contains a private filesystem path; never return it.
    language_lines = languages.stdout.decode("utf-8", errors="replace").splitlines()
    available = sorted({line.strip() for line in language_lines if line.strip() and not line.startswith("List of available languages")})
    missing = sorted({"eng", "tel"} - set(available))
    return OcrRuntimeReport(
        ready=not missing, binary=binary,
        engine_version=lines[0].removeprefix("tesseract ").strip(),
        available_languages=available, missing_languages=missing,
        blockers=["Required traineddata unavailable: " + ", ".join(missing)] if missing else [],
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Check EN/TE OCR runtime without reading voter data or running OCR.")
    parser.add_argument("--binary", help="Existing Tesseract executable path; no installation is performed.")
    options = parser.parse_args()
    report = inspect_runtime(options.binary)
    print(json.dumps(report.model_dump(), indent=2))
    return 0 if report.ready else 2


if __name__ == "__main__":
    raise SystemExit(main())

