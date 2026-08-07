from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.server import create_app


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(create_app()) as test_client:
        yield test_client


def test_record_opened_creates_a_project(client: TestClient) -> None:
    response = client.post(
        "/projects/opened",
        json={"path": "/tmp/my-app", "name": "my-app", "description": "A test project"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "my-app"
    assert body["path"] == "/tmp/my-app"
    assert body["description"] == "A test project"
    assert body["last_opened_at"] is not None


def test_record_opened_upserts_by_path(client: TestClient) -> None:
    first = client.post(
        "/projects/opened", json={"path": "/tmp/my-app", "name": "my-app"}
    ).json()
    second = client.post(
        "/projects/opened", json={"path": "/tmp/my-app", "name": "renamed-app"}
    ).json()

    assert second["id"] == first["id"]
    assert second["name"] == "renamed-app"

    recent = client.get("/projects/recent").json()
    assert len([p for p in recent if p["path"] == "/tmp/my-app"]) == 1


def test_list_recent_orders_newest_first_and_respects_limit(client: TestClient) -> None:
    for index in range(3):
        client.post(
            "/projects/opened",
            json={"path": f"/tmp/project-{index}", "name": f"project-{index}"},
        )

    response = client.get("/projects/recent", params={"limit": 2})

    assert response.status_code == 200
    entries = response.json()
    assert len(entries) == 2
    assert entries[0]["name"] == "project-2"


def test_delete_removes_project_from_recent(client: TestClient) -> None:
    created = client.post(
        "/projects/opened", json={"path": "/tmp/to-delete", "name": "to-delete"}
    ).json()

    delete_response = client.delete(f"/projects/{created['id']}")
    assert delete_response.status_code == 204

    recent = client.get("/projects/recent").json()
    assert all(p["id"] != created["id"] for p in recent)


def test_delete_unknown_project_returns_404(client: TestClient) -> None:
    response = client.delete("/projects/does-not-exist")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "http_error"


def test_record_opened_missing_fields_returns_422(client: TestClient) -> None:
    response = client.post("/projects/opened", json={"path": "/tmp/x"})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
