from fastapi.testclient import TestClient


def test_health_reports_only_implemented_capabilities(client: TestClient) -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["versions"]["pipeline_version"] == "3.1.0"
    assert body["versions"]["parser_version"] == "2.0.0"
    assert body["versions"]["ocr_engine"] is None
    assert "pdf.page_rendering" in body["capabilities"]
    assert "card_segmentation.deterministic_3x10" in body["capabilities"]
    assert "field_regions.en_te_fixed_card_v1" in body["capabilities"]
    assert "ocr.tesseract_en_te" in body["capabilities"]
    assert "ocr.paddle_v3_adapter" in body["capabilities"]
    assert "ocr.targeted_retry_v1" in body["capabilities"]
    assert "benchmark.ground_truth_import_v1" in body["capabilities"]
    assert "benchmark.ocr_comparison_v1" in body["capabilities"]
    assert "benchmark.pipeline_selection_gate_v1" in body["capabilities"]
    assert "ingestion.source_layers_v1" in body["capabilities"]
    assert "reconciliation.en_te_part_serial_v1" in body["capabilities"]
    assert "quality.completeness_conflicts_v1" in body["capabilities"]
    assert "verification.golden_revision_gate_v1" in body["capabilities"]
    assert "persistence.atomic_page_rpc_v1" in body["capabilities"]

