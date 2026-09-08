from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

from app import __version__
from app.models.common import PipelineVersions


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="JANASOOCHI_EXTRACTION_",
        case_sensitive=False,
        extra="ignore",
    )

    service_name: str = "JANASOOCHI Extraction API"
    service_version: str = __version__
    environment: str = "development"
    log_level: str = "INFO"
    api_prefix: str = "/api/v1"
    max_upload_mib: int = Field(default=75, ge=1, le=500)
    default_render_dpi: int = Field(default=300, ge=72, le=600)
    max_render_dpi: int = Field(default=400, ge=72, le=600)
    cors_origins: str = "http://localhost:3000"

    pipeline_version: str = "2.6.0"
    preprocessing_version: str = "1.3.0"
    parser_version: str = "1.1.0"
    ocr_engine: str | None = None
    ocr_engine_version: str | None = None

    supabase_url: str | None = None
    supabase_secret_key: SecretStr | None = None

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mib * 1024 * 1024

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def versions(self) -> PipelineVersions:
        return PipelineVersions(
            pipeline_version=self.pipeline_version,
            preprocessing_version=self.preprocessing_version,
            parser_version=self.parser_version,
            ocr_engine=self.ocr_engine,
            ocr_engine_version=self.ocr_engine_version,
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()

