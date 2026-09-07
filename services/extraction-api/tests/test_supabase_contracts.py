from datetime import UTC, datetime
from uuid import uuid4

from app.db.supabase_contracts import ProcessingRunInsert
from app.models.common import PipelineVersions, SourceLanguage
from app.models.jobs import JobStage, JobStatus


def test_job_maps_to_existing_processing_runs_shape() -> None:
    now = datetime.now(UTC)
    contract = ProcessingRunInsert(
        id=uuid4(),
        document_id=uuid4(),
        part_number=230,
        source_language=SourceLanguage.ENGLISH,
        status=JobStatus.QUEUED,
        stage=JobStage.VALIDATION,
        total_pages=3,
        requested_pages=[2],
        versions=PipelineVersions(
            pipeline_version="2.0.0",
            preprocessing_version="1.0.0",
            parser_version="1.0.0",
        ),
        created_at=now,
        updated_at=now,
    )

    row = contract.to_row()
    assert row["document_id"] == str(contract.document_id)
    assert row["resume_state"] == {"requested_pages": [2]}
    assert row["metrics"]["versions"]["pipeline_version"] == "2.0.0"
    assert row["records_extracted"] == 0
