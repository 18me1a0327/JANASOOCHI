from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.models.jobs import HealthResponse


router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    return HealthResponse(
        status="ok",
        service=settings.service_name,
        service_version=settings.service_version,
        environment=settings.environment,
        versions=settings.versions,
        capabilities=[
            "pdf.magic_validation",
            "pdf.sha256",
            "pdf.page_rendering",
            "processing_job.contracts",
        ],
    )
