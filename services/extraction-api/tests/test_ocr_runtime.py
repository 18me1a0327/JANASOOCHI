import subprocess

import pytest

from app.ocr import runtime


def test_missing_binary_is_blocked(monkeypatch):
    monkeypatch.setattr(runtime, "discover_binary", lambda explicit: None)
    result = runtime.inspect_runtime()
    assert not result.ready
    assert result.missing_languages == ["eng", "tel"]
    assert result.engine_version is None


@pytest.mark.parametrize("langs,ready,missing", [
    (b'List of available languages in "PRIVATE" (2):\neng\ntel\n', True, []),
    (b'List of available languages in "PRIVATE" (1):\neng\n', False, ["tel"]),
])
def test_version_and_language_probe(monkeypatch, langs, ready, missing):
    monkeypatch.setattr(runtime, "discover_binary", lambda explicit: "tesseract")
    calls = []
    def run(args, **kwargs):
        calls.append(args)
        return subprocess.CompletedProcess(args, 0, b"tesseract 5.5.0\n" if "--version" in args else langs, b"")
    monkeypatch.setattr(runtime.subprocess, "run", run)
    result = runtime.inspect_runtime()
    assert result.ready is ready
    assert result.missing_languages == missing
    assert result.engine_version == "5.5.0"
    assert "PRIVATE" not in result.model_dump_json()
    assert calls == [["tesseract", "--version"], ["tesseract", "--list-langs"]]


@pytest.mark.parametrize("error", [OSError("PRIVATE"), subprocess.TimeoutExpired("probe", 10)])
def test_probe_failure_is_safe(monkeypatch, error):
    monkeypatch.setattr(runtime, "discover_binary", lambda explicit: "tesseract")
    def run(*args, **kwargs):
        raise error
    monkeypatch.setattr(runtime.subprocess, "run", run)
    result = runtime.inspect_runtime()
    assert not result.ready
    assert "PRIVATE" not in result.model_dump_json()


@pytest.mark.parametrize("code,payload", [(1, b"PRIVATE"), (0, b"not tesseract")])
def test_failed_or_malformed_probe_is_blocked(monkeypatch, code, payload):
    monkeypatch.setattr(runtime, "discover_binary", lambda explicit: "tesseract")
    monkeypatch.setattr(runtime.subprocess, "run", lambda args, **kwargs: subprocess.CompletedProcess(args, code, payload, b"PRIVATE"))
    result = runtime.inspect_runtime()
    assert not result.ready
    assert result.blockers
    assert "PRIVATE" not in result.model_dump_json()


def test_explicit_binary_does_not_fallback(monkeypatch):
    monkeypatch.setattr(runtime.shutil, "which", lambda value: None if value == "wrong-path" else "tesseract")
    assert runtime.discover_binary("wrong-path") is None

