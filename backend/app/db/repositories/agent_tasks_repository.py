from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import uuid4

AgentRoleKey = Literal["planner", "developer", "reviewer", "tester"]
TaskStatus = Literal["queued", "running", "completed", "failed", "cancelled"]


class AgentTasksRepository:
    """Data access for the `agent_tasks` table (Sprint 11) — the
    orchestration task queue. See `app/ai/orchestration/manager.py` for
    the scheduler that actually runs these; this class is pure CRUD plus
    the status-transition queries the scheduler needs.
    """

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def create(
        self,
        *,
        project_id: str | None,
        title: str,
        description: str,
        agent_role: AgentRoleKey,
        priority: int,
        depends_on_task_id: str | None,
        provider: str,
        model: str,
        max_retries: int = 2,
    ) -> dict[str, Any]:
        task_id = str(uuid4())
        now = datetime.now(UTC).isoformat()
        self._connection.execute(
            """
            INSERT INTO agent_tasks
                (id, project_id, title, description, agent_role, status, priority,
                 depends_on_task_id, provider, model, retry_count, max_retries,
                 created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?, 0, ?, ?, ?)
            """,
            (
                task_id,
                project_id,
                title,
                description,
                agent_role,
                priority,
                depends_on_task_id,
                provider,
                model,
                max_retries,
                now,
                now,
            ),
        )
        self._connection.commit()
        return self.get(task_id)  # type: ignore[return-value]

    def get(self, task_id: str) -> dict[str, Any] | None:
        row = self._connection.execute(
            "SELECT * FROM agent_tasks WHERE id = ?", (task_id,)
        ).fetchone()
        return _row_to_dict(row) if row else None

    def list_for_project(self, project_id: str | None) -> list[dict[str, Any]]:
        rows = self._connection.execute(
            """
            SELECT * FROM agent_tasks
            WHERE project_id IS ?
            ORDER BY created_at ASC
            """,
            (project_id,),
        ).fetchall()
        return [_row_to_dict(row) for row in rows]

    def list_runnable(self) -> list[dict[str, Any]]:
        """Queued tasks whose dependency (if any) has already completed —
        what the scheduler is allowed to start next, across every
        project (the background loop runs globally, not per-project)."""
        queued = self._connection.execute(
            "SELECT * FROM agent_tasks WHERE status = 'queued' "
            "ORDER BY priority ASC, created_at ASC"
        ).fetchall()
        runnable: list[dict[str, Any]] = []
        for row in queued:
            task = _row_to_dict(row)
            dep_id = task["depends_on_task_id"]
            if dep_id is None:
                runnable.append(task)
                continue
            dep = self.get(dep_id)
            if dep is not None and dep["status"] == "completed":
                runnable.append(task)
        return runnable

    def mark_running(self, task_id: str) -> None:
        now = datetime.now(UTC).isoformat()
        self._connection.execute(
            "UPDATE agent_tasks SET status = 'running', started_at = ?, updated_at = ? "
            "WHERE id = ?",
            (now, now, task_id),
        )
        self._connection.commit()

    def mark_completed(
        self,
        task_id: str,
        *,
        conversation_id: str,
        result_summary: str,
        proposed_files: list[dict[str, str]] | None,
    ) -> None:
        now = datetime.now(UTC).isoformat()
        self._connection.execute(
            """
            UPDATE agent_tasks
            SET status = 'completed', conversation_id = ?, result_summary = ?,
                proposed_files = ?, completed_at = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                conversation_id,
                result_summary,
                json.dumps(proposed_files) if proposed_files else None,
                now,
                now,
                task_id,
            ),
        )
        self._connection.commit()

    def mark_failed_or_retry(self, task_id: str, *, error_message: str) -> TaskStatus:
        """Increments retry_count. Returns 'queued' if the task will be
        retried automatically, or 'failed' if it has exhausted its
        retries — the caller (the scheduler) uses this to decide whether
        to cascade-cancel dependents."""
        task = self.get(task_id)
        assert task is not None
        now = datetime.now(UTC).isoformat()
        new_retry_count = task["retry_count"] + 1
        next_status: TaskStatus = "queued" if new_retry_count <= task["max_retries"] else "failed"
        self._connection.execute(
            """
            UPDATE agent_tasks
            SET status = ?, retry_count = ?, error_message = ?, updated_at = ?,
                completed_at = ?
            WHERE id = ?
            """,
            (
                next_status,
                new_retry_count,
                error_message,
                now,
                now if next_status == "failed" else None,
                task_id,
            ),
        )
        self._connection.commit()
        return next_status

    def cancel(self, task_id: str) -> bool:
        now = datetime.now(UTC).isoformat()
        cursor = self._connection.execute(
            """
            UPDATE agent_tasks SET status = 'cancelled', updated_at = ?, completed_at = ?
            WHERE id = ? AND status IN ('queued', 'running')
            """,
            (now, now, task_id),
        )
        self._connection.commit()
        return cursor.rowcount > 0

    def cascade_cancel_dependents(self, task_id: str) -> list[str]:
        """When a task fails permanently (or is cancelled), anything
        queued behind it can never satisfy its dependency — "failure
        recovery" means marking those cancelled explicitly instead of
        leaving them stuck in 'queued' forever. Recursive: a chain of
        three dependent tasks all get cancelled, not just the immediate
        child."""
        cancelled_ids: list[str] = []
        direct_dependents = self._connection.execute(
            "SELECT id FROM agent_tasks WHERE depends_on_task_id = ? AND status = 'queued'",
            (task_id,),
        ).fetchall()
        now = datetime.now(UTC).isoformat()
        for row in direct_dependents:
            dependent_id = row["id"]
            self._connection.execute(
                "UPDATE agent_tasks SET status = 'cancelled', updated_at = ?, "
                "completed_at = ? WHERE id = ?",
                (now, now, dependent_id),
            )
            cancelled_ids.append(dependent_id)
        self._connection.commit()
        for dependent_id in list(cancelled_ids):
            cancelled_ids.extend(self.cascade_cancel_dependents(dependent_id))
        return cancelled_ids

    def retry(self, task_id: str) -> bool:
        """Manual retry (user-triggered), distinct from the scheduler's
        own automatic retry-with-backoff — resets to a clean slate rather
        than continuing the same retry count, since the user is making a
        fresh decision to try again, not the system auto-recovering."""
        now = datetime.now(UTC).isoformat()
        cursor = self._connection.execute(
            """
            UPDATE agent_tasks
            SET status = 'queued', retry_count = 0, error_message = NULL,
                completed_at = NULL, updated_at = ?
            WHERE id = ? AND status = 'failed'
            """,
            (now, task_id),
        )
        self._connection.commit()
        return cursor.rowcount > 0


def _row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    data = dict(row)
    if data.get("proposed_files"):
        data["proposed_files"] = json.loads(data["proposed_files"])
    return data
