from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, status

from app.core.config import Settings, get_settings
from app.db.jobs import JobRepository
from app.models.jobs import JobAccepted, JobCreate, JobRecord


router = APIRouter(prefix="/jobs", tags=["jobs"])


def get_job_repository(request: Request) -> JobRepository:
    return request.app.state.job_repository


@router.post("", response_model=JobAccepted, status_code=status.HTTP_202_ACCEPTED)
async def create_job(
    payload: JobCreate,
    repository: Annotated[JobRepository, Depends(get_job_repository)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> JobRecord:
    return await repository.create(payload, settings.versions)


@router.get("/{job_id}", response_model=JobRecord)
async def get_job(
    job_id: UUID,
    repository: Annotated[JobRepository, Depends(get_job_repository)],
) -> JobRecord:
    return await repository.get(job_id)
