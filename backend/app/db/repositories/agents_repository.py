from __future__ import annotations

import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.ai.agent_roles import AgentRole, load_agent_roles


class AgentsRepository:
    """Data access for the `agents` table (schema-ready since Sprint 4,
    implemented in Sprint 11). Seeded from `agents/*.md`, never
    user-editable through normal UI flows — see docs/DATABASE_SCHEMA.md.
    """

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def seed_from_role_files(self, agents_dir: Path) -> None:
        """Idempotent upsert-by-name, safe to call on every startup —
        matches the `_add_column_if_missing` philosophy in schema.py of
        "safe against both a fresh database and one from an earlier
        version of the app"."""
        now = datetime.now(UTC).isoformat()
        for role in load_agent_roles(agents_dir):
            existing = self._connection.execute(
                "SELECT id FROM agents WHERE name = ?", (role.display_name,)
            ).fetchone()
            if existing:
                self._connection.execute(
                    "UPDATE agents SET role_file = ? WHERE id = ?",
                    (role.role_file, existing["id"]),
                )
            else:
                self._connection.execute(
                    """
                    INSERT INTO agents (id, name, role_file, enabled, created_at)
                    VALUES (?, ?, ?, 1, ?)
                    """,
                    (str(uuid4()), role.display_name, role.role_file, now),
                )
        self._connection.commit()

    def list_agents(self) -> list[dict[str, Any]]:
        rows = self._connection.execute(
            "SELECT * FROM agents WHERE enabled = 1 ORDER BY name ASC"
        ).fetchall()
        return [dict(row) for row in rows]

    def get_by_id(self, agent_id: str) -> dict[str, Any] | None:
        row = self._connection.execute(
            "SELECT * FROM agents WHERE id = ?", (agent_id,)
        ).fetchone()
        return dict(row) if row else None

    def get_by_role_key(self, agents_dir: Path, role_key: str) -> dict[str, Any] | None:
        """Looks up a seeded agent row by its role file's key (e.g.
        "developer") rather than its display name — used by the task
        queue, which stores roles as the lowercase key
        (agent_tasks.agent_role), not the display name (agents.name)."""
        role_file_suffix = f"agents/{role_key}.md"
        row = self._connection.execute(
            "SELECT * FROM agents WHERE role_file = ?", (role_file_suffix,)
        ).fetchone()
        return dict(row) if row else None


def get_system_prompt(agents_dir: Path, role_key: str) -> str | None:
    """Direct role-file lookup, bypassing the DB — used wherever the
    caller already knows the role key (e.g. the task manager building a
    provider request) and doesn't need the seeded row's id/timestamps."""
    for role in load_agent_roles(agents_dir):
        if role.key == role_key:
            return role.system_prompt
    return None


__all__ = ["AgentsRepository", "get_system_prompt", "AgentRole"]
