from typing import Any

from pydantic import ConfigDict

from app.models.jobs import JobRecord


class ProcessingRunInsert(JobRecord):
    """Maps a service job onto the existing Supabase processing_runs table."""

    model_config = ConfigDict(extra="forbid")

    def to_row(self) -> dict[str, Any]:
        requested_pages = self.requested_pages or list(range(1, self.total_pages + 1))
        return {
            "id": str(self.id),
            "document_id": str(self.document_id),
            "status": self.status.value,
            "stage": self.stage.value,
            "source_language": self.source_language.value,
            "attempt_number": 1,
            "total_pages": self.total_pages,
            "processed_pages": 0,
            "succeeded_pages": 0,
            "failed_pages": 0,
            "cards_detected": 0,
            "records_extracted": 0,
            "resume_state": {"requested_pages": requested_pages},
            "metrics": {"versions": self.versions.model_dump(mode="json")},
            "error_summary": {},
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
