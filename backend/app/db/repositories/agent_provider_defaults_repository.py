from __future__ import annotations

import sqlite3
from datetime import UTC, datetime
from typing import Any

AGENT_ROLES = ("planner", "developer", "reviewer", "tester", "documentation")


class AgentProviderDefaultsRepository:
    """Data access for the `agent_provider_defaults` table (Sprint 15.5) —
    lets each orchestrated agent role use its own provider/model instead
    of always inheriting the workflow's. A role with no row here has no
    override; callers fall back to the workflow's own provider/model."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def get(self, agent_role: str) -> dict[str, Any] | None:
        row = self._connection.execute(
            "SELECT * FROM agent_provider_defaults WHERE agent_role = ?", (agent_role,)
        ).fetchone()
        return dict(row) if row else None

    def list_all(self) -> dict[str, dict[str, Any]]:
        rows = self._connection.execute("SELECT * FROM agent_provider_defaults").fetchall()
        return {row["agent_role"]: dict(row) for row in rows}

    def set(self, agent_role: str, *, provider: str, model: str) -> dict[str, Any]:
        now = datetime.now(UTC).isoformat()
        self._connection.execute(
            """
            INSERT INTO agent_provider_defaults (agent_role, provider, model, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(agent_role) DO UPDATE SET
                provider = excluded.provider,
                model = excluded.model,
                updated_at = excluded.updated_at
            """,
            (agent_role, provider, model, now),
        )
        self._connection.commit()
        return self.get(agent_role)  # type: ignore[return-value]

    def clear(self, agent_role: str) -> None:
        self._connection.execute(
            "DELETE FROM agent_provider_defaults WHERE agent_role = ?", (agent_role,)
        )
        self._connection.commit()
