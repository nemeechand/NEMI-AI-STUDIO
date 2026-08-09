from __future__ import annotations

import sqlite3
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app import __version__
from app.core.config import Settings
from app.db.connection import get_connection
from app.db.repositories.agent_tasks_repository import AgentTasksRepository
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


# --- GET /health/full -------------------------------------------------------


def test_health_full_returns_all_real_sections(client: TestClient) -> None:
    response = client.get("/health/full")

    assert response.status_code == 200
    body = response.json()
    assert body["version"] == __version__
    assert body["status"] in ("ok", "degraded")
    assert body["database"]["ok"] is True
    assert isinstance(body["python"]["version"], str)
    assert body["providers"]["total"] == 7
    assert isinstance(body["providers"]["connected"], int)
    assert isinstance(body["ollama"]["installed"], bool)
    assert isinstance(body["ollama"]["server_running"], bool)
    assert isinstance(body["internet"]["ok"], bool)


def test_health_full_reflects_provider_connection_status(client: TestClient) -> None:
    client.put(
        "/providers/openai/settings",
        json={"enabled": True, "base_url": None, "default_model": None},
    )
    # A real connection test with no key configured must report a real
    # failure — never fabricate a "connected" provider count.
    client.post("/providers/openai/test-connection", json={})

    response = client.get("/health/full")
    assert response.status_code == 200
    assert response.json()["providers"]["connected"] == 0


# --- POST /shutdown ----------------------------------------------------------


def test_shutdown_endpoint_responds_immediately(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Never let a test deliver a real SIGINT to the pytest process itself —
    # patch the actual signal delivery out (health.py's `import signal`
    # binds the same module singleton this patches), and only verify the
    # endpoint's real, immediate contract (schedule-and-respond), not the
    # signal itself.
    import signal as signal_module

    raised: list[int] = []
    monkeypatch.setattr(signal_module, "raise_signal", raised.append)

    response = client.post("/shutdown")

    assert response.status_code == 200
    assert response.json() == {"status": "shutting down"}


# --- Atomic task claiming (race-condition fix) -------------------------------


def _create_task_row(connection: sqlite3.Connection) -> str:
    task = AgentTasksRepository(connection).create(
        project_id=None,
        title="T",
        description="D",
        agent_role="developer",
        priority=2,
        depends_on_task_id=None,
        provider="ollama",
        model=OLLAMA_MODEL,
    )
    return task["id"]  # type: ignore[no-any-return]


def test_mark_running_claims_a_queued_task(connection: sqlite3.Connection) -> None:
    repo = AgentTasksRepository(connection)
    task_id = _create_task_row(connection)

    claimed = repo.mark_running(task_id)

    assert claimed is True
    assert repo.get(task_id)["status"] == "running"  # type: ignore[index]


def test_mark_running_is_atomic_against_a_second_claim(connection: sqlite3.Connection) -> None:
    """The exact race a production-stabilization audit found: two
    overlapping scheduler cycles both seeing 'queued' must not both be
    able to start the same task — only the first UPDATE may win."""
    repo = AgentTasksRepository(connection)
    task_id = _create_task_row(connection)

    first_claim = repo.mark_running(task_id)
    second_claim = repo.mark_running(task_id)

    assert first_claim is True
    assert second_claim is False


def test_mark_running_fails_for_a_nonexistent_task(connection: sqlite3.Connection) -> None:
    repo = AgentTasksRepository(connection)
    assert repo.mark_running("not-a-real-task-id") is False


# --- SQLite pragmas (WAL + busy_timeout) -------------------------------------


def test_connection_enables_wal_and_busy_timeout(connection: sqlite3.Connection) -> None:
    journal_mode = connection.execute("PRAGMA journal_mode").fetchone()[0]
    busy_timeout = connection.execute("PRAGMA busy_timeout").fetchone()[0]

    assert journal_mode.lower() == "wal"
    assert busy_timeout == 5000
