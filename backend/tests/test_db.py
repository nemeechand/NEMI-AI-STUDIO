from __future__ import annotations

import sqlite3

from app.db.repositories.logs_repository import LogsRepository
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

    entry_id = repository.insert(level="INFO", source="test", message="hello")
    recent = repository.list_recent(limit=10)

    assert len(recent) == 1
    assert recent[0]["id"] == entry_id
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
