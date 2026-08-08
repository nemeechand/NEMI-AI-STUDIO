from __future__ import annotations

import asyncio
import sqlite3
from collections.abc import Iterator
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from app.ai.orchestration.manager import _detect_conflicts
from app.ai.orchestration.project_manager import create_milestone_pipelines, parse_milestones
from app.core.config import Settings
from app.db.connection import get_connection
from app.db.repositories.agent_tasks_repository import AgentTasksRepository
from app.db.repositories.milestones_repository import MilestonesRepository
from app.db.repositories.workflows_repository import WorkflowsRepository
from app.db.schema import init_db
from app.server import create_app

OLLAMA_HOST = "http://127.0.0.1:11434"
OLLAMA_MODEL = "qwen2.5:0.5b"


def _ollama_available() -> bool:
    try:
        response = httpx.get(f"{OLLAMA_HOST}/api/tags", timeout=2.0)
        return response.status_code == 200
    except httpx.HTTPError:
        return False


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(create_app()) as test_client:
        yield test_client


@pytest.fixture
def connection(isolated_settings: Settings) -> Iterator[sqlite3.Connection]:
    with get_connection(isolated_settings) as conn:
        init_db(conn)
        yield conn


def _create_workflow(client: TestClient, **overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "title": "Build a todo app",
        "goal": "Build a simple todo list web app with add/complete/delete.",
        "provider": "ollama",
        "model": OLLAMA_MODEL,
    }
    payload.update(overrides)
    response = client.post("/workflows", json=payload)
    assert response.status_code == 201
    return response.json()  # type: ignore[no-any-return]


# --- parse_milestones (pure function) --------------------------------------


def test_parse_milestones_parses_multiple_sections() -> None:
    content = (
        "### MILESTONE: Project scaffolding\n"
        "Set up the base project structure and dependencies.\n\n"
        "### MILESTONE: Core todo CRUD\n"
        "Implement add, complete, and delete for todo items.\n"
    )

    milestones = parse_milestones(content)

    assert [m["title"] for m in milestones] == ["Project scaffolding", "Core todo CRUD"]
    assert "base project structure" in milestones[0]["description"]
    assert "add, complete, and delete" in milestones[1]["description"]


def test_parse_milestones_returns_empty_when_format_not_followed() -> None:
    assert parse_milestones("Sure! Here's a plan: first do X, then do Y.") == []


# --- workflow creation -------------------------------------------------------


def test_create_workflow_creates_planning_workflow_and_decomposition_task(
    client: TestClient,
) -> None:
    workflow = _create_workflow(client)

    assert workflow["status"] == "planning"
    assert workflow["approval_mode"] == "review"

    tasks = client.get("/agents/tasks").json()
    decomposition = [t for t in tasks if t["workflow_id"] == workflow["id"]]
    assert len(decomposition) == 1
    assert decomposition[0]["agent_role"] == "planner"
    assert decomposition[0]["milestone_id"] is None
    assert decomposition[0]["requires_approval"] is False


def test_create_workflow_with_manual_approval_requires_approval_on_decomposition_task(
    client: TestClient,
) -> None:
    workflow = _create_workflow(client, approval_mode="manual")

    tasks = client.get("/agents/tasks").json()
    decomposition = next(t for t in tasks if t["workflow_id"] == workflow["id"])
    assert decomposition["requires_approval"] is True
    assert decomposition["approved_at"] is None


def test_get_workflow_detail_includes_milestones_and_tasks(client: TestClient) -> None:
    workflow = _create_workflow(client)

    detail = client.get(f"/workflows/{workflow['id']}").json()

    assert detail["id"] == workflow["id"]
    assert detail["milestones"] == []
    assert len(detail["tasks"]) == 1


def test_get_unknown_workflow_returns_404(client: TestClient) -> None:
    assert client.get("/workflows/does-not-exist").status_code == 404


# --- create_milestone_pipelines (the Workflow Engine's fan-out) -------------


