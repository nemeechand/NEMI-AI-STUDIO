from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Query

from app.core.config import get_settings
from app.db.connection import get_connection
from app.db.repositories.history_repository import HistoryRepository
from app.db.repositories.stats_repository import StatsRepository

router = APIRouter()

# Captured at import time (this module is imported once, when
# server.py builds the FastAPI app at process startup) — the "session"
# token-usage window's start. Approximate by design: within a second or
# two of the actual backend process start, which is precise enough for
# a dashboard figure, not a billing record.
_SESSION_STARTED_AT = datetime.now(UTC).isoformat()


@router.get("/stats/performance")
def get_performance_stats(project_id: str | None = Query(default=None)) -> dict[str, Any]:
    settings = get_settings()
    with get_connection(settings) as connection:
        return StatsRepository(connection).performance_summary(project_id=project_id)


@router.get("/stats/tokens")
def get_token_stats() -> dict[str, Any]:
    """Real per-provider token sums (from `ai_messages`, Sprint 10) over
    three windows, plus a labeled cost *estimate* (see `app/ai/pricing.py`
    — published list pricing, not a live-billed number). Ollama always
    costs $0 (local); a cloud model not in the pricing table reports
    `estimated_cost_usd: null` rather than a guessed figure."""
    now = datetime.now(UTC)
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    settings = get_settings()
    with get_connection(settings) as connection:
        repo = StatsRepository(connection)
        return {
            "session": repo.token_summary(since=_SESSION_STARTED_AT),
            "day": repo.token_summary(since=start_of_day),
            "month": repo.token_summary(since=start_of_month),
        }


@router.get("/history")
def get_history(
    project_id: str | None = Query(default=None), limit: int = Query(default=100, le=500)
) -> list[dict[str, Any]]:
    settings = get_settings()
    with get_connection(settings) as connection:
        return HistoryRepository(connection).list_recent(project_id=project_id, limit=limit)
