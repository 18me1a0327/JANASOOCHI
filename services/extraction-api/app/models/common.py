from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict


SUPPORTED_PARTS = frozenset({227, 228, 229, 230})


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SourceLanguage(StrEnum):
    ENGLISH = "en"
    TELUGU = "te"
    URDU = "ur"


class PipelineVersions(StrictModel):
    pipeline_version: str
    preprocessing_version: str
    parser_version: str
    ocr_engine: str | None = None
    ocr_engine_version: str | None = None


class ApiError(StrictModel):
    code: str
    message: str
    retryable: bool
    details: dict[str, Any]


class ErrorEnvelope(StrictModel):
    error: ApiError
