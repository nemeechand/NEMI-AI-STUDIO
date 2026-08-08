from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import uuid4

EntityType = Literal["file", "memory", "workflow"]


class EmbeddingsRepository:
    """Data access for the `embeddings` table — real vectors from a real
    provider call (app.ai.embeddings), never fabricated. One row per
    (project, entity_type, entity_id); `content_hash` lets the caller skip
    re-embedding unchanged content on a repeat run."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def upsert(
        self,
        *,
        project_id: str | None,
        entity_type: EntityType,
        entity_id: str,
        content_hash: str,
        provider: str,
        model: str,
        vector: list[float],
        text_preview: str,
    ) -> dict[str, Any]:
        now = datetime.now(UTC).isoformat()
        existing = self._connection.execute(
            "SELECT id FROM embeddings WHERE project_id IS ? AND entity_type = ? AND entity_id = ?",
            (project_id, entity_type, entity_id),
        ).fetchone()
        vector_json = json.dumps(vector)
        if existing:
            self._connection.execute(
                """
                UPDATE embeddings SET content_hash = ?, provider = ?, model = ?, dimensions = ?,
                    vector = ?, text_preview = ?, created_at = ?
                WHERE id = ?
                """,
                (
                    content_hash, provider, model, len(vector), vector_json, text_preview, now,
                    existing["id"],
                ),
            )
            embedding_id = existing["id"]
        else:
            embedding_id = str(uuid4())
            self._connection.execute(
                """
                INSERT INTO embeddings
                    (id, project_id, entity_type, entity_id, content_hash, provider, model,
                     dimensions, vector, text_preview, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    embedding_id, project_id, entity_type, entity_id, content_hash, provider,
                    model, len(vector), vector_json, text_preview, now,
                ),
            )
        row = self._connection.execute(
            "SELECT * FROM embeddings WHERE id = ?", (embedding_id,)
        ).fetchone()
        return _dict(row)

    def get(
        self, *, project_id: str | None, entity_type: EntityType, entity_id: str
    ) -> dict[str, Any] | None:
        row = self._connection.execute(
            "SELECT * FROM embeddings WHERE project_id IS ? AND entity_type = ? AND entity_id = ?",
            (project_id, entity_type, entity_id),
        ).fetchone()
        return _dict(row) if row else None

    def list_for_project(
        self, *, project_id: str | None, provider: str, model: str
    ) -> list[dict[str, Any]]:
        """Only rows embedded with the exact provider+model the caller is
        about to query with — comparing cosine similarity across vectors
        from different embedding spaces would be meaningless."""
        rows = self._connection.execute(
            "SELECT * FROM embeddings WHERE project_id IS ? AND provider = ? AND model = ?",
            (project_id, provider, model),
        ).fetchall()
        return [_dict(r) for r in rows]

    def count_for_project(self, project_id: str | None) -> int:
        row = self._connection.execute(
            "SELECT COUNT(*) AS n FROM embeddings WHERE project_id IS ?", (project_id,)
        ).fetchone()
        return int(row["n"])


def _dict(row: sqlite3.Row) -> dict[str, Any]:
    data = dict(row)
    data["vector"] = json.loads(data["vector"])
    return data
