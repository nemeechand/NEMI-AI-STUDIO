from __future__ import annotations

import asyncio
import sqlite3
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.ai.orchestration.documentation import _gather_real_facts, generate_feature_documentation
from app.ai.orchestration.manager import _related_project_code
from app.core.config import Settings, get_settings
from app.db.connection import get_connection
from app.db.repositories.agent_tasks_repository import AgentTasksRepository
from app.db.repositories.ai_conversations_repository import ConversationsRepository
from app.db.repositories.file_snapshots_repository import FileSnapshotsRepository
from app.db.repositories.knowledge_repository import KnowledgeRepository
from app.db.schema import init_db
from app.server import create_app

OLLAMA_MODEL = "qwen2.5:0.5b"


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(create_app()) as test_client:
        yield test_client


@pytest.fixture
def connection(isolated_settings: Settings) -> Iterator[sqlite3.Connection]:
    with get_connection(isolated_settings) as conn:
        init_db(conn)
        yield conn


def _project_dir(tmp_path: Path) -> Path:
    root = tmp_path / "project"
    root.mkdir(exist_ok=True)
    return root


def _create_project(client: TestClient, project_root: Path) -> dict[str, Any]:
    response = client.post(
        "/projects/opened", json={"path": str(project_root), "name": "sample"}
    )
    assert response.status_code == 200
    return response.json()  # type: ignore[no-any-return]


def _create_developer_task(client: TestClient, project_id: str | None = None) -> dict[str, Any]:
    response = client.post(
        "/agents/tasks",
        json={
            "project_id": project_id,
            "title": "Add login",
            "description": "Add a login form",
            "provider": "ollama",
            "model": OLLAMA_MODEL,
            "stages": ["developer"],
        },
    )
    assert response.status_code == 201
    return response.json()[0]  # type: ignore[no-any-return]


# --- Safe Change Engine: file_snapshots repository --------------------------


def _create_task_row(connection: sqlite3.Connection) -> str:
    # file_snapshots.task_id is a real FK into agent_tasks — insert a
    # genuine row rather than an arbitrary string (same lesson as every
    # prior sprint's FK-respecting test data).
    task = AgentTasksRepository(connection).create(
        project_id=None, title="T", description="D", agent_role="developer",
        priority=2, depends_on_task_id=None, provider="ollama", model=OLLAMA_MODEL,
    )
    return task["id"]  # type: ignore[no-any-return]


def test_create_if_missing_is_idempotent(connection: sqlite3.Connection) -> None:
    task_id = _create_task_row(connection)
    repo = FileSnapshotsRepository(connection)
    repo.create_if_missing(
        task_id=task_id, project_id=None, relative_path="a.py", previous_content="old"
    )
    repo.create_if_missing(
        task_id=task_id, project_id=None, relative_path="a.py", previous_content="different"
    )

    snapshots = repo.list_for_task(task_id)

    assert len(snapshots) == 1
    assert snapshots[0]["previous_content"] == "old"  # first write wins


def test_create_if_missing_allows_null_previous_content(connection: sqlite3.Connection) -> None:
    task_id = _create_task_row(connection)
    repo = FileSnapshotsRepository(connection)
    repo.create_if_missing(
        task_id=task_id, project_id=None, relative_path="new_file.py", previous_content=None
    )

    snapshots = repo.list_for_task(task_id)

    assert snapshots[0]["previous_content"] is None


# --- Safe Change Engine: full API round trip ---------------------------------


def test_mark_files_applied_stores_snapshots_and_rollback_info_returns_them(
    client: TestClient,
) -> None:
    task = _create_developer_task(client)

    response = client.post(
        f"/agents/tasks/{task['id']}/mark-files-applied",
        json={
            "snapshots": [
                {"path": "src/login.py", "previous_content": "old content"},
                {"path": "src/new_file.py", "previous_content": None},
            ]
        },
    )
    assert response.status_code == 200
    assert response.json()["proposed_files_applied"] is True

    rollback = client.get(f"/agents/tasks/{task['id']}/rollback-info")
    assert rollback.status_code == 200
    files = {f["path"]: f["previous_content"] for f in rollback.json()["files"]}
    assert files == {"src/login.py": "old content", "src/new_file.py": None}


def test_rollback_info_404_when_never_applied(client: TestClient) -> None:
    task = _create_developer_task(client)

    response = client.get(f"/agents/tasks/{task['id']}/rollback-info")

    assert response.status_code == 404


def test_mark_rolled_back_resets_applied_flag(client: TestClient) -> None:
    task = _create_developer_task(client)
    client.post(
        f"/agents/tasks/{task['id']}/mark-files-applied",
        json={"snapshots": [{"path": "a.py", "previous_content": "x"}]},
    )

    response = client.post(f"/agents/tasks/{task['id']}/mark-rolled-back")

    assert response.status_code == 200
    body = response.json()
    assert body["proposed_files_applied"] is False
    assert body["rolled_back_at"] is not None


# --- Test Engine --------------------------------------------------------------


