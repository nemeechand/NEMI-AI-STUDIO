from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.api.schemas import ProjectOpenedCreate, ProjectOut
from app.core.config import get_settings
from app.db.connection import get_connection
from app.db.repositories.projects_repository import ProjectsRepository

router = APIRouter()


@router.get("/projects/recent", response_model=list[ProjectOut])
def list_recent_projects(limit: int = Query(default=20, ge=1, le=100)) -> list[dict[str, Any]]:
    settings = get_settings()
    with get_connection(settings) as connection:
        return ProjectsRepository(connection).list_recent(limit=limit)


@router.post("/projects/opened", response_model=ProjectOut, status_code=200)
def record_project_opened(payload: ProjectOpenedCreate) -> dict[str, Any]:
    settings = get_settings()
    with get_connection(settings) as connection:
        return ProjectsRepository(connection).record_opened(
            path=payload.path,
            name=payload.name,
            description=payload.description,
        )


@router.delete("/projects/{project_id}", status_code=204)
def remove_recent_project(project_id: str) -> None:
    settings = get_settings()
    with get_connection(settings) as connection:
        deleted = ProjectsRepository(connection).delete(project_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")
