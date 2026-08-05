from __future__ import annotations

import sqlite3
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

LogLevel = str  # one of: INFO, WARNING, ERROR, DEBUG (see docs/DATABASE_SCHEMA.md)


class LogsRepository:
    """Data access for the `logs` table.

    Holds structured, queryable application log entries (e.g. lifecycle
    events) for the future Logger Panel UI — distinct from the
    console/file logging configured in app.core.logging, which is for
    developer-facing operational logs.
    """

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def insert(
        self,
        level: LogLevel,
        source: str,
        message: str,
        project_id: str | None = None,
    ) -> dict[str, Any]:
        entry_id = str(uuid4())
        created_at = datetime.now(UTC).isoformat()
        self._connection.execute(
            """
            INSERT INTO logs (id, project_id, level, source, message, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (entry_id, project_id, level, source, message, created_at),
        )
        self._connection.commit()
        return {
            "id": entry_id,
            "project_id": project_id,
            "level": level,
            "source": source,
            "message": message,
            "created_at": created_at,
        }

    def list_recent(self, limit: int = 50) -> list[dict[str, Any]]:
        rows = self._connection.execute(
            """
            SELECT id, project_id, level, source, message, created_at
            FROM logs
            ORDER BY created_at DESC, rowid DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return [dict(row) for row in rows]