def test_record_test_result_persists_on_workflow(client: TestClient) -> None:
    workflow = client.post(
        "/workflows",
        json={
            "title": "W", "goal": "G", "provider": "ollama", "model": OLLAMA_MODEL,
        },
    ).json()

    response = client.post(
        f"/workflows/{workflow['id']}/test-result",
        json={"passed": False, "exit_code": 1, "output_tail": "AssertionError"},
    )

    assert response.status_code == 200
    result = response.json()["last_test_result"]
    assert result["passed"] is False
    assert result["exit_code"] == 1
    assert result["output_tail"] == "AssertionError"
    assert "ran_at" in result


def test_record_test_result_unknown_workflow_404s(client: TestClient) -> None:
    response = client.post(
        "/workflows/does-not-exist/test-result", json={"passed": True}
    )

    assert response.status_code == 404


# --- Feature Approval summary -------------------------------------------------


def test_feature_summary_classifies_changed_vs_created(
    client: TestClient, tmp_path: Path
) -> None:
    project_root = _project_dir(tmp_path)
    project = _create_project(client, project_root)
    (project_root / "existing.py").write_text("x = 1\n")
    client.post(
        "/knowledge/index", json={"project_id": project["id"], "project_path": str(project_root)}
    )

    workflow = client.post(
        "/workflows",
        json={
            "title": "W", "goal": "G", "provider": "ollama", "model": OLLAMA_MODEL,
            "project_id": project["id"],
        },
    ).json()
    dev_task = client.post(
        "/agents/tasks",
        json={
            "project_id": project["id"], "title": "T", "description": "D",
            "provider": "ollama", "model": OLLAMA_MODEL, "stages": ["developer"],
        },
    ).json()[0]

    # Simulate a completed Developer task with real proposed_files by
    # writing directly through the repository layer (mirrors what
    # manager.py's mark_completed() does after a real streamed response).
    # conversation_id is a real FK into ai_conversations — create a
    # genuine row rather than an arbitrary string.
    with get_connection(get_settings()) as connection:
        conversation = ConversationsRepository(connection).create(
            project_id=project["id"], title="T", provider="ollama", model=OLLAMA_MODEL,
        )
        AgentTasksRepository(connection).mark_completed(
            dev_task["id"],
            conversation_id=conversation["id"],
            result_summary="done",
            proposed_files=[
                {"path": "existing.py", "content": "x = 2\n"},
                {"path": "brand_new.py", "content": "y = 1\n"},
            ],
        )
        connection.execute(
            "UPDATE agent_tasks SET workflow_id = ? WHERE id = ?",
            (workflow["id"], dev_task["id"]),
        )
        connection.commit()

    response = client.get(f"/workflows/{workflow['id']}/summary")

    assert response.status_code == 200
    body = response.json()
    assert body["files_changed"] == ["existing.py"]
    assert body["files_created"] == ["brand_new.py"]
    assert body["files_removed"] == []
    assert body["risk_level"] in ("low", "medium", "high", "unknown")


# --- Developer/Reviewer grounding (Knowledge Graph retrieval) ---------------


def test_related_project_code_matches_indexed_labels(connection: sqlite3.Connection) -> None:
    now = "2026-01-01T00:00:00+00:00"
    connection.execute(
        "INSERT INTO projects (id, name, path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        ("proj-a", "proj-a", "/tmp/proj-a", now, now),
    )
    connection.commit()
    graph_repo = KnowledgeRepository(connection)
    graph_repo.upsert_node(project_id="proj-a", node_type="file", label="src/auth/login.py")
    graph_repo.upsert_node(
        project_id="proj-a", node_type="function", label="src/auth/login.py::validate_password"
    )
    graph_repo.upsert_node(project_id="proj-a", node_type="file", label="src/unrelated.py")

    matches = _related_project_code(connection, "proj-a", "Implement password validation logic")

    assert any("validate_password" in m for m in matches)
    assert all("unrelated" not in m for m in matches)


def test_related_project_code_empty_when_project_not_indexed(
    connection: sqlite3.Connection,
) -> None:
    assert _related_project_code(connection, "no-such-project", "Add login") == []


# --- Documentation Engine ----------------------------------------------------


def test_gather_real_facts_lists_only_real_changed_files() -> None:
    workflow = {"title": "Login", "goal": "Add login", "last_test_result": None}
    milestones = [{"title": "Add login form"}]
    tasks = [
        {
            "agent_role": "developer", "status": "completed",
            "proposed_files": [{"path": "login.py", "content": "..."}],
        },
        {"agent_role": "reviewer", "status": "completed", "proposed_files": None},
    ]

    facts = _gather_real_facts(workflow, milestones, tasks)

    assert "login.py" in facts
    assert "Add login form" in facts
    assert "Not run." in facts


def test_generate_feature_documentation_skips_gracefully_without_api_key(
    isolated_settings: Settings, connection: sqlite3.Connection
) -> None:
    """Real MissingApiKeyError path (no network call) — mirrors
    test_ai_api.py's test_stream_missing_api_key_reports_error_event, but
    this function must swallow the error and return None rather than
    raise, since missing documentation must never block a feature."""
    workflow = {
        "id": "wf-1", "project_id": None, "title": "Login", "goal": "Add login",
        "provider": "openai", "model": "gpt-4o-mini", "last_test_result": None,
    }

    result = asyncio.run(
        generate_feature_documentation(
            isolated_settings, connection, workflow=workflow, milestones=[], tasks=[],
            api_keys={},
        )
    )

    assert result is None
