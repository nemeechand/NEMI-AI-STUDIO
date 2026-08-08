from __future__ import annotations

import sqlite3
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4


class FileSnapshotsRepository:
    """Data access for `file_snapshots` (Sprint 15) — the Safe Change
    Engine's rollback baseline. One row per (task, file), written once:
    the first time a given file is applied for a given task, never
    overwritten by a later apply of the same task, so it always holds the
    content from *before this task ever touched the file* — the correct
    rollback target even if the same task's files were somehow applied
    more than once.
    """

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def create_if_missing(
        self,
        *,
        task_id: str,
        project_id: str | None,
        relative_path: str,
        previous_content: str | None,
    ) -> None:
        existing = self._connection.execute(
            "SELECT id FROM file_snapshots WHERE task_id = ? AND relative_path = ?",
            (task_id, relative_path),
        ).fetchone()
        if existing:
            return
        self._connection.execute(
            """
            INSERT INTO file_snapshots
                (id, task_id, project_id, relative_path, previous_content, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid4()), task_id, project_id, relative_path, previous_content,
                datetime.now(UTC).isoformat(),
            ),
        )

    def list_for_task(self, task_id: str) -> list[dict[str, Any]]:
        rows = self._connection.execute(
            "SELECT * FROM file_snapshots WHERE task_id = ? ORDER BY created_at ASC",
            (task_id,),
        ).fetchall()
        return [dict(row) for row in rows]
