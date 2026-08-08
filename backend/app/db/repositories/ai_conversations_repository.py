from __future__ import annotations

import sqlite3
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4


class ConversationsRepository:
    """Data access for the `ai_conversations` table (Sprint 10)."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def create(
        self,
        *,
        project_id: str | None,
        title: str,
        provider: str,
        model: str,
        agent_id: str | None = None,
        task_id: str | None = None,
    ) -> dict[str, Any]:
        conversation_id = str(uuid4())
        now = datetime.now(UTC).isoformat()
        self._connection.execute(
            """
            INSERT INTO ai_conversations
                (id, project_id, title, provider, model, agent_id, task_id,
                 created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (conversation_id, project_id, title, provider, model, agent_id, task_id, now, now),
        )
        self._connection.commit()
        return self.get(conversation_id)  # type: ignore[return-value]

    def get(self, conversation_id: str) -> dict[str, Any] | None:
        row = self._connection.execute(
            "SELECT * FROM ai_conversations WHERE id = ?", (conversation_id,)
        ).fetchone()
        return dict(row) if row else None

    def list_for_project(self, project_id: str | None, limit: int = 100) -> list[dict[str, Any]]:
        if project_id is None:
            rows = self._connection.execute(
                """
                SELECT * FROM ai_conversations
                WHERE project_id IS NULL
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        else:
            rows = self._connection.execute(
                """
                SELECT * FROM ai_conversations
                WHERE project_id = ?
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                (project_id, limit),
            ).fetchall()
        return [dict(row) for row in rows]

    def touch(self, conversation_id: str, *, provider: str, model: str) -> None:
        """Bumps `updated_at` and records the provider/model of the message
        that was just sent, so the conversation list shows what was last
        used without a join against `ai_messages`."""
        self._connection.execute(
            """
            UPDATE ai_conversations
            SET updated_at = ?, provider = ?, model = ?
            WHERE id = ?
            """,
            (datetime.now(UTC).isoformat(), provider, model, conversation_id),
        )
        self._connection.commit()

    def rename(self, conversation_id: str, title: str) -> bool:
        cursor = self._connection.execute(
            "UPDATE ai_conversations SET title = ?, updated_at = ? WHERE id = ?",
            (title, datetime.now(UTC).isoformat(), conversation_id),
        )
        self._connection.commit()
        return cursor.rowcount > 0

    def delete(self, conversation_id: str) -> bool:
        self._connection.execute(
            "DELETE FROM ai_messages WHERE conversation_id = ?", (conversation_id,)
        )
        cursor = self._connection.execute(
            "DELETE FROM ai_conversations WHERE id = ?", (conversation_id,)
        )
        self._connection.commit()
        return cursor.rowcount > 0
