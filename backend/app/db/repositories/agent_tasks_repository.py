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
        workflow_id: str | None = None,
        milestone_id: str | None = None,
        requires_approval: bool = False,
    ) -> dict[str, Any]:
        task_id = str(uuid4())
        now = datetime.now(UTC).isoformat()
        self._connection.execute(
            """
            INSERT INTO agent_tasks
                (id, project_id, title, description, agent_role, status, priority,
                 depends_on_task_id, provider, model, retry_count, max_retries,
                 workflow_id, milestone_id, requires_approval, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
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
                workflow_id,
                milestone_id,
                1 if requires_approval else 0,
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
        project (the background loop runs globally, not per-project).

        Two additional gates, both Sprint 12 additions: a task belonging
        to a workflow that isn't actively runnable (paused, or already in
        a terminal state) is never runnable — this is how workflow
        Pause/Cancel is implemented, with no change to the task's own
        `status`, so a resumed workflow's tasks pick back up exactly
        where they were — and a task with `requires_approval` set is only
        runnable once a human has explicitly approved it (Manual Approval
        mode)."""
        queued = self._connection.execute(
            """
            SELECT agent_tasks.* FROM agent_tasks
            LEFT JOIN workflows ON workflows.id = agent_tasks.workflow_id
            WHERE agent_tasks.status = 'queued'
              AND (workflows.status IS NULL
                   OR workflows.status IN ('planning', 'queued', 'running'))
              AND (agent_tasks.requires_approval = 0 OR agent_tasks.approved_at IS NOT NULL)
            ORDER BY agent_tasks.priority ASC, agent_tasks.created_at ASC
            """
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

    def list_for_workflow(self, workflow_id: str) -> list[dict[str, Any]]:
        rows = self._connection.execute(
            "SELECT * FROM agent_tasks WHERE workflow_id = ? ORDER BY created_at ASC",
            (workflow_id,),
        ).fetchall()
        return [_row_to_dict(row) for row in rows]

    def approve(self, task_id: str) -> bool:
        now = datetime.now(UTC).isoformat()
        cursor = self._connection.execute(
            """
            UPDATE agent_tasks SET approved_at = ?, updated_at = ?
            WHERE id = ? AND requires_approval = 1 AND approved_at IS NULL
            """,
            (now, now, task_id),
        )
        self._connection.commit()
        return cursor.rowcount > 0

    def mark_files_applied(self, task_id: str) -> bool:
        now = datetime.now(UTC).isoformat()
        cursor = self._connection.execute(
            """
            UPDATE agent_tasks
            SET proposed_files_applied = 1, rolled_back_at = NULL, updated_at = ?
            WHERE id = ?
            """,
            (now, task_id),
        )
        self._connection.commit()
        return cursor.rowcount > 0

    def mark_rolled_back(self, task_id: str) -> bool:
        """Sprint 15's Safe Change Engine: called once Electron has
        actually restored (or deleted) every file recorded in this task's
        `file_snapshots` — reverses `proposed_files_applied` so the
        Dashboard's Apply/Reject/Rollback state reflects reality, and
        stamps when it happened."""
        now = datetime.now(UTC).isoformat()
        cursor = self._connection.execute(
            """
            UPDATE agent_tasks
            SET proposed_files_applied = 0, rolled_back_at = ?, updated_at = ?
            WHERE id = ?
            """,
            (now, now, task_id),
        )
        self._connection.commit()
        return cursor.rowcount > 0

    def set_conflict_warning(self, task_id: str, message: str) -> None:
        self._connection.execute(
            "UPDATE agent_tasks SET conflict_warning = ?, updated_at = ? WHERE id = ?",
            (message, datetime.now(UTC).isoformat(), task_id),
        )
        self._connection.commit()

    def requeue_orphaned_running_tasks(self) -> list[str]:
        """Sprint 12's "Auto Resume after restart": a task left in
        `status = 'running'` can only mean the previous process died
        mid-execution (a clean run always transitions it onward via
        `mark_completed`/`mark_failed_or_retry`) — there is no live call
        in flight to finish it. Called once at backend startup so those
        tasks re-enter the queue instead of sitting stuck forever."""
        now = datetime.now(UTC).isoformat()
        rows = self._connection.execute(
            "SELECT id FROM agent_tasks WHERE status = 'running'"
        ).fetchall()
        ids = [row["id"] for row in rows]
        if ids:
            self._connection.executemany(
                "UPDATE agent_tasks SET status = 'queued', started_at = NULL, updated_at = ? "
                "WHERE id = ?",
                [(now, task_id) for task_id in ids],
            )
            self._connection.commit()
        return ids

    def mark_running(self, task_id: str) -> bool:
        """Claims a queued task atomically — the `WHERE status = 'queued'`
        guard is the actual race-prevention: two overlapping scheduler
        cycles (Sprint 15.6 found the agent-cycle poll has no reentrancy
        guard) can both pass a prior `SELECT`-based check on the same
        task, but only one `UPDATE` can win the row here. Returns whether
        *this* call actually claimed it — the caller must not proceed to
        execute the task otherwise."""
        now = datetime.now(UTC).isoformat()
        cursor = self._connection.execute(
            "UPDATE agent_tasks SET status = 'running', started_at = ?, updated_at = ? "
            "WHERE id = ? AND status = 'queued'",
            (now, now, task_id),
        )
        self._connection.commit()
        return cursor.rowcount > 0

    def update_live_output(self, task_id: str, content: str) -> None:
        """Sprint 13: periodically flushed (not per-chunk) accumulated
        streamed text for a `running` task — the AI Thinking Panel's data
        source for genuine in-progress model output. Does not bump
        `updated_at`: this is high-frequency, low-significance churn, not
        a state transition other pollers should treat as "something
        changed" (unlike every other write in this repository)."""
        self._connection.execute(
            "UPDATE agent_tasks SET live_output = ? WHERE id = ?", (content, task_id)
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
                proposed_files = ?, completed_at = ?, updated_at = ?, live_output = NULL
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
                completed_at = ?, live_output = NULL
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
            UPDATE agent_tasks SET status = 'cancelled', updated_at = ?, completed_at = ?,
                live_output = NULL
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

    def reset_tasks_for_workflow(self, workflow_id: str) -> list[str]:
        """Sprint 13's "Restart Workflow": every `failed`/`cancelled` task
        in the workflow goes back to a clean `queued` slate (mirroring
        `retry()`'s semantics) so the scheduler picks the pipeline back up
        from wherever it stopped — `completed` tasks are left untouched,
        so a restart doesn't redo work that already succeeded."""
        now = datetime.now(UTC).isoformat()
        rows = self._connection.execute(
            "SELECT id FROM agent_tasks WHERE workflow_id = ? "
            "AND status IN ('failed', 'cancelled')",
            (workflow_id,),
        ).fetchall()
        ids = [row["id"] for row in rows]
        if ids:
            self._connection.executemany(
                """
                UPDATE agent_tasks
                SET status = 'queued', retry_count = 0, error_message = NULL,
                    completed_at = NULL, started_at = NULL, updated_at = ?
                WHERE id = ?
                """,
                [(now, task_id) for task_id in ids],
            )
            self._connection.commit()
        return ids


def _row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    data = dict(row)
    if data.get("proposed_files"):
        data["proposed_files"] = json.loads(data["proposed_files"])
    return data
