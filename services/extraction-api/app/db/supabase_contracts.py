from typing import Any
from uuid import UUID

from pydantic import ConfigDict, Field, model_validator

from app.models.jobs import JobRecord
from app.models.common import StrictModel
from app.models.ingestion import (
    FIELD_ATTRIBUTE_MAP,
    PageProcessingState,
    SourceRecordCandidate,
)


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


class SourceRecordInsert(SourceRecordCandidate):
    """Maps a validated source candidate without promoting it to VERIFIED."""

    model_config = ConfigDict(extra="forbid")

    def to_row(self) -> dict[str, Any]:
        reported = [value for value in self.field_confidence.values() if value is not None]
        aggregate_confidence = (sum(reported) / len(reported) * 100) if reported else None
        return {
            "id": str(self.source_record_id),
            "pdf_id": str(self.document_id),
            "part_number": self.part_number,
            "serial_number": str(self.serial_number) if self.serial_number is not None else None,
            "original_name": self.raw.voter_name,
            "normalized_name": self.normalized.voter_name,
            "relation_type": _canonical_relation_type(self.normalized.relation_type),
            "original_relation_name": self.raw.relation_name,
            "normalized_relation_name": self.normalized.relation_name,
            "original_house_number": self.raw.house_number,
            "normalized_house_number": self.normalized.house_number,
            "age": self.age,
            "gender": self.raw.gender,
            "epic_number": self.normalized.epic,
            "pdf_page_number": self.physical_page_number,
            "printed_page_number": self.printed_page_number,
            "original_text": self.original_card_text,
            "original_language": self.source_language.value,
            "ocr_confidence": aggregate_confidence,
            "bounding_box": self.card_bbox.model_dump(mode="json"),
            "verification_status": "requires_review" if self.requires_review else "unverified",
            "field_confidence": {
                field.value: (value * 100 if value is not None else None)
                for field, value in self.field_confidence.items()
            },
            "name_confidence": _percent(self.field_confidence.get("voter_name")),
            "relation_confidence": _percent(self.field_confidence.get("relation_name")),
            "house_confidence": _percent(self.field_confidence.get("house_number")),
            "age_confidence": _percent(self.field_confidence.get("age")),
            "epic_confidence": _percent(self.field_confidence.get("epic")),
            "source_card_index": self.card_index,
            "extraction_method": self.extraction_method,
            "normalization_version": self.versions.parser_version,
            "verification_evidence": {
                "revision_identifier": self.revision_identifier,
                "versions": self.versions.model_dump(mode="json"),
                "issue_codes": [issue.code for issue in self.issues],
            },
        }


class PageProcessingUpsert(PageProcessingState):
    """Maps a page checkpoint onto the resumable page_processing table."""

    model_config = ConfigDict(extra="forbid")

    def to_row(self) -> dict[str, Any]:
        return {
            "pdf_id": str(self.document_id),
            "processing_run_id": str(self.processing_run_id),
            "pdf_page_number": self.physical_page_number,
            "printed_page_number": self.printed_page_number,
            "status": self.status.value,
            "retry_count": self.attempts - 1,
            "extraction_attempts": self.attempts,
            "records_detected": self.records_detected,
            "records_extracted": self.records_extracted,
            "review_records": self.review_records,
            "error_message": self.error_message,
            "card_states": self.cards,
            "updated_at": self.updated_at.isoformat(),
        }


class ReviewIssueInsert(StrictModel):
    document_id: UUID
    voter_id: UUID
    issue_type: str = Field(min_length=1, max_length=80)
    issue_detail: str = Field(min_length=1, max_length=500)
    severity: str
    original_values: dict[str, Any] = Field(default_factory=dict)
    resolution_metadata: dict[str, Any] = Field(default_factory=dict)

    def to_row(self) -> dict[str, Any]:
        return {
            "pdf_id": str(self.document_id),
            "voter_id": str(self.voter_id),
            "issue_type": self.issue_type,
            "issue_detail": self.issue_detail,
            "severity": self.severity,
            "status": "open",
            "original_values": self.original_values,
            "resolution_metadata": self.resolution_metadata,
        }


class AtomicPagePersistenceRequest(StrictModel):
    page: PageProcessingUpsert
    records: list[SourceRecordInsert] = Field(max_length=30)
    review_issues: list[ReviewIssueInsert] = Field(default_factory=list, max_length=300)

    @model_validator(mode="after")
    def validate_batch(self) -> "AtomicPagePersistenceRequest":
        record_ids = {record.source_record_id for record in self.records}
        for record in self.records:
            if record.document_id != self.page.document_id:
                raise ValueError("every record must belong to the page document")
            if record.physical_page_number != self.page.physical_page_number:
                raise ValueError("every record must belong to the physical page")
        for issue in self.review_issues:
            if issue.document_id != self.page.document_id or issue.voter_id not in record_ids:
                raise ValueError("every review issue must reference a record in this page batch")
        if self.page.records_extracted != len(self.records):
            raise ValueError("page records_extracted must equal the persistence batch")
        return self

    def to_rpc_params(self) -> dict[str, Any]:
        return {
            "p_document_id": str(self.page.document_id),
            "p_processing_run_id": str(self.page.processing_run_id),
            "p_page": self.page.to_row(),
            "p_records": [record.to_row() for record in self.records],
            "p_review_issues": [issue.to_row() for issue in self.review_issues],
        }


class AtomicPagePersistenceResult(StrictModel):
    page_id: int = Field(ge=1)
    inserted_records: int = Field(ge=0, le=30)
    idempotent_records: int = Field(ge=0, le=30)
    inserted_review_issues: int = Field(ge=0, le=300)


def build_review_issue_rows(candidate: SourceRecordCandidate) -> list[ReviewIssueInsert]:
    issue_type_map = {
        "missing_serial_number": "missing_serial",
        "unexpected_serial_number": "unexpected_serial",
        "invalid_epic_format": "malformed_record",
        "implausible_age": "malformed_record",
        "missing_original_card_text": "malformed_record",
    }
    rows = []
    for issue in candidate.issues:
        field_name = issue.field_type.value if issue.field_type is not None else None
        original_value = None
        if issue.field_type is not None:
            original_value = getattr(candidate.raw, FIELD_ATTRIBUTE_MAP[issue.field_type])
        rows.append(
            ReviewIssueInsert(
                document_id=candidate.document_id,
                voter_id=candidate.source_record_id,
                issue_type=issue_type_map.get(issue.code, "malformed_record"),
                issue_detail=issue.message,
                severity=issue.severity.value,
                original_values={
                    "field": field_name,
                    "value": original_value,
                },
                resolution_metadata={
                    "ingestion_issue_code": issue.code,
                    "physical_page_number": candidate.physical_page_number,
                    "source_card_index": candidate.card_index,
                },
            )
        )
    return rows


def _canonical_relation_type(value: str | None) -> str:
    if value is None:
        return "Unknown"
    mapping = {
        "father": "Father",
        "mother": "Mother",
        "husband": "Husband",
        "guardian": "Guardian",
        "other": "Other",
        "unknown": "Unknown",
        "తండ్రి": "Father",
        "తల్లి": "Mother",
        "భర్త": "Husband",
        "సంరక్షకుడు": "Guardian",
    }
    return mapping.get(value.casefold().strip(), "Unknown")


def _percent(value: float | None) -> float | None:
    return value * 100 if value is not None else None

