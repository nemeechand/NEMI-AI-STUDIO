from __future__ import annotations

import sqlite3
from datetime import UTC, datetime
from typing import Any

_SINGLETON_ID = "default"
_DEFAULTS: dict[str, Any] = {"mode": "auto", "subscription_first": True}


class ExecutionPolicyRepository:
    """Data access for the Sprint 16 Task Router's `execution_policy`
    singleton row — mirrors `provider_settings`' "lazily created, all-
    defaults if never touched" pattern."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def get(self) -> dict[str, Any]:
        row = self._connection.execute(
            "SELECT * FROM execution_policy WHERE id = ?", (_SINGLETON_ID,)
        ).fetchone()
        if row is None:
            return {"id": _SINGLETON_ID, "updated_at": None, **_DEFAULTS}
        data = dict(row)
        data["subscription_first"] = bool(data["subscription_first"])
        return data

    def upsert(
        self, *, mode: str | None = None, subscription_first: bool | None = None
    ) -> dict[str, Any]:
        current = self.get()
        resolved_mode = mode if mode is not None else current["mode"]
        resolved_sub_first = (
            subscription_first if subscription_first is not None else current["subscription_first"]
        )
        now = datetime.now(UTC).isoformat()
        self._connection.execute(
            """
            INSERT INTO execution_policy (id, mode, subscription_first, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                mode = excluded.mode,
                subscription_first = excluded.subscription_first,
                updated_at = excluded.updated_at
            """,
            (_SINGLETON_ID, resolved_mode, 1 if resolved_sub_first else 0, now),
        )
        self._connection.commit()
        return self.get()
