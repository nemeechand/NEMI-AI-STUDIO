from __future__ import annotations

from fastapi.testclient import TestClient

from app import __version__
from app.server import create_app


def test_health_endpoint_returns_ok() -> None:
    with TestClient(create_app()) as client:
        response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["version"] == __version__
    assert body["uptime_seconds"] >= 0


def test_unknown_route_returns_structured_error() -> None:
    with TestClient(create_app()) as client:
        response = client.get("/does-not-exist")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "http_error"
