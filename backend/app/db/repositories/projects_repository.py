from __future__ import annotations

import sqlite3
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4


class ProjectsRepository:
    """Data access for the `projects` table.

    Tracks projects the user has opened (via Open Folder, the New Project
    Wizard, or the Workspace Manager) for the Recent Projects / Workspace
    Manager UI — distinct from `files`, which indexes a project's contents.
    `last_opened_at` (not `updated_at`) drives recency ordering, so editing
    metadata without opening the project never changes its position.
    """

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def record_opened(
        self, path: str, name: str, description: str | None = None
    ) -> dict[str, Any]:
        now = datetime.now(UTC).isoformat()
        existing = self._connection.execute(
            "SELECT id FROM projects WHERE path = ?", (path,)
        ).fetchone()

        if existing:
            project_id = existing["id"]
            self._connection.execute(
                """
                UPDATE projects
                SET name = ?,
                    description = COALESCE(?, description),
                    updated_at = ?,
                    last_opened_at = ?
                WHERE id = ?
                """,
                (name, description, now, now, project_id),
            )
        else:
            project_id = str(uuid4())
            self._connection.execute(
                """
                INSERT INTO projects
                    (id, name, path, description, created_at, updated_at, last_opened_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (project_id, name, path, description, now, now, now),
            )

        self._connection.commit()
        row = self._connection.execute(
            "SELECT * FROM projects WHERE id = ?", (project_id,)
        ).fetchone()
        return dict(row)

    def list_recent(self, limit: int = 20) -> list[dict[str, Any]]:
        rows = self._connection.execute(
            """
            SELECT * FROM projects
            WHERE last_opened_at IS NOT NULL
            ORDER BY last_opened_at DESC, rowid DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return [dict(row) for row in rows]

    def delete(self, project_id: str) -> bool:
        cursor = self._connection.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        self._connection.commit()
        return cursor.rowcount > 0
