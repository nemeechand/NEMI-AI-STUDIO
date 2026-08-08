from __future__ import annotations

import sqlite3
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4


class FilesRepository:
    """Data access for the `files` table (schema-ready since Sprint 3,
    first implemented in Sprint 14 by the knowledge indexer): one row per
    source file the indexer has seen for a project, tracking its detected
    language and when it was last indexed.
    """

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def upsert(
        self, *, project_id: str, relative_path: str, language: str | None
    ) -> dict[str, Any]:
        now = datetime.now(UTC).isoformat()
        existing = self._connection.execute(
            "SELECT id FROM files WHERE project_id = ? AND relative_path = ?",
            (project_id, relative_path),
        ).fetchone()
        if existing:
            self._connection.execute(
                "UPDATE files SET language = ?, last_indexed = ?, updated_at = ? WHERE id = ?",
                (language, now, now, existing["id"]),
            )
            file_id = existing["id"]
        else:
            file_id = str(uuid4())
            self._connection.execute(
                """
                INSERT INTO files
                    (id, project_id, relative_path, language, last_indexed, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (file_id, project_id, relative_path, language, now, now, now),
            )
        row = self._connection.execute("SELECT * FROM files WHERE id = ?", (file_id,)).fetchone()
        return dict(row)

    def list_for_project(self, project_id: str) -> list[dict[str, Any]]:
        rows = self._connection.execute(
            "SELECT * FROM files WHERE project_id = ? ORDER BY relative_path", (project_id,)
        ).fetchall()
        return [dict(row) for row in rows]

    def get_by_path(self, project_id: str, relative_path: str) -> dict[str, Any] | None:
        row = self._connection.execute(
            "SELECT * FROM files WHERE project_id = ? AND relative_path = ?",
            (project_id, relative_path),
        ).fetchone()
        return dict(row) if row else None

    def delete_missing(self, project_id: str, known_paths: set[str]) -> int:
        """Removes rows for files no longer present on disk as of the most
        recent index run — keeps a stale/renamed/deleted file from lingering
        forever in the graph."""
        existing = self.list_for_project(project_id)
        stale_ids = [row["id"] for row in existing if row["relative_path"] not in known_paths]
        if not stale_ids:
            return 0
        placeholders = ",".join("?" * len(stale_ids))
        self._connection.execute(f"DELETE FROM files WHERE id IN ({placeholders})", stale_ids)
        return len(stale_ids)
