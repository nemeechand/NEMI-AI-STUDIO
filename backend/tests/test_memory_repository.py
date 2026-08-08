from __future__ import annotations

import sqlite3

import pytest

from app.core.config import Settings
from app.db.connection import get_connection
from app.db.repositories.memory_repository import MemoryRepository
from app.db.schema import init_db


@pytest.fixture
def connection(isolated_settings: Settings) -> sqlite3.Connection:
    with get_connection(isolated_settings) as conn:
        init_db(conn)
        yield conn


def test_remember_and_recall_round_trip(connection: sqlite3.Connection) -> None:
    repo = MemoryRepository(connection)

    repo.remember(project_id=None, type="task", key="task-1", value="the plan")

    assert repo.recall(project_id=None, type="task", key="task-1") == "the plan"


def test_recall_missing_key_returns_none(connection: sqlite3.Connection) -> None:
    repo = MemoryRepository(connection)

    assert repo.recall(project_id=None, type="task", key="does-not-exist") is None


def test_remember_upserts_by_project_type_key(connection: sqlite3.Connection) -> None:
    repo = MemoryRepository(connection)

    first = repo.remember(project_id=None, type="task", key="task-1", value="v1")
    second = repo.remember(project_id=None, type="task", key="task-1", value="v2")

    assert first["id"] == second["id"]
    assert repo.recall(project_id=None, type="task", key="task-1") == "v2"


def test_memory_is_scoped_by_project(connection: sqlite3.Connection) -> None:
    # project_id is a real FK into `projects` — insert genuine rows rather
    # than arbitrary strings (same lesson as Sprint 10's ai_conversations
    # test: the FK constraint correctly rejects made-up ids).
    now = "2026-01-01T00:00:00+00:00"
    connection.execute(
        "INSERT INTO projects (id, name, path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        ("proj-a", "proj-a", "/tmp/proj-a", now, now),
    )
    connection.execute(
        "INSERT INTO projects (id, name, path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        ("proj-b", "proj-b", "/tmp/proj-b", now, now),
    )
    connection.commit()

    repo = MemoryRepository(connection)
    repo.remember(project_id="proj-a", type="task", key="k", value="a-value")
    repo.remember(project_id="proj-b", type="task", key="k", value="b-value")

    assert repo.recall(project_id="proj-a", type="task", key="k") == "a-value"
    assert repo.recall(project_id="proj-b", type="task", key="k") == "b-value"


def test_list_by_type_orders_newest_first(connection: sqlite3.Connection) -> None:
    repo = MemoryRepository(connection)
    repo.remember(project_id=None, type="knowledge", key="k1", value="v1")
    repo.remember(project_id=None, type="knowledge", key="k2", value="v2")

    entries = repo.list_by_type(project_id=None, type="knowledge")

    assert [e["key"] for e in entries] == ["k2", "k1"]
