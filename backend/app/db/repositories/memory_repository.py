from __future__ import annotations

import sqlite3
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import uuid4

MemoryType = Literal["project", "conversation", "long_term", "task", "knowledge"]


class MemoryRepository:
    """Data access for the `memory` table (schema-ready since Sprint 4,
    first implemented in Sprint 11 for agent-to-agent handoff): when one
    orchestrated task's work is needed by another that depends on it
    (e.g. a Developer task needs its Planner's plan), the Agent Manager
    writes a `type='task'` entry keyed by the completed task's id, and the
    dependent task's prompt recalls it — a durable handoff, not just an
    in-memory pass-through that would be lost if the backend restarted
    mid-pipeline.
    """

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def remember(
        self, *, project_id: str | None, type: MemoryType, key: str, value: str
    ) -> dict[str, Any]:
        now = datetime.now(UTC).isoformat()
        existing = self._connection.execute(
            "SELECT id FROM memory WHERE project_id IS ? AND type = ? AND key = ?",
            (project_id, type, key),
        ).fetchone()
        if existing:
            self._connection.execute(
                "UPDATE memory SET value = ?, updated_at = ? WHERE id = ?",
                (value, now, existing["id"]),
            )
            memory_id = existing["id"]
        else:
            memory_id = str(uuid4())
            self._connection.execute(
                """
                INSERT INTO memory (id, project_id, type, key, value, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (memory_id, project_id, type, key, value, now, now),
            )
        self._connection.commit()
        row = self._connection.execute(
            "SELECT * FROM memory WHERE id = ?", (memory_id,)
        ).fetchone()
        return dict(row)

    def recall(self, *, project_id: str | None, type: MemoryType, key: str) -> str | None:
        row = self._connection.execute(
            "SELECT value FROM memory WHERE project_id IS ? AND type = ? AND key = ?",
            (project_id, type, key),
        ).fetchone()
        return row["value"] if row else None

    def list_by_type(self, *, project_id: str | None, type: MemoryType) -> list[dict[str, Any]]:
        rows = self._connection.execute(
            """
            SELECT * FROM memory
            WHERE project_id IS ? AND type = ?
            ORDER BY updated_at DESC
            """,
            (project_id, type),
        ).fetchall()
        return [dict(row) for row in rows]
