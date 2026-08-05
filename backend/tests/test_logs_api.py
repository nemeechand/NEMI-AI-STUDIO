from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.server import create_app


@pytest.fixture
def client() -> Iterator[TestClient]:
    # Lifespan (DB init) only runs when TestClient is used as a context
    # manager — a bare TestClient(app) never fires startup/shutdown.
    with TestClient(create_app()) as test_client:
        yield test_client


def test_create_and_list_log(client: TestClient) -> None:
    create_response = client.post(
        "/logs", json={"level": "INFO", "source": "test", "message": "hello world"}
    )
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["level"] == "INFO"
    assert created["source"] == "test"
    assert created["message"] == "hello world"
    assert created["project_id"] is None

    list_response = client.get("/logs")
    assert list_response.status_code == 200
    entries = list_response.json()
    assert any(entry["id"] == created["id"] for entry in entries)


def test_create_log_invalid_level_returns_consistent_error_shape(client: TestClient) -> None:
    response = client.post(
        "/logs", json={"level": "TRACE", "source": "test", "message": "bad level"}
    )

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "validation_error"


def test_create_log_missing_fields_returns_422(client: TestClient) -> None:
    response = client.post("/logs", json={"level": "INFO"})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_list_logs_respects_limit_and_orders_newest_first(client: TestClient) -> None:
    for index in range(3):
        client.post(
            "/logs",
            json={"level": "DEBUG", "source": "test", "message": f"entry {index}"},
        )

    response = client.get("/logs", params={"limit": 2})

    assert response.status_code == 200
    entries = response.json()
    assert len(entries) == 2
    assert entries[0]["message"] == "entry 2"