def test_create_milestone_pipelines_chains_across_milestones(
    connection: sqlite3.Connection,
) -> None:
    workflows_repo = WorkflowsRepository(connection)
    workflow = workflows_repo.create(
        project_id=None,
        title="Build a todo app",
        goal="Build a todo app.",
        provider="ollama",
        model=OLLAMA_MODEL,
        approval_mode="review",
    )
    decomposition_task = AgentTasksRepository(connection).create(
        project_id=None,
        title="Decompose goal",
        description=workflow["goal"],
        agent_role="planner",
        priority=1,
        depends_on_task_id=None,
        provider="ollama",
        model=OLLAMA_MODEL,
        workflow_id=workflow["id"],
        milestone_id=None,
    )

    create_milestone_pipelines(
        connection,
        workflow=workflow,
        milestones_data=[
            {"title": "Scaffolding", "description": "Set up the project."},
            {"title": "Core CRUD", "description": "Add/complete/delete todos."},
        ],
        decomposition_task_id=decomposition_task["id"],
    )

    milestones = MilestonesRepository(connection).list_for_workflow(workflow["id"])
    assert [m["title"] for m in milestones] == ["Scaffolding", "Core CRUD"]

    tasks = AgentTasksRepository(connection).list_for_workflow(workflow["id"])
    milestone_tasks = [t for t in tasks if t["milestone_id"] is not None]
    assert len(milestone_tasks) == 8  # 2 milestones x 4 stages

    first_milestone_tasks = [t for t in milestone_tasks if t["milestone_id"] == milestones[0]["id"]]
    assert [t["agent_role"] for t in first_milestone_tasks] == [
        "planner",
        "developer",
        "reviewer",
        "tester",
    ]
    # The first milestone's Planner stage depends on the decomposition task...
    assert first_milestone_tasks[0]["depends_on_task_id"] == decomposition_task["id"]
    # ...and the second milestone's Planner stage depends on the first
    # milestone's Tester stage — one linear chain across the whole workflow.
    second_milestone_tasks = [
        t for t in milestone_tasks if t["milestone_id"] == milestones[1]["id"]
    ]
    assert second_milestone_tasks[0]["depends_on_task_id"] == first_milestone_tasks[-1]["id"]


def test_create_milestone_pipelines_marks_tasks_requires_approval_for_manual_mode(
    connection: sqlite3.Connection,
) -> None:
    workflow = WorkflowsRepository(connection).create(
        project_id=None,
        title="Build a todo app",
        goal="Build a todo app.",
        provider="ollama",
        model=OLLAMA_MODEL,
        approval_mode="manual",
    )
    decomposition_task = AgentTasksRepository(connection).create(
        project_id=None,
        title="Decompose goal",
        description=workflow["goal"],
        agent_role="planner",
        priority=1,
        depends_on_task_id=None,
        provider="ollama",
        model=OLLAMA_MODEL,
        workflow_id=workflow["id"],
    )

    create_milestone_pipelines(
        connection,
        workflow=workflow,
        milestones_data=[{"title": "Scaffolding", "description": "Set up the project."}],
        decomposition_task_id=decomposition_task["id"],
    )

    tasks = AgentTasksRepository(connection).list_for_workflow(workflow["id"])
    milestone_tasks = [t for t in tasks if t["milestone_id"] is not None]
    assert all(t["requires_approval"] == 1 for t in milestone_tasks)


# --- pause / resume / cancel gate list_runnable() ---------------------------


def _make_workflow_with_one_task(
    connection: sqlite3.Connection, *, approval_mode: str = "review"
) -> tuple[dict[str, Any], dict[str, Any]]:
    workflow = WorkflowsRepository(connection).create(
        project_id=None,
        title="W",
        goal="G",
        provider="ollama",
        model=OLLAMA_MODEL,
        approval_mode=approval_mode,  # type: ignore[arg-type]
    )
    WorkflowsRepository(connection).set_status(workflow["id"], "queued")
    task = AgentTasksRepository(connection).create(
        project_id=None,
        title="Milestone task",
        description="Do it.",
        agent_role="planner",
        priority=2,
        depends_on_task_id=None,
        provider="ollama",
        model=OLLAMA_MODEL,
        workflow_id=workflow["id"],
        milestone_id=None,
        requires_approval=approval_mode == "manual",
    )
    return workflow, task


