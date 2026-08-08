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
    MarkFilesAppliedRequest,
    RollbackInfoOut,
)
from app.core.config import get_settings
from app.db.connection import get_connection
from app.db.repositories.agent_tasks_repository import AgentTasksRepository
from app.db.repositories.agents_repository import AgentsRepository
from app.db.repositories.file_snapshots_repository import FileSnapshotsRepository
from app.db.repositories.knowledge_repository import KnowledgeRepository
from app.db.repositories.memory_repository import MemoryRepository

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


@router.post("/tasks/{task_id}/approve", response_model=AgentTaskOut)
def approve_task(task_id: str) -> dict[str, Any]:
    """Human Approval Mode's "Manual" tier: a task created with
    `requires_approval` stays excluded from `list_runnable()` until this
    is called — see AgentTasksRepository.list_runnable."""
    settings = get_settings()
    with get_connection(settings) as connection:
        repo = AgentTasksRepository(connection)
        if not repo.approve(task_id):
            raise HTTPException(
                status_code=404, detail="Task not found or not awaiting approval"
            )
        return repo.get(task_id)  # type: ignore[return-value]


@router.post("/tasks/{task_id}/mark-files-applied", response_model=AgentTaskOut)
def mark_files_applied(task_id: str, payload: MarkFilesAppliedRequest) -> dict[str, Any]:
    """Called by Electron main after it has actually written a Developer
    task's proposed files to disk (manually via the Dashboard's Apply
    button, or automatically under Human Approval Mode = Fully Automatic)
    — the backend never writes files itself (Sprint 5's locked Filesystem
    Ownership decision), it only records that it happened.

    Sprint 15's Safe Change Engine: `payload.snapshots` carries each
    file's real on-disk content from immediately before Electron
    overwrote it (or null if the file didn't exist), captured client-side
    for the same filesystem-ownership reason. Stored once per (task,
    file) as the Rollback System's restore target."""
    settings = get_settings()
    with get_connection(settings) as connection:
        repo = AgentTasksRepository(connection)
        task_before = repo.get(task_id)
        if not repo.mark_files_applied(task_id):
            raise HTTPException(status_code=404, detail="Task not found")
        result = repo.get(task_id)
        if task_before is not None:
            snapshots_repo = FileSnapshotsRepository(connection)
            for snapshot in payload.snapshots:
                snapshots_repo.create_if_missing(
                    task_id=task_id,
                    project_id=task_before["project_id"],
                    relative_path=snapshot.path,
                    previous_content=snapshot.previous_content,
                )
            if task_before.get("proposed_files"):
                _record_architecture_change(connection, task_before)
        connection.commit()
        return result  # type: ignore[return-value]


@router.get("/tasks/{task_id}/rollback-info", response_model=RollbackInfoOut)
def get_rollback_info(task_id: str) -> dict[str, Any]:
    """What Electron needs to actually restore this task's files to how
    they were before it was applied — the backend only ever returns the
    recorded data; the writes/deletes happen client-side (Sprint 5's
    Filesystem Ownership rule), confirmed afterward via mark-rolled-back."""
    settings = get_settings()
    with get_connection(settings) as connection:
        task = AgentTasksRepository(connection).get(task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")
        snapshots = FileSnapshotsRepository(connection).list_for_task(task_id)
    if not snapshots:
        raise HTTPException(
            status_code=404, detail="No rollback information recorded for this task"
        )
    return {
        "task_id": task_id,
        "files": [
            {"path": s["relative_path"], "previous_content": s["previous_content"]}
            for s in snapshots
        ],
    }


@router.post("/tasks/{task_id}/mark-rolled-back", response_model=AgentTaskOut)
def mark_rolled_back(task_id: str) -> dict[str, Any]:
    settings = get_settings()
    with get_connection(settings) as connection:
        repo = AgentTasksRepository(connection)
        if not repo.mark_rolled_back(task_id):
            raise HTTPException(status_code=404, detail="Task not found")
        return repo.get(task_id)  # type: ignore[return-value]


def _record_architecture_change(connection: Any, task: dict[str, Any]) -> None:
    """Sprint 14, Persistent AI Memory: applying a Developer task's
    proposed files is a real architecture change — the one moment code on
    disk actually moved — so it's recorded as `knowledge` memory (browsable
    via GET /knowledge/memory) and, when the task belongs to a workflow, as
    a `workflow --modifies--> file` graph edge for each applied path."""
    paths = [f["path"] for f in task["proposed_files"]]
    MemoryRepository(connection).remember(
        project_id=task["project_id"],
        type="knowledge",
        key=f"change:{task['id']}",
        value=f"Task '{task['title']}' applied changes to: {', '.join(paths)}",
    )
    if not task.get("workflow_id"):
        return
    graph_repo = KnowledgeRepository(connection)
    workflow_node = graph_repo.find_node_by_ref(
        project_id=task["project_id"], node_type="workflow", ref_id=task["workflow_id"]
    )
    if workflow_node is None:
        return
    for path in paths:
        file_node = graph_repo.find_node(
            project_id=task["project_id"], node_type="file", label=path
        )
        if file_node is None:
            continue
        graph_repo.add_edge(
            project_id=task["project_id"], from_node_id=workflow_node["id"],
            to_node_id=file_node["id"], relationship="modifies",
        )


@router.post("/run-cycle", response_model=AgentRunCycleResult)
async def trigger_run_cycle(payload: AgentRunCycleRequest) -> dict[str, int]:
    settings = get_settings()
    started = await run_cycle(settings, payload.api_keys)
    return {"started": started}
