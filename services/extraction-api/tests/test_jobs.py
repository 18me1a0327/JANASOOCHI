from uuid import uuid4

from fastapi.testclient import TestClient


def test_create_and_read_typed_job(client: TestClient) -> None:
    document_id = uuid4()
    response = client.post(
        "/api/v1/jobs",
        json={
            "document_id": str(document_id),
            "part_number": 227,
            "source_language": "te",
            "total_pages": 40,
            "requested_pages": [5, 1, 5],
        },
    )

    assert response.status_code == 202
    created = response.json()
    assert created["status"] == "queued"
    assert created["stage"] == "validation"
    assert created["requested_pages"] == [1, 5]
    assert created["versions"]["ocr_engine"] is None

    fetched = client.get(f"/api/v1/jobs/{created['id']}")
    assert fetched.status_code == 200
    assert fetched.json() == created


def test_job_contract_rejects_unsupported_part(client: TestClient) -> None:
    response = client.post(
        "/api/v1/jobs",
        json={
            "document_id": str(uuid4()),
            "part_number": 231,
            "source_language": "en",
            "total_pages": 1,
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "request_validation_error"


def test_missing_job_returns_safe_error(client: TestClient) -> None:
    job_id = uuid4()
    response = client.get(f"/api/v1/jobs/{job_id}")

    assert response.status_code == 404
    assert response.json()["error"] == {
        "code": "job_not_found",
        "message": "Processing job not found.",
        "retryable": False,
        "details": {"job_id": str(job_id)},
    }
