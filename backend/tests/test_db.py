from __future__ import annotations

import sqlite3

from app.db.repositories.logs_repository import LogsRepository
from app.db.repositories.projects_repository import ProjectsRepository
from app.db.schema import init_db

EXPECTED_TABLES = {
    "projects",
    "tasks",
    "files",
    "agents",
    "memory",
    "logs",
    "settings",
    "history",
}


def _in_memory_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(":memory:")
    connection.row_factory = sqlite3.Row
    return connection


def test_init_db_creates_all_tables() -> None:
    connection = _in_memory_connection()
    init_db(connection)

    rows = connection.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table'"
    ).fetchall()
    table_names = {row["name"] for row in rows}

    assert EXPECTED_TABLES.issubset(table_names)


def test_init_db_is_idempotent() -> None:
    connection = _in_memory_connection()
    init_db(connection)
    init_db(connection)  # must not raise


def test_logs_repository_insert_and_list_recent() -> None:
    connection = _in_memory_connection()
    init_db(connection)
    repository = LogsRepository(connection)

    created = repository.insert(level="INFO", source="test", message="hello")
    recent = repository.list_recent(limit=10)

    assert created["level"] == "INFO"
    assert created["source"] == "test"
    assert created["message"] == "hello"
    assert len(recent) == 1
    assert recent[0]["id"] == created["id"]
    assert recent[0]["level"] == "INFO"
    assert recent[0]["source"] == "test"
    assert recent[0]["message"] == "hello"
    assert recent[0]["project_id"] is None


def test_logs_repository_list_recent_orders_newest_first() -> None:
    connection = _in_memory_connection()
    init_db(connection)
    repository = LogsRepository(connection)

    repository.insert(level="INFO", source="test", message="first")
    repository.insert(level="ERROR", source="test", message="second")

    recent = repository.list_recent(limit=10)

    assert [entry["message"] for entry in recent] == ["second", "first"]


def test_init_db_adds_last_opened_at_to_a_pre_existing_projects_table() -> None:
    """Simulates a database created before Sprint 7 (projects table exists,
    empty, without last_opened_at) — init_db must add the column without
    raising, since CREATE TABLE IF NOT EXISTS alone would be a no-op here.
    """
    connection = _in_memory_connection()
    connection.execute(
        """
        CREATE TABLE projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            path TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    connection.commit()

    init_db(connection)  # must not raise, and must add the missing column

    columns = {row[1] for row in connection.execute("PRAGMA table_info(projects)").fetchall()}
    assert "last_opened_at" in columns


def test_projects_repository_record_opened_creates_then_upserts() -> None:
    connection = _in_memory_connection()
    init_db(connection)
    repository = ProjectsRepository(connection)

    created = repository.record_opened(path="/tmp/app", name="app", description="desc")
    assert created["name"] == "app"
    assert created["description"] == "desc"
    assert created["last_opened_at"] is not None

    updated = repository.record_opened(path="/tmp/app", name="renamed")
    assert updated["id"] == created["id"]
    assert updated["name"] == "renamed"
    assert updated["description"] == "desc"  # preserved: None means "unchanged"

    all_recent = repository.list_recent(limit=10)
    assert len(all_recent) == 1


def test_projects_repository_list_recent_orders_newest_first() -> None:
    connection = _in_memory_connection()
    init_db(connection)
    repository = ProjectsRepository(connection)

    repository.record_opened(path="/tmp/first", name="first")
    repository.record_opened(path="/tmp/second", name="second")

    recent = repository.list_recent(limit=10)

    assert [entry["name"] for entry in recent] == ["second", "first"]


def test_projects_repository_delete() -> None:
    connection = _in_memory_connection()
    init_db(connection)
    repository = ProjectsRepository(connection)

    created = repository.record_opened(path="/tmp/gone", name="gone")

    assert repository.delete(created["id"]) is True
    assert repository.delete(created["id"]) is False
    assert repository.list_recent(limit=10) == []
