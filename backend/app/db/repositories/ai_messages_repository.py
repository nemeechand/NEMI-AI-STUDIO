from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import uuid4

Status = Literal["complete", "cancelled", "error"]


class MessagesRepository:
    """Data access for the `ai_messages` table (Sprint 10)."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def add_user_message(
        self,
        *,
        conversation_id: str,
        content: str,
        context_refs: list[dict[str, Any]] | None,
    ) -> dict[str, Any]:
        return self._insert(
            conversation_id=conversation_id,
            role="user",
            content=content,
            provider=None,
            model=None,
            status="complete",
            error_message=None,
            prompt_tokens=None,
            completion_tokens=None,
            context_refs=context_refs,
        )

    def add_system_message(self, *, conversation_id: str, content: str) -> dict[str, Any]:
        """Sprint 11: persists an agent task's system prompt as part of
        its conversation transcript, so opening the task's conversation
        in the Chat Panel shows the full exchange, not just the visible
        user/assistant turns — useful for understanding why an agent
        behaved the way it did."""
        return self._insert(
            conversation_id=conversation_id,
            role="system",
            content=content,
            provider=None,
            model=None,
            status="complete",
            error_message=None,
            prompt_tokens=None,
            completion_tokens=None,
            context_refs=None,
        )

    def add_assistant_message(
        self,
        *,
        conversation_id: str,
        content: str,
        provider: str,
        model: str,
        status: Status,
        error_message: str | None = None,
        prompt_tokens: int | None = None,
        completion_tokens: int | None = None,
    ) -> dict[str, Any]:
        return self._insert(
            conversation_id=conversation_id,
            role="assistant",
            content=content,
            provider=provider,
            model=model,
            status=status,
            error_message=error_message,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            context_refs=None,
        )

    def _insert(
        self,
        *,
        conversation_id: str,
        role: str,
        content: str,
        provider: str | None,
        model: str | None,
        status: Status,
        error_message: str | None,
        prompt_tokens: int | None,
        completion_tokens: int | None,
        context_refs: list[dict[str, Any]] | None,
    ) -> dict[str, Any]:
        message_id = str(uuid4())
        now = datetime.now(UTC).isoformat()
        self._connection.execute(
            """
            INSERT INTO ai_messages
                (id, conversation_id, role, content, provider, model, status,
                 error_message, prompt_tokens, completion_tokens, context_refs, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                message_id,
                conversation_id,
                role,
                content,
                provider,
                model,
                status,
                error_message,
                prompt_tokens,
                completion_tokens,
                json.dumps(context_refs) if context_refs else None,
                now,
            ),
        )
        self._connection.commit()
        row = self._connection.execute(
            "SELECT * FROM ai_messages WHERE id = ?", (message_id,)
        ).fetchone()
        return _row_to_dict(row)

    def list_for_conversation(self, conversation_id: str) -> list[dict[str, Any]]:
        rows = self._connection.execute(
            "SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC",
            (conversation_id,),
        ).fetchall()
        return [_row_to_dict(row) for row in rows]


def _row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    data = dict(row)
    if data.get("context_refs"):
        data["context_refs"] = json.loads(data["context_refs"])
    return data
