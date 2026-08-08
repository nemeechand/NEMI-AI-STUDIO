from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.api.schemas import WorkflowCreate, WorkflowDetailOut, WorkflowOut
from app.core.config import get_settings
from app.db.connection import get_connection
from app.db.repositories.agent_tasks_repository import AgentTasksRepository
from app.db.repositories.history_repository import HistoryRepository
from app.db.repositories.milestones_repository import MilestonesRepository
from app.db.repositories.workflows_repository import WorkflowsRepository

router = APIRouter(prefix="/workflows")


@router.get("", response_model=list[WorkflowOut])
def list_workflows(project_id: str | None = Query(default=None)) -> list[dict[str, Any]]:
    settings = get_settings()
    with get_connection(settings) as connection:
        return WorkflowsRepository(connection).list_for_project(project_id)


@router.get("/{workflow_id}", response_model=WorkflowDetailOut)
def get_workflow(workflow_id: str) -> dict[str, Any]:
    settings = get_settings()
    with get_connection(settings) as connection:
        workflow = WorkflowsRepository(connection).get(workflow_id)
        if workflow is None:
            raise HTTPException(status_code=404, detail="Workflow not found")
        milestones = MilestonesRepository(connection).list_for_workflow(workflow_id)
        tasks = AgentTasksRepository(connection).list_for_workflow(workflow_id)
    return {**workflow, "milestones": milestones, "tasks": tasks}


@router.post("", response_model=WorkflowOut, status_code=201)
def create_workflow(payload: WorkflowCreate) -> dict[str, Any]:
    """The AI Project Manager's entry point: accepts a high-level goal and
    creates the workflow plus a single goal-decomposition task (a Planner
    task with no milestone yet). It does NOT call an AI provider
    synchronously here — the decomposition itself runs through the same
    stateless `run_cycle()` every other agent task does, so it gets
    retries/parallelism/no-server-side-keys for free instead of a second,
    inconsistent execution path. See
    app.ai.orchestration.manager._apply_decomposition for what happens
    once that task completes."""
    settings = get_settings()
    with get_connection(settings) as connection:
        workflow = WorkflowsRepository(connection).create(
            project_id=payload.project_id,
            title=payload.title,
            goal=payload.goal,
            provider=payload.provider,
            model=payload.model,
            approval_mode=payload.approval_mode,
        )
        AgentTasksRepository(connection).create(
            project_id=payload.project_id,
            title=f"Decompose goal: {payload.title}",
            description=payload.goal,
            agent_role="planner",
            priority=1,
            depends_on_task_id=None,
            provider=payload.provider,
            model=payload.model,
            workflow_id=workflow["id"],
            milestone_id=None,
            requires_approval=payload.approval_mode == "manual",
        )
        HistoryRepository(connection).record(
            project_id=payload.project_id,
            entity_type="workflow",
            entity_id=workflow["id"],
            action="created",
            snapshot={"title": payload.title, "goal": payload.goal},
        )
    return workflow


@router.post("/{workflow_id}/pause", response_model=WorkflowOut)
def pause_workflow(workflow_id: str) -> dict[str, Any]:
    settings = get_settings()
    with get_connection(settings) as connection:
        repo = WorkflowsRepository(connection)
        if not repo.pause(workflow_id):
            raise HTTPException(status_code=404, detail="Workflow not found or not pausable")
        workflow = repo.get(workflow_id)
        _record(connection, workflow, "paused")
        return workflow  # type: ignore[return-value]


@router.post("/{workflow_id}/resume", response_model=WorkflowOut)
def resume_workflow(workflow_id: str) -> dict[str, Any]:
    settings = get_settings()
    with get_connection(settings) as connection:
        repo = WorkflowsRepository(connection)
        if not repo.resume(workflow_id):
            raise HTTPException(status_code=404, detail="Workflow not found or not paused")
        workflow = repo.get(workflow_id)
        _record(connection, workflow, "resumed")
        return workflow  # type: ignore[return-value]


@router.post("/{workflow_id}/cancel", response_model=WorkflowOut)
def cancel_workflow(workflow_id: str) -> dict[str, Any]:
    """Cancels the workflow and every one of its tasks that hasn't
    started yet. A task already `running` when this is called is left to
    finish its in-flight call (the same "no force-abort mid-call"
    behavior Sprint 11's per-task cancel already has) — `run_cycle` will
    never start another task belonging to this workflow again either way,
    since `list_runnable()` excludes any workflow that isn't in
    planning/queued/running."""
    settings = get_settings()
    with get_connection(settings) as connection:
        workflows_repo = WorkflowsRepository(connection)
        if not workflows_repo.cancel(workflow_id):
            raise HTTPException(status_code=404, detail="Workflow not found or not cancellable")
        tasks_repo = AgentTasksRepository(connection)
        for task in tasks_repo.list_for_workflow(workflow_id):
            if task["status"] == "queued":
                tasks_repo.cancel(task["id"])
        workflow = workflows_repo.get(workflow_id)
        _record(connection, workflow, "cancelled")
        return workflow  # type: ignore[return-value]


@router.post("/{workflow_id}/restart", response_model=WorkflowOut)
def restart_workflow(workflow_id: str) -> dict[str, Any]:
    """Pause/Resume Center's "Restart Workflow": every failed/cancelled
    task in the workflow goes back to `queued` (completed tasks are left
    alone — a restart doesn't redo work that already succeeded), and the
    workflow itself goes back to `'queued'` so `run_cycle()` picks it
    back up on the next pass."""
    settings = get_settings()
    with get_connection(settings) as connection:
        workflows_repo = WorkflowsRepository(connection)
        workflow = workflows_repo.get(workflow_id)
        if workflow is None or workflow["status"] not in ("failed", "cancelled"):
            raise HTTPException(
                status_code=404, detail="Workflow not found or not in a restartable state"
            )
        AgentTasksRepository(connection).reset_tasks_for_workflow(workflow_id)
        workflows_repo.set_status(workflow_id, "queued")
        workflow = workflows_repo.get(workflow_id)
        _record(connection, workflow, "restarted")
        return workflow  # type: ignore[return-value]


def _record(connection: Any, workflow: dict[str, Any] | None, action_label: str) -> None:
    if workflow is None:
        return
    HistoryRepository(connection).record(
        project_id=workflow["project_id"],
        entity_type="workflow",
        entity_id=workflow["id"],
        action="updated",
        snapshot={"status": action_label, "title": workflow["title"]},
    )
