from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.ai.cli_tools import detect_all
from app.ai.orchestration.manager import claim_cli_dispatch, record_cli_result, run_cycle
from app.ai.orchestration.task_router import resolve_execution
from app.api.schemas import (
    AgentOut,
    AgentPipelineCreate,
    AgentRunCycleRequest,
    AgentRunCycleResult,
    AgentTaskOut,
    ClaimCliDispatchOut,
    MarkFilesAppliedRequest,
    RecordCliResultRequest,
    RollbackInfoOut,
)
from app.core.config import get_settings
from app.db.connection import get_connection
from app.db.repositories.agent_tasks_repository import AgentTasksRepository
from app.db.repositories.agents_repository import AgentsRepository
from app.db.repositories.execution_policy_repository import ExecutionPolicyRepository
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


@router.get("/tasks/cli-runnable", response_model=list[AgentTaskOut])
def list_cli_runnable_tasks() -> list[dict[str, Any]]:
    """Sprint 16: the CLI-dispatch counterpart of what `run_cycle`
    consumes for 'api' tasks — Electron's own poller (not this backend)
    drives dispatch, since spawning the CLI tool and knowing the open
    project's filesystem path are both Electron's responsibility (Sprint
    5's Filesystem Ownership rule). Registered before `/tasks/{task_id}`
    so 'cli-runnable' is never swallowed as a task id."""
    settings = get_settings()
    with get_connection(settings) as connection:
        return AgentTasksRepository(connection).list_runnable(execution_backend="cli")


@router.post("/tasks/{task_id}/claim-cli-dispatch", response_model=ClaimCliDispatchOut)
async def claim_cli_dispatch_endpoint(task_id: str) -> dict[str, Any]:
    """Atomically claims one queued CLI-backend task and returns the
    fully-composed prompt Electron should feed to the actual CLI
    process — see app.ai.orchestration.manager.claim_cli_dispatch."""
    settings = get_settings()
    result = await claim_cli_dispatch(settings, task_id)
    if result is None:
        raise HTTPException(
            status_code=404, detail="Task not found, not queued, or not a CLI-backend task"
        )
    return result


@router.post("/tasks/{task_id}/record-cli-result", response_model=AgentTaskOut)
async def record_cli_result_endpoint(
    task_id: str, payload: RecordCliResultRequest
) -> dict[str, Any]:
    """Called by Electron once a dispatched CLI process has actually
    exited — see app.ai.orchestration.manager.record_cli_result. Reuses
    the same api_keys plumbing as /run-cycle purely so the workflow-sync
    step can generate Sprint 15 Documentation once a CLI-completed
    workflow finishes; never used to authenticate the CLI tool itself."""
    settings = get_settings()
    result = await record_cli_result(
        settings,
        task_id,
        success=payload.success,
        exit_code=payload.exit_code,
        output=payload.output,
        files_changed=payload.files_changed,
        error_message=payload.error_message,
        api_keys={},
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Task not found or not running")
    return result


@router.get("/tasks/{task_id}", response_model=AgentTaskOut)
def get_task(task_id: str) -> dict[str, Any]:
    settings = get_settings()
    with get_connection(settings) as connection:
        task = AgentTasksRepository(connection).get(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("/tasks", response_model=list[AgentTaskOut], status_code=201)
async def create_pipeline(payload: AgentPipelineCreate) -> list[dict[str, Any]]:
    """Enqueues one task per requested stage, chained by
    `depends_on_task_id` in the order given — e.g. the default
    planner->developer->reviewer->tester pipeline creates four tasks
    where only the first is immediately runnable; each subsequent one
    becomes runnable once its predecessor completes (see
    AgentTasksRepository.list_runnable and app.ai.orchestration.manager).

    Sprint 16: `use_task_router=True` resolves each stage's actual
    executor (a CLI tool, or `provider`/`model` as the API fallback)
    through the Task Router instead of hardcoding `provider`/`model` for
    every stage — a Developer stage might land on Claude Code while its
    Reviewer stage lands on Codex, per each role's own priority order and
    the current execution policy. If a stage has no available executor
    at all (no authenticated CLI, no configured API provider), pipeline
    creation fails outright with a clear 409 rather than silently
    creating a task nothing can ever run.
    """
    settings = get_settings()
    stage_plan: list[tuple[str, str, str | None]] = []  # (role, provider, cli_tool_id)
    if payload.use_task_router:
        statuses = await detect_all()
        cli_statuses = {s.id: s for s in statuses}
        with get_connection(settings) as connection:
            policy = ExecutionPolicyRepository(connection).get()
        for stage in payload.stages:
            decision = resolve_execution(
                role=stage,
                mode=policy["mode"],
                subscription_first=policy["subscription_first"],
                cli_statuses=cli_statuses,
                api_provider_configured=True,
                api_provider_id=payload.provider,
                api_provider_display_name=payload.provider,
            )
            if not decision.available or decision.execution_id is None:
                raise HTTPException(
                    status_code=409,
                    detail=f"No available AI executor for the '{stage}' stage: {decision.reason}",
                )
            if decision.backend == "cli":
                stage_plan.append((stage, decision.execution_id, decision.execution_id))
            else:
                stage_plan.append((stage, decision.execution_id, None))
    else:
        stage_plan = [(stage, payload.provider, None) for stage in payload.stages]

    created: list[dict[str, Any]] = []
    with get_connection(settings) as connection:
        repo = AgentTasksRepository(connection)
        previous_id: str | None = None
        for role_key, provider, cli_tool_id in stage_plan:
            task = repo.create(
                project_id=payload.project_id,
                title=payload.title,
                description=payload.description,
                agent_role=role_key,  # type: ignore[arg-type]
                priority=payload.priority,
                depends_on_task_id=previous_id,
                provider=provider,
                # A CLI-backend task has no real "model" the way an API
                # provider does — 'local' documents that plainly rather
                # than reusing payload.model, which would misleadingly
                # imply the CLI was told to use that specific model.
                model="local" if cli_tool_id else payload.model,
                execution_backend="cli" if cli_tool_id else "api",
                cli_tool_id=cli_tool_id,
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
