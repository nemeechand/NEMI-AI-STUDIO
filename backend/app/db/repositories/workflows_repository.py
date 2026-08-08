from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import uuid4

WorkflowStatus = Literal[
    "planning", "queued", "running", "paused", "completed", "failed", "cancelled"
]
ApprovalMode = Literal["auto", "review", "manual"]


class WorkflowsRepository:
    """Data access for the `workflows` table (Sprint 12) — one row per
    high-level goal the AI Project Manager has decomposed into milestones.
    See `app/ai/orchestration/project_manager.py` for goal decomposition
    and `app/ai/orchestration/manager.py` for how a workflow's status is
    kept in sync with its underlying `agent_tasks`."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def create(
        self,
        *,
        project_id: str | None,
        title: str,
        goal: str,
        provider: str,
        model: str,
        approval_mode: ApprovalMode,
    ) -> dict[str, Any]:
        workflow_id = str(uuid4())
        now = datetime.now(UTC).isoformat()
        self._connection.execute(
            """
            INSERT INTO workflows
                (id, project_id, title, goal, status, approval_mode, provider, model,
                 created_at, updated_at)
            VALUES (?, ?, ?, ?, 'planning', ?, ?, ?, ?, ?)
            """,
            (workflow_id, project_id, title, goal, approval_mode, provider, model, now, now),
        )
        self._connection.commit()
        return self.get(workflow_id)  # type: ignore[return-value]

    def get(self, workflow_id: str) -> dict[str, Any] | None:
        row = self._connection.execute(
            "SELECT * FROM workflows WHERE id = ?", (workflow_id,)
        ).fetchone()
        return _row_to_dict(row) if row else None

    def list_for_project(self, project_id: str | None) -> list[dict[str, Any]]:
        rows = self._connection.execute(
            "SELECT * FROM workflows WHERE project_id IS ? ORDER BY created_at DESC",
            (project_id,),
        ).fetchall()
        return [_row_to_dict(row) for row in rows]

    def set_conversation_id(self, workflow_id: str, conversation_id: str) -> None:
        self._connection.execute(
            "UPDATE workflows SET conversation_id = ?, updated_at = ? WHERE id = ?",
            (conversation_id, datetime.now(UTC).isoformat(), workflow_id),
        )
        self._connection.commit()

    def set_status(
        self, workflow_id: str, status: WorkflowStatus, *, error_message: str | None = None
    ) -> None:
        now = datetime.now(UTC).isoformat()
        is_terminal = status in ("completed", "failed", "cancelled")
        self._connection.execute(
            """
            UPDATE workflows
            SET status = :status,
                error_message = :error_message,
                started_at = CASE
                    WHEN :status = 'running' THEN COALESCE(started_at, :now)
                    ELSE started_at
                END,
                completed_at = CASE WHEN :is_terminal THEN :now ELSE completed_at END,
                updated_at = :now
            WHERE id = :workflow_id
            """,
            {
                "status": status,
                "error_message": error_message,
                "is_terminal": is_terminal,
                "now": now,
                "workflow_id": workflow_id,
            },
        )
        self._connection.commit()

    def pause(self, workflow_id: str) -> bool:
        # 'planning' is included so a user can pause immediately after
        # submitting a goal, before the goal-decomposition task itself
        # even runs — list_runnable() treats 'planning' as a normally
        # runnable workflow state (the decomposition task needs to run
        # during it), so without this a workflow paused that early would
        # have its decomposition task start anyway.
        cursor = self._connection.execute(
            "UPDATE workflows SET status = 'paused', updated_at = ? "
            "WHERE id = ? AND status IN ('planning', 'queued', 'running')",
            (datetime.now(UTC).isoformat(), workflow_id),
        )
        self._connection.commit()
        return cursor.rowcount > 0

    def resume(self, workflow_id: str) -> bool:
        # Goes to 'queued', not 'running' — accurate whether the workflow
        # was paused before decomposition even ran or mid-pipeline; the
        # next run_cycle()/its own _sync_workflow_progress upgrades it to
        # 'running' once a task actually picks up again.
        cursor = self._connection.execute(
            "UPDATE workflows SET status = 'queued', updated_at = ? "
            "WHERE id = ? AND status = 'paused'",
            (datetime.now(UTC).isoformat(), workflow_id),
        )
        self._connection.commit()
        return cursor.rowcount > 0

    def cancel(self, workflow_id: str) -> bool:
        cursor = self._connection.execute(
            """
            UPDATE workflows SET status = 'cancelled', updated_at = ?, completed_at = ?
            WHERE id = ? AND status IN ('planning', 'queued', 'running', 'paused')
            """,
            (datetime.now(UTC).isoformat(), datetime.now(UTC).isoformat(), workflow_id),
        )
        self._connection.commit()
        return cursor.rowcount > 0

    def set_documentation(self, workflow_id: str, documentation: str) -> None:
        """Sprint 15's Documentation Engine: stores the real, grounded
        Markdown summary generated once a workflow completes (see
        app/ai/orchestration/documentation.py). Written at most once per
        workflow — `documentation_generated_at` doubles as the idempotency
        marker `_sync_workflow_progress` checks before generating again."""
        now = datetime.now(UTC).isoformat()
        self._connection.execute(
            """
            UPDATE workflows
            SET documentation = ?, documentation_generated_at = ?, updated_at = ?
            WHERE id = ?
            """,
            (documentation, now, now, workflow_id),
        )
        self._connection.commit()

    def set_test_result(
        self, workflow_id: str, *, passed: bool, exit_code: int | None, output_tail: str | None
    ) -> None:
        """Sprint 15's Test Engine: a real pass/fail result from actually
        running the open project's test suite (triggered by the frontend,
        the same `build.runTests()` Sprint 13 already built — the backend
        never runs the user's project itself, only records the outcome)."""
        now = datetime.now(UTC).isoformat()
        result = json.dumps(
            {"passed": passed, "exit_code": exit_code, "output_tail": output_tail, "ran_at": now}
        )
        self._connection.execute(
            "UPDATE workflows SET last_test_result = ?, updated_at = ? WHERE id = ?",
            (result, now, workflow_id),
        )
        self._connection.commit()


def _row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    data = dict(row)
    if data.get("last_test_result"):
        data["last_test_result"] = json.loads(data["last_test_result"])
    return data
