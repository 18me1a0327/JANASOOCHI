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
            "card_segmentation.deterministic_3x10",
            "field_regions.en_te_fixed_card_v1",
            "ocr.tesseract_en_te",
            "ocr.paddle_v3_adapter",
            "ocr.targeted_retry_v1",
            "benchmark.ground_truth_import_v1",
        ],
    )

