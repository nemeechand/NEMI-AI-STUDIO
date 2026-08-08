from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.ai.orchestration.manager import run_cycle
from app.api.schemas import (
    AgentOut,
    AgentPipelineCreate,
    AgentRunCycleRequest,
    AgentRunCycleResult,
    AgentTaskOut,
)
from app.core.config import get_settings
from app.db.connection import get_connection
from app.db.repositories.agent_tasks_repository import AgentTasksRepository
from app.db.repositories.agents_repository import AgentsRepository

router = APIRouter(prefix="/agents")


@router.get("", response_model=list[AgentOut])
def list_agents() -> list[dict[str, Any]]:
    settings = get_settings()
    with get_connection(settings) as connection:
        return [
            {**row, "enabled": bool(row["enabled"])}
            for row in AgentsRepository(connection).list_agents()
        ]


@router.get("/tasks", response_model=list[AgentTaskOut])
def list_tasks(project_id: str | None = Query(default=None)) -> list[dict[str, Any]]:
    settings = get_settings()
    with get_connection(settings) as connection:
        return AgentTasksRepository(connection).list_for_project(project_id)


@router.get("/tasks/{task_id}", response_model=AgentTaskOut)
def get_task(task_id: str) -> dict[str, Any]:
    settings = get_settings()
    with get_connection(settings) as connection:
        task = AgentTasksRepository(connection).get(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("/tasks", response_model=list[AgentTaskOut], status_code=201)
def create_pipeline(payload: AgentPipelineCreate) -> list[dict[str, Any]]:
    """Enqueues one task per requested stage, chained by
    `depends_on_task_id` in the order given — e.g. the default
    planner->developer->reviewer->tester pipeline creates four tasks
    where only the first is immediately runnable; each subsequent one
    becomes runnable once its predecessor completes (see
    AgentTasksRepository.list_runnable and app.ai.orchestration.manager).
    """
    settings = get_settings()
    created: list[dict[str, Any]] = []
    with get_connection(settings) as connection:
        repo = AgentTasksRepository(connection)
        previous_id: str | None = None
        for stage in payload.stages:
            task = repo.create(
                project_id=payload.project_id,
                title=payload.title,
                description=payload.description,
                agent_role=stage,
                priority=payload.priority,
                depends_on_task_id=previous_id,
                provider=payload.provider,
                model=payload.model,
            )
            created.append(task)
            previous_id = task["id"]
    return created


@router.post("/tasks/{task_id}/cancel", status_code=204)
def cancel_task(task_id: str) -> None:
    settings = get_settings()
    with get_connection(settings) as connection:
        repo = AgentTasksRepository(connection)
        cancelled = repo.cancel(task_id)
        if cancelled:
            repo.cascade_cancel_dependents(task_id)
    if not cancelled:
        raise HTTPException(status_code=404, detail="Task not found or not cancellable")


@router.post("/tasks/{task_id}/retry", response_model=AgentTaskOut)
def retry_task(task_id: str) -> dict[str, Any]:
    settings = get_settings()
    with get_connection(settings) as connection:
        repo = AgentTasksRepository(connection)
        if not repo.retry(task_id):
            raise HTTPException(status_code=404, detail="Task not found or not in a failed state")
        return repo.get(task_id)  # type: ignore[return-value]


@router.post("/run-cycle", response_model=AgentRunCycleResult)
async def trigger_run_cycle(payload: AgentRunCycleRequest) -> dict[str, int]:
    settings = get_settings()
    started = await run_cycle(settings, payload.api_keys)
    return {"started": started}
