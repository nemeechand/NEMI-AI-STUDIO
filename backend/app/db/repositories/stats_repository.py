from __future__ import annotations

import sqlite3
from datetime import UTC, datetime
from typing import Any

from app.ai.pricing import estimate_cost_usd

_ROLE_KEYS = ("planner", "developer", "reviewer", "tester")


class StatsRepository:
    """Read-only cross-table aggregations for Sprint 13's Performance
    Dashboard and Token & Cost Center — deliberately not tied to one
    table the way every other repository is, since every figure it
    returns is a real aggregate over `agent_tasks`/`ai_messages`, not a
    maintained running total (recomputed fresh each call; this app's
    data volumes are desktop-single-user scale, so there is no
    performance reason to cache it)."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def performance_summary(self, *, project_id: str | None = None) -> dict[str, Any]:
        where = "WHERE project_id = ?" if project_id is not None else ""
        params: tuple[Any, ...] = (project_id,) if project_id is not None else ()

        rows = self._connection.execute(
            f"SELECT status, agent_role, retry_count, started_at, completed_at "
            f"FROM agent_tasks {where}",
            params,
        ).fetchall()

        terminal = [r for r in rows if r["status"] in ("completed", "failed")]
        completed = [r for r in rows if r["status"] == "completed"]
        failed = [r for r in rows if r["status"] == "failed"]
        retried = [r for r in rows if r["retry_count"] > 0]

        durations = [
            (
                datetime.fromisoformat(r["completed_at"]) - datetime.fromisoformat(r["started_at"])
            ).total_seconds()
            for r in completed
            if r["started_at"] and r["completed_at"]
        ]
        avg_task_seconds = sum(durations) / len(durations) if durations else None

        per_role_avg: dict[str, float | None] = {}
        for role in _ROLE_KEYS:
            role_durations = [
                (
                    datetime.fromisoformat(r["completed_at"])
                    - datetime.fromisoformat(r["started_at"])
                ).total_seconds()
                for r in completed
                if r["agent_role"] == role and r["started_at"] and r["completed_at"]
            ]
            per_role_avg[role] = (
                sum(role_durations) / len(role_durations) if role_durations else None
            )

        one_hour_ago = datetime.now(UTC).timestamp() - 3600
        completed_last_hour = sum(
            1
            for r in completed
            if r["completed_at"]
            and datetime.fromisoformat(r["completed_at"]).timestamp() >= one_hour_ago
        )

        return {
            "total_tasks": len(rows),
            "completed_tasks": len(completed),
            "failed_tasks": len(failed),
            "success_rate": len(completed) / len(terminal) if terminal else None,
            "failure_rate": len(failed) / len(terminal) if terminal else None,
            "retry_rate": len(retried) / len(rows) if rows else None,
            "avg_task_seconds": avg_task_seconds,
            "avg_agent_seconds": per_role_avg,
            "tasks_completed_last_hour": completed_last_hour,
        }

    def token_summary(self, *, since: str) -> dict[str, Any]:
        rows = self._connection.execute(
            """
            SELECT provider, model, SUM(prompt_tokens) AS prompt_tokens,
                   SUM(completion_tokens) AS completion_tokens
            FROM ai_messages
            WHERE role = 'assistant' AND status = 'complete' AND created_at >= ?
                  AND provider IS NOT NULL AND model IS NOT NULL
            GROUP BY provider, model
            """,
            (since,),
        ).fetchall()

        by_provider: dict[str, dict[str, Any]] = {}
        total_prompt = 0
        total_completion = 0
        total_cost: float | None = 0.0
        for row in rows:
            provider = row["provider"]
            prompt_tokens = row["prompt_tokens"] or 0
            completion_tokens = row["completion_tokens"] or 0
            cost = estimate_cost_usd(provider, row["model"], prompt_tokens, completion_tokens)

            bucket = by_provider.setdefault(
                provider, {"prompt_tokens": 0, "completion_tokens": 0, "estimated_cost_usd": 0.0}
            )
            bucket["prompt_tokens"] += prompt_tokens
            bucket["completion_tokens"] += completion_tokens
            if cost is None:
                bucket["estimated_cost_usd"] = None
            elif bucket["estimated_cost_usd"] is not None:
                bucket["estimated_cost_usd"] += cost

            total_prompt += prompt_tokens
            total_completion += completion_tokens
            if cost is None:
                total_cost = None
            elif total_cost is not None:
                total_cost += cost

        return {
            "by_provider": by_provider,
            "total_prompt_tokens": total_prompt,
            "total_completion_tokens": total_completion,
            "total_estimated_cost_usd": total_cost,
        }
