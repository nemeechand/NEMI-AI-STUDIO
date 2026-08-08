from __future__ import annotations

import sqlite3
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import uuid4

MilestoneStatus = Literal["pending", "queued", "running", "completed", "failed", "cancelled"]


class MilestonesRepository:
    """Data access for the `milestones` table (Sprint 12) — the AI
    Project Manager's decomposition of one workflow's goal into an
    ordered list of milestones, each backed by its own
    planner/developer/reviewer/tester pipeline in `agent_tasks`."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def create(
        self, *, workflow_id: str, title: str, description: str, order_index: int
    ) -> dict[str, Any]:
        milestone_id = str(uuid4())
        now = datetime.now(UTC).isoformat()
        self._connection.execute(
            """
            INSERT INTO milestones
                (id, workflow_id, title, description, order_index, status,
                 created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
            """,
            (milestone_id, workflow_id, title, description, order_index, now, now),
        )
        self._connection.commit()
        return self.get(milestone_id)  # type: ignore[return-value]

    def get(self, milestone_id: str) -> dict[str, Any] | None:
        row = self._connection.execute(
            "SELECT * FROM milestones WHERE id = ?", (milestone_id,)
        ).fetchone()
        return dict(row) if row else None

    def list_for_workflow(self, workflow_id: str) -> list[dict[str, Any]]:
        rows = self._connection.execute(
            "SELECT * FROM milestones WHERE workflow_id = ? ORDER BY order_index ASC",
            (workflow_id,),
        ).fetchall()
        return [dict(row) for row in rows]

    def set_status(self, milestone_id: str, status: MilestoneStatus) -> None:
        self._connection.execute(
            "UPDATE milestones SET status = ?, updated_at = ? WHERE id = ?",
            (status, datetime.now(UTC).isoformat(), milestone_id),
        )
        self._connection.commit()
