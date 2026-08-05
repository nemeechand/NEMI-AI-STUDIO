from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query

from app.api.schemas import LogEntryCreate, LogEntryOut
from app.core.config import get_settings
from app.db.connection import get_connection
from app.db.repositories.logs_repository import LogsRepository

router = APIRouter()


@router.get("/logs", response_model=list[LogEntryOut])
def list_logs(limit: int = Query(default=50, ge=1, le=500)) -> list[dict[str, Any]]:
    settings = get_settings()
    with get_connection(settings) as connection:
        return LogsRepository(connection).list_recent(limit=limit)


@router.post("/logs", response_model=LogEntryOut, status_code=201)
def create_log(entry: LogEntryCreate) -> dict[str, Any]:
    settings = get_settings()
    with get_connection(settings) as connection:
        return LogsRepository(connection).insert(
            level=entry.level,
            source=entry.source,
            message=entry.message,
            project_id=entry.project_id,
        )
