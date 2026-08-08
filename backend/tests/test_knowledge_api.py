from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.server import create_app


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(create_app()) as test_client:
        yield test_client


def _project_dir(tmp_path: Path) -> Path:
    # A dedicated subdirectory, not tmp_path itself — isolated_settings
    # (autouse, conftest.py) already writes nemi.db/backend.log straight
    # into this same tmp_path; indexing tmp_path directly would pick those
    # up as extra "files" and throw off exact-count assertions below.
    project_root = tmp_path / "project"
    project_root.mkdir(exist_ok=True)
    return project_root


def _create_project(client: TestClient, project_root: Path) -> dict[str, Any]:
    response = client.post(
        "/projects/opened", json={"path": str(project_root), "name": "sample-project"}
    )
    assert response.status_code == 200
    return response.json()  # type: ignore[no-any-return]


def _write_sample_files(project_root: Path) -> None:
    (project_root / "app").mkdir()
    (project_root / "app" / "utils.py").write_text("def helper():\n    return 1\n")
    (project_root / "app" / "main.py").write_text(
        "from app.utils import helper\n\ndef run():\n    return helper()\n"
    )


def test_index_then_graph_and_stats(client: TestClient, tmp_path: Path) -> None:
    project_root = _project_dir(tmp_path)
    project = _create_project(client, project_root)
    _write_sample_files(project_root)

    index_response = client.post(
        "/knowledge/index", json={"project_id": project["id"], "project_path": str(project_root)}
    )
    assert index_response.status_code == 200
    body = index_response.json()
    assert body["files_indexed"] == 2
    assert body["functions_found"] == 2
    assert body["errors"] == []

    graph_response = client.get("/knowledge/graph", params={"project_id": project["id"]})
    assert graph_response.status_code == 200
    graph = graph_response.json()
    assert len(graph["nodes"]) > 0
    assert any(n["node_type"] == "file" for n in graph["nodes"])

    stats_response = client.get("/knowledge/stats", params={"project_id": project["id"]})
    assert stats_response.status_code == 200
    stats = stats_response.json()
    assert stats["files_indexed"] == 2
    assert stats["nodes_by_type"]["file"] == 2


def test_impact_analysis_finds_dependents(client: TestClient, tmp_path: Path) -> None:
    project_root = _project_dir(tmp_path)
    project = _create_project(client, project_root)
    _write_sample_files(project_root)
    client.post(
        "/knowledge/index", json={"project_id": project["id"], "project_path": str(project_root)}
    )

    response = client.get(
        "/knowledge/impact", params={"project_id": project["id"], "file": "app/utils.py"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["found"] is True
    assert "app/main.py" in body["dependents"]
    assert body["risk_label"] in ("low", "medium", "high")


def test_impact_analysis_unknown_file_reports_not_found(client: TestClient, tmp_path: Path) -> None:
    project_root = _project_dir(tmp_path)
    project = _create_project(client, project_root)

    response = client.get(
        "/knowledge/impact", params={"project_id": project["id"], "file": "does/not/exist.py"}
    )

    assert response.status_code == 200
    assert response.json()["found"] is False


def test_dependency_diagram_is_real_mermaid_text(client: TestClient, tmp_path: Path) -> None:
    project_root = _project_dir(tmp_path)
    project = _create_project(client, project_root)
    _write_sample_files(project_root)
    client.post(
        "/knowledge/index", json={"project_id": project["id"], "project_path": str(project_root)}
    )

    response = client.get(
        "/knowledge/diagram", params={"project_id": project["id"], "type": "dependency"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["mermaid"].startswith("graph LR")
    assert "app/main.py" in body["mermaid"]


def test_architecture_diagram_groups_by_directory(client: TestClient, tmp_path: Path) -> None:
    project_root = _project_dir(tmp_path)
    project = _create_project(client, project_root)
    _write_sample_files(project_root)
    client.post(
        "/knowledge/index", json={"project_id": project["id"], "project_path": str(project_root)}
    )

    response = client.get(
        "/knowledge/diagram", params={"project_id": project["id"], "type": "architecture"}
    )

    assert response.status_code == 200
    assert response.json()["mermaid"].startswith("graph TD")


def test_search_falls_back_to_keyword_when_no_provider_given(
    client: TestClient, tmp_path: Path
) -> None:
    project_root = _project_dir(tmp_path)
    project = _create_project(client, project_root)
    _write_sample_files(project_root)
    client.post(
        "/knowledge/index", json={"project_id": project["id"], "project_path": str(project_root)}
    )

    response = client.post(
        "/knowledge/search", json={"project_id": project["id"], "query": "utils"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "keyword_fallback"
    assert body["fallback_reason"] is not None
    assert any("utils" in hit["preview"] for hit in body["hits"])


def test_search_falls_back_when_embedding_provider_has_no_key(
    client: TestClient, tmp_path: Path
) -> None:
    project_root = _project_dir(tmp_path)
    project = _create_project(client, project_root)

    response = client.post(
        "/knowledge/search",
        json={
            "project_id": project["id"],
            "query": "utils",
            "provider": "openai",
            "model": "text-embedding-3-small",
        },
    )

    assert response.status_code == 200
    assert response.json()["mode"] == "keyword_fallback"


def test_context_endpoint_bundles_graph_and_memory(client: TestClient, tmp_path: Path) -> None:
    project_root = _project_dir(tmp_path)
    project = _create_project(client, project_root)
    _write_sample_files(project_root)
    client.post(
        "/knowledge/index", json={"project_id": project["id"], "project_path": str(project_root)}
    )

    response = client.get(
        "/knowledge/context", params={"project_id": project["id"], "file": "app/utils.py"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["found_in_graph"] is True
    assert "app/main.py" in body["imported_by"]


def test_embedding_providers_list_excludes_anthropic(client: TestClient) -> None:
    response = client.get("/knowledge/embedding-providers")

    assert response.status_code == 200
    ids = {p["id"] for p in response.json()}
    assert ids == {"openai", "gemini", "ollama"}


def test_list_memory_endpoint(client: TestClient, tmp_path: Path) -> None:
    project_root = _project_dir(tmp_path)
    project = _create_project(client, project_root)

    response = client.get(
        "/knowledge/memory", params={"project_id": project["id"], "type": "knowledge"}
    )

    assert response.status_code == 200
    assert response.json() == []
