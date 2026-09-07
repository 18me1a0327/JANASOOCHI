import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.api import documents, health, jobs, pages
from app.core.config import get_settings
from app.core.exceptions import ExtractionError
from app.db.jobs import InMemoryJobRepository
from app.models.common import ApiError, ErrorEnvelope


logger = logging.getLogger("janasoochi.extraction")


def create_app() -> FastAPI:
    settings = get_settings()
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    application = FastAPI(
        title=settings.service_name,
        version=settings.service_version,
        description=(
            "Deterministic PDF validation, physical-page rendering, and typed "
            "processing-job contracts for JANASOOCHI."
        ),
    )
    application.state.job_repository = InMemoryJobRepository()

    if settings.allowed_origins:
        application.add_middleware(
            CORSMiddleware,
            allow_origins=settings.allowed_origins,
            allow_credentials=True,
            allow_methods=["GET", "POST"],
            allow_headers=["Authorization", "Content-Type"],
        )

    @application.exception_handler(ExtractionError)
    async def handle_extraction_error(_: Request, exc: ExtractionError) -> JSONResponse:
        logger.warning("Extraction request failed: %s (%s)", exc.code, exc.details)
        body = ErrorEnvelope(
            error=ApiError(
                code=exc.code,
                message=exc.message,
                retryable=exc.retryable,
                details=exc.details,
            )
        )
        return JSONResponse(status_code=exc.status_code, content=body.model_dump(mode="json"))

    @application.exception_handler(RequestValidationError)
    async def handle_request_validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        logger.warning("Extraction request validation failed: %s", exc.errors())
        body = ErrorEnvelope(
            error=ApiError(
                code="request_validation_error",
                message="The extraction request is invalid.",
                retryable=False,
                details={"fields": [list(error.get("loc", ())) for error in exc.errors()]},
            )
        )
        return JSONResponse(status_code=422, content=body.model_dump(mode="json"))

    @application.exception_handler(Exception)
    async def handle_unexpected_error(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled extraction service error", exc_info=exc)
        body = ErrorEnvelope(
            error=ApiError(
                code="internal_error",
                message="The extraction service is temporarily unavailable.",
                retryable=True,
                details={},
            )
        )
        return JSONResponse(status_code=500, content=body.model_dump(mode="json"))

    application.include_router(health.router, prefix=settings.api_prefix)
    application.include_router(jobs.router, prefix=settings.api_prefix)
    application.include_router(documents.router, prefix=settings.api_prefix)
    application.include_router(pages.router, prefix=settings.api_prefix)
    return application


app = create_app()
