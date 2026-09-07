from collections.abc import Iterator

import pymupdf
import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def pdf_bytes() -> bytes:
    document = pymupdf.open()
    first = document.new_page(width=612, height=792)
    first.insert_text((72, 72), "JANASOOCHI representative page 1")
    second = document.new_page(width=612, height=792)
    second.insert_text((72, 72), "JANASOOCHI representative page 2")
    data = document.tobytes()
    document.close()
    return data


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(create_app()) as test_client:
        yield test_client