def test_paused_workflow_tasks_are_not_runnable(connection: sqlite3.Connection) -> None:
    workflow, task = _make_workflow_with_one_task(connection)
    tasks_repo = AgentTasksRepository(connection)
    assert task["id"] in {t["id"] for t in tasks_repo.list_runnable()}

    WorkflowsRepository(connection).pause(workflow["id"])
    assert task["id"] not in {t["id"] for t in tasks_repo.list_runnable()}

    WorkflowsRepository(connection).resume(workflow["id"])
    assert task["id"] in {t["id"] for t in tasks_repo.list_runnable()}


def test_cancelled_workflow_tasks_are_not_runnable(connection: sqlite3.Connection) -> None:
    workflow, task = _make_workflow_with_one_task(connection)
    WorkflowsRepository(connection).cancel(workflow["id"])

    tasks_repo = AgentTasksRepository(connection)
    assert task["id"] not in {t["id"] for t in tasks_repo.list_runnable()}


def test_manual_approval_task_not_runnable_until_approved(connection: sqlite3.Connection) -> None:
    _workflow, task = _make_workflow_with_one_task(connection, approval_mode="manual")
    tasks_repo = AgentTasksRepository(connection)
    assert task["id"] not in {t["id"] for t in tasks_repo.list_runnable()}

    assert tasks_repo.approve(task["id"]) is True
    assert task["id"] in {t["id"] for t in tasks_repo.list_runnable()}


# --- workflow pause/resume/cancel API ---------------------------------------


