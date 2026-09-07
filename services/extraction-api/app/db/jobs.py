import asyncio
from datetime import UTC, datetime
from typing import Protocol
from uuid import UUID, uuid4

from app.core.exceptions import JobNotFoundError
from app.models.common import PipelineVersions
from app.models.jobs import JobCreate, JobRecord, JobStage, JobStatus


class JobRepository(Protocol):
    async def create(self, request: JobCreate, versions: PipelineVersions) -> JobRecord: ...

    async def get(self, job_id: UUID) -> JobRecord: ...


class InMemoryJobRepository:
    """Development repository; production will implement this protocol in Supabase."""

    def __init__(self) -> None:
        self._jobs: dict[UUID, JobRecord] = {}
        self._lock = asyncio.Lock()

    async def create(self, request: JobCreate, versions: PipelineVersions) -> JobRecord:
        now = datetime.now(UTC)
        job = JobRecord(
            id=uuid4(),
            document_id=request.document_id,
            part_number=request.part_number,
            source_language=request.source_language,
            status=JobStatus.QUEUED,
            stage=JobStage.VALIDATION,
            total_pages=request.total_pages,
            requested_pages=request.requested_pages,
            versions=versions,
            created_at=now,
            updated_at=now,
        )
        async with self._lock:
            self._jobs[job.id] = job
        return job

    async def get(self, job_id: UUID) -> JobRecord:
        async with self._lock:
            job = self._jobs.get(job_id)
        if job is None:
            raise JobNotFoundError(job_id=str(job_id))
        return job
