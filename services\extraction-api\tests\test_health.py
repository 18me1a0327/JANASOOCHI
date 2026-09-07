from fastapi.testclient import TestClient


def test_health_reports_only_implemented_capabilities(client: TestClient) -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["versions"]["pipeline_version"] == "2.0.0"
    assert body["versions"]["ocr_engine"] is None
    assert "pdf.page_rendering" in body["capabilities"]
    assert all("ocr" not in capability for capability in body["capabilities"])