def test_pause_resume_cancel_workflow_via_api(client: TestClient) -> None:
    workflow = _create_workflow(client)

    paused = client.post(f"/workflows/{workflow['id']}/pause")
    assert paused.status_code == 200
    assert paused.json()["status"] == "paused"

    resumed = client.post(f"/workflows/{workflow['id']}/resume")
    assert resumed.status_code == 200
    assert resumed.json()["status"] in ("planning", "running", "queued")

    cancelled = client.post(f"/workflows/{workflow['id']}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"

    # The decomposition task, still queued, is cancelled along with it.
    tasks = client.get("/agents/tasks").json()
    decomposition = next(t for t in tasks if t["workflow_id"] == workflow["id"])
    assert decomposition["status"] == "cancelled"


def test_pause_unknown_workflow_returns_404(client: TestClient) -> None:
    assert client.post("/workflows/does-not-exist/pause").status_code == 404


# --- auto-resume after restart -----------------------------------------------


def test_requeue_orphaned_running_tasks(connection: sqlite3.Connection) -> None:
    task = AgentTasksRepository(connection).create(
        project_id=None,
        title="T",
        description="D",
        agent_role="planner",
        priority=2,
        depends_on_task_id=None,
        provider="ollama",
        model=OLLAMA_MODEL,
    )
    AgentTasksRepository(connection).mark_running(task["id"])
    assert AgentTasksRepository(connection).get(task["id"])["status"] == "running"

    requeued = AgentTasksRepository(connection).requeue_orphaned_running_tasks()

    assert task["id"] in requeued
    refreshed = AgentTasksRepository(connection).get(task["id"])
    assert refreshed["status"] == "queued"
    assert refreshed["started_at"] is None


# --- conflict detection -------------------------------------------------------


def test_mark_files_applied_via_api(client: TestClient) -> None:
    tasks = client.post(
        "/agents/tasks",
        json={
            "title": "T",
            "description": "D",
            "provider": "ollama",
            "model": OLLAMA_MODEL,
            "stages": ["planner"],
        },
    ).json()

    response = client.post(
        f"/agents/tasks/{tasks[0]['id']}/mark-files-applied", json={"snapshots": []}
    )
    assert response.status_code == 200
    assert response.json()["proposed_files_applied"] is True


def test_approve_unknown_task_returns_404(client: TestClient) -> None:
    assert client.post("/agents/tasks/does-not-exist/approve").status_code == 404


# --- conflict detection (direct, since forcing two real models to --------
# propose overlapping files reliably isn't practical for a live test) ------


def test_detect_conflicts_flags_overlapping_proposed_file_paths(
    connection: sqlite3.Connection,
) -> None:
    workflow = WorkflowsRepository(connection).create(
        project_id=None,
        title="W",
        goal="G",
        provider="ollama",
        model=OLLAMA_MODEL,
        approval_mode="review",
    )
    tasks_repo = AgentTasksRepository(connection)
    task_a = tasks_repo.create(
        project_id=None,
        title="Milestone A - Developer",
        description="D",
        agent_role="developer",
        priority=2,
        depends_on_task_id=None,
        provider="ollama",
        model=OLLAMA_MODEL,
        workflow_id=workflow["id"],
    )
    task_b = tasks_repo.create(
        project_id=None,
        title="Milestone B - Developer",
        description="D",
        agent_role="developer",
        priority=2,
        depends_on_task_id=None,
        provider="ollama",
        model=OLLAMA_MODEL,
        workflow_id=workflow["id"],
    )
    # Task B already completed with a proposed file at src/app.py.
    tasks_repo.mark_completed(
        task_b["id"],
        conversation_id=None,  # type: ignore[arg-type]
        result_summary="done",
        proposed_files=[{"path": "src/app.py", "content": "print('b')"}],
    )

    proposed_files_a = [{"path": "src/app.py", "content": "print('a')"}]
    _detect_conflicts(connection, task_a, proposed_files_a)

    refreshed = tasks_repo.get(task_a["id"])
    assert refreshed["conflict_warning"] is not None
    assert "src/app.py" in refreshed["conflict_warning"]
    assert "Milestone B - Developer" in refreshed["conflict_warning"]


def test_detect_conflicts_no_warning_when_paths_dont_overlap(
    connection: sqlite3.Connection,
) -> None:
    workflow = WorkflowsRepository(connection).create(
        project_id=None,
        title="W",
        goal="G",
        provider="ollama",
        model=OLLAMA_MODEL,
        approval_mode="review",
    )
    tasks_repo = AgentTasksRepository(connection)
    task_a = tasks_repo.create(
        project_id=None,
        title="Milestone A - Developer",
        description="D",
        agent_role="developer",
        priority=2,
        depends_on_task_id=None,
        provider="ollama",
        model=OLLAMA_MODEL,
        workflow_id=workflow["id"],
    )

    _detect_conflicts(connection, task_a, [{"path": "src/only_a.py", "content": "x"}])

    assert tasks_repo.get(task_a["id"])["conflict_warning"] is None


# --- real end-to-end goal decomposition (skipped if Ollama isn't running) --


@pytest.mark.skipif(not _ollama_available(), reason="Ollama is not running locally")
def test_real_goal_decomposition_runs_end_to_end(client: TestClient) -> None:
    """A genuine, non-mocked run: the goal-decomposition Planner task
    executes against real Ollama. The tiny local test model isn't
    guaranteed to follow the ### MILESTONE: format reliably (the same
    small-model limitation documented for proposed_files in Sprint 11),
    so this test accepts either real success (milestones + pipelines
    created) or the documented graceful failure path — both prove the
    mechanism itself works end to end; only silence (workflow stuck at
    'planning' forever) would be a real bug."""
    workflow = _create_workflow(
        client,
        goal="Add a single Python function that returns the string 'hello world'.",
    )

    async def drive_to_completion() -> None:
        for _ in range(20):
            client.post("/agents/run-cycle", json={"api_keys": {}})
            current = client.get(f"/workflows/{workflow['id']}").json()
            if current["status"] not in ("planning", "queued"):
                return
            if current["milestones"]:
                return
            await asyncio.sleep(1)

    asyncio.run(drive_to_completion())

    final = client.get(f"/workflows/{workflow['id']}").json()
    assert final["status"] != "planning"
    if final["status"] == "failed":
        assert "milestone" in (final["error_message"] or "").lower()
    else:
        assert len(final["milestones"]) >= 1
        assert len(final["tasks"]) >= 1 + 4  # decomposition + at least one full pipeline
