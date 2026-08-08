from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import uuid4

HistoryAction = Literal["created", "updated", "deleted"]


class HistoryRepository:
    """Data access for the `history` table — schema-ready since Sprint 3,
    given its first real implementation in Sprint 13 as the Execution
    History feed: an append-only audit trail of workflow/task lifecycle
    events. `action` stays within the table's original three-value CHECK
    constraint (a state transition is recorded as `'updated'` regardless
    of which specific status it moved to — the specifics live in
    `snapshot`), rather than widening it, since the schema predates this
    sprint and CHECK constraints can't be altered in place (see
    docs/DATABASE_SCHEMA.md's Sprint 12 note on the same constraint)."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def record(
        self,
        *,
        project_id: str | None,
        entity_type: str,
        entity_id: str,
        action: HistoryAction,
        snapshot: dict[str, Any],
    ) -> dict[str, Any]:
        entry_id = str(uuid4())
        now = datetime.now(UTC).isoformat()
        self._connection.execute(
            """
            INSERT INTO history
                (id, project_id, entity_type, entity_id, action, snapshot, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (entry_id, project_id, entity_type, entity_id, action, json.dumps(snapshot), now),
        )
        self._connection.commit()
        row = self._connection.execute(
            "SELECT * FROM history WHERE id = ?", (entry_id,)
        ).fetchone()
        return _row_to_dict(row)

    def list_recent(
        self, *, project_id: str | None = None, limit: int = 100
    ) -> list[dict[str, Any]]:
        if project_id is None:
            rows = self._connection.execute(
                "SELECT * FROM history ORDER BY created_at DESC LIMIT ?", (limit,)
            ).fetchall()
        else:
            rows = self._connection.execute(
                "SELECT * FROM history WHERE project_id = ? ORDER BY created_at DESC LIMIT ?",
                (project_id, limit),
            ).fetchall()
        return [_row_to_dict(row) for row in rows]


def _row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    data = dict(row)
    if data.get("snapshot"):
        data["snapshot"] = json.loads(data["snapshot"])
    return data
