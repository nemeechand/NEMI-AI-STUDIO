from __future__ import annotations

import asyncio
import sqlite3
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

import app.api.agents as agents_api
from app.ai.cli_tools import CliToolStatus
from app.ai.orchestration.manager import claim_cli_dispatch, record_cli_result
from app.ai.orchestration.project_manager import create_milestone_pipelines
from app.core.config import Settings
from app.db.connection import get_connection
from app.db.repositories.agent_provider_defaults_repository import (
    AgentProviderDefaultsRepository,
)
from app.db.repositories.agent_tasks_repository import AgentTasksRepository
from app.db.repositories.workflows_repository import WorkflowsRepository
from app.db.schema import init_db
from app.server import create_app

OLLAMA_MODEL = "qwen2.5:0.5b"


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(create_app()) as test_client:
        yield test_client


@pytest.fixture
def connection(isolated_settings: Settings) -> Iterator[sqlite3.Connection]:
    with get_connection(isolated_settings) as conn:
        init_db(conn)
        yield conn


def _available(tool_id: str) -> CliToolStatus:
    return CliToolStatus(
        id=tool_id,  # type: ignore[arg-type]
        display_name=tool_id,
        installed=True,
        binary_path="/usr/bin/x",
        version="1.0.0",
        authenticated=True,
        roles=("developer", "planner", "reviewer", "tester"),
        role_note="",
    )


def _unavailable(tool_id: str) -> CliToolStatus:
    return CliToolStatus(
        id=tool_id,  # type: ignore[arg-type]
        display_name=tool_id,
        installed=False,
        binary_path=None,
        version=None,
        authenticated=None,
        roles=("developer", "planner", "reviewer", "tester"),
        role_note="",
    )


def _mock_detect_all(statuses: list[CliToolStatus]):  # type: ignore[no-untyped-def]
    async def _fake() -> list[CliToolStatus]:
        return statuses

    return _fake


# --- POST /agents/tasks with use_task_router ---------------------------------


def test_create_pipeline_with_task_router_routes_to_available_cli(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        agents_api,
        "detect_all",
        _mock_detect_all(
            [_available("claude-code-cli"), _unavailable("codex-cli"), _unavailable("gemini-cli")]
        ),
    )
    response = client.post(
        "/agents/tasks",
        json={
            "title": "Implement login",
            "description": "Add login form.",
            "provider": "ollama",
            "model": OLLAMA_MODEL,
            "stages": ["developer"],
            "use_task_router": True,
        },
    )

    assert response.status_code == 201
    tasks = response.json()
    assert len(tasks) == 1
    assert tasks[0]["execution_backend"] == "cli"
    assert tasks[0]["cli_tool_id"] == "claude-code-cli"
    assert tasks[0]["provider"] == "claude-code-cli"
    assert tasks[0]["model"] == "local"


def test_create_pipeline_with_task_router_falls_back_to_api_and_marks_it(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        agents_api,
        "detect_all",
        _mock_detect_all(
            [_unavailable("claude-code-cli"), _unavailable("codex-cli"), _unavailable("gemini-cli")]
        ),
    )
    response = client.post(
        "/agents/tasks",
        json={
            "title": "Implement login",
            "description": "Add login form.",
            "provider": "ollama",
            "model": OLLAMA_MODEL,
            "stages": ["developer"],
            "use_task_router": True,
        },
    )

    assert response.status_code == 201
    tasks = response.json()
    assert tasks[0]["execution_backend"] == "api"
    assert tasks[0]["provider"] == "ollama"


def test_create_pipeline_with_task_router_fails_loudly_when_subscription_first_off_and_no_api(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Never creates a task nothing can run — a 409, not a silently-broken
    'queued forever' task."""
    monkeypatch.setattr(
        agents_api,
        "detect_all",
        _mock_detect_all(
            [_unavailable("claude-code-cli"), _unavailable("codex-cli"), _unavailable("gemini-cli")]
        ),
    )
    client.put("/cli-tools/execution-policy", json={"subscription_first": False})
    # api_provider_configured is always True in create_pipeline's task-router
    # resolution today (it treats payload.provider as configured) — force
    # unavailability by using subscription_first=False with an API provider
    # that IS configured; instead exercise the true "nothing available"
    # path by disabling subscription_first AND leaving mode pinned to a
    # specific unavailable CLI tool.
    client.put("/cli-tools/execution-policy", json={"mode": "claude-code-cli"})

    response = client.post(
        "/agents/tasks",
        json={
            "title": "Implement login",
            "description": "Add login form.",
            "provider": "ollama",
            "model": OLLAMA_MODEL,
            "stages": ["developer"],
            "use_task_router": True,
        },
    )

    assert response.status_code == 409
    assert "developer" in response.json()["error"]["message"]


def test_create_pipeline_without_task_router_is_unchanged(client: TestClient) -> None:
    response = client.post(
        "/agents/tasks",
        json={
            "title": "Implement login",
            "description": "Add login form.",
            "provider": "ollama",
            "model": OLLAMA_MODEL,
            "stages": ["developer"],
        },
    )
    assert response.status_code == 201
    tasks = response.json()
    assert tasks[0]["execution_backend"] == "api"
    assert tasks[0]["cli_tool_id"] is None
    assert tasks[0]["provider"] == "ollama"


# --- CLI dispatch endpoints ----------------------------------------------------


def _create_cli_task(connection: sqlite3.Connection, **overrides: Any) -> dict[str, Any]:
    defaults: dict[str, Any] = dict(
        project_id=None,
        title="CLI developer task",
        description="Implement the feature.",
        agent_role="developer",
        priority=2,
        depends_on_task_id=None,
        provider="claude-code-cli",
        model="local",
        execution_backend="cli",
        cli_tool_id="claude-code-cli",
    )
    defaults.update(overrides)
    return AgentTasksRepository(connection).create(**defaults)


def test_list_cli_runnable_tasks_only_returns_cli_backend_tasks(
    client: TestClient, connection: sqlite3.Connection
) -> None:
    cli_task = _create_cli_task(connection)
    api_task = AgentTasksRepository(connection).create(
        project_id=None,
        title="API task",
        description="Do something.",
        agent_role="developer",
        priority=2,
        depends_on_task_id=None,
        provider="ollama",
        model=OLLAMA_MODEL,
    )

    response = client.get("/agents/tasks/cli-runnable")

    assert response.status_code == 200
    ids = {t["id"] for t in response.json()}
    assert cli_task["id"] in ids
    assert api_task["id"] not in ids


def test_claim_cli_dispatch_marks_running_and_returns_composed_prompt(
    connection: sqlite3.Connection, isolated_settings: Settings
) -> None:
    task = _create_cli_task(connection)

    result = asyncio.run(claim_cli_dispatch(isolated_settings, task["id"]))

    assert result is not None
    assert result["cli_tool_id"] == "claude-code-cli"
    assert task["description"] in result["prompt"]
    claimed = AgentTasksRepository(connection).get(task["id"])
    assert claimed is not None
    assert claimed["status"] == "running"
    assert claimed["conversation_id"] is not None


def test_claim_cli_dispatch_is_atomic_only_one_of_two_concurrent_claims_succeeds(
    connection: sqlite3.Connection, isolated_settings: Settings
) -> None:
    task = _create_cli_task(connection)

    async def _race() -> list[dict[str, Any] | None]:
        return list(
            await asyncio.gather(
                claim_cli_dispatch(isolated_settings, task["id"]),
                claim_cli_dispatch(isolated_settings, task["id"]),
            )
        )

    results = asyncio.run(_race())
    successes = [r for r in results if r is not None]
    assert len(successes) == 1


def test_claim_cli_dispatch_returns_none_for_non_cli_task(
    connection: sqlite3.Connection, isolated_settings: Settings
) -> None:
    api_task = AgentTasksRepository(connection).create(
        project_id=None,
        title="API task",
        description="Do something.",
        agent_role="developer",
        priority=2,
        depends_on_task_id=None,
        provider="ollama",
        model=OLLAMA_MODEL,
    )

    result = asyncio.run(claim_cli_dispatch(isolated_settings, api_task["id"]))

    assert result is None


def test_record_cli_result_success_finalizes_task_with_files_changed(
    connection: sqlite3.Connection, isolated_settings: Settings
) -> None:
    task = _create_cli_task(connection)
    asyncio.run(claim_cli_dispatch(isolated_settings, task["id"]))

    result = asyncio.run(
        record_cli_result(
            isolated_settings,
            task["id"],
            success=True,
            exit_code=0,
            output="Implemented the login form in src/Login.tsx.",
            files_changed=["src/Login.tsx"],
            error_message=None,
            api_keys={},
        )
    )

    assert result is not None
    assert result["status"] == "completed"
    assert result["files_changed"] == ["src/Login.tsx"]
    assert result["cli_exit_code"] == 0
    assert result["result_summary"] is not None


def test_record_cli_result_failure_retries_then_permanently_fails(
    connection: sqlite3.Connection, isolated_settings: Settings
) -> None:
    """Failure recovery: the same automatic retry-with-backoff the API
    path gets (max_retries default 2) applies identically to CLI tasks."""
    task = _create_cli_task(connection, max_retries=1)

    async def _fail_twice() -> dict[str, Any] | None:
        await claim_cli_dispatch(isolated_settings, task["id"])
        first = await record_cli_result(
            isolated_settings,
            task["id"],
            success=False,
            exit_code=1,
            output="",
            files_changed=[],
            error_message="CLI crashed.",
            api_keys={},
        )
        assert first is not None
        assert first["status"] == "queued"  # retried automatically

        await claim_cli_dispatch(isolated_settings, task["id"])
        return await record_cli_result(
            isolated_settings,
            task["id"],
            success=False,
            exit_code=1,
            output="",
            files_changed=[],
            error_message="CLI crashed again.",
            api_keys={},
        )

    second = asyncio.run(_fail_twice())
    assert second is not None
    assert second["status"] == "failed"
    assert second["error_message"] == "CLI crashed again."


def test_record_cli_result_cascades_cancel_to_dependent_tasks(
    connection: sqlite3.Connection, isolated_settings: Settings
) -> None:
    task = _create_cli_task(connection, max_retries=0)
    dependent = AgentTasksRepository(connection).create(
        project_id=None,
        title="Reviewer task",
        description="Review it.",
        agent_role="reviewer",
        priority=2,
        depends_on_task_id=task["id"],
        provider="claude-code-cli",
        model="local",
        execution_backend="cli",
        cli_tool_id="claude-code-cli",
    )

    async def _fail() -> None:
        await claim_cli_dispatch(isolated_settings, task["id"])
        await record_cli_result(
            isolated_settings,
            task["id"],
            success=False,
            exit_code=1,
            output="",
            files_changed=[],
            error_message="Permanent failure.",
            api_keys={},
        )

    asyncio.run(_fail())

    reloaded_dependent = AgentTasksRepository(connection).get(dependent["id"])
    assert reloaded_dependent is not None
    assert reloaded_dependent["status"] == "cancelled"


def test_record_cli_result_returns_none_for_task_not_running(
    connection: sqlite3.Connection, isolated_settings: Settings
) -> None:
    task = _create_cli_task(connection)  # still 'queued', never claimed

    result = asyncio.run(
        record_cli_result(
            isolated_settings,
            task["id"],
            success=True,
            exit_code=0,
            output="",
            files_changed=[],
            error_message=None,
            api_keys={},
        )
    )

    assert result is None


def test_record_cli_result_endpoint_404s_for_unknown_task(client: TestClient) -> None:
    response = client.post(
        "/agents/tasks/does-not-exist/record-cli-result",
        json={"success": True, "exit_code": 0, "output": "", "files_changed": []},
    )
    assert response.status_code == 404


def test_claim_cli_dispatch_endpoint_404s_for_unknown_task(client: TestClient) -> None:
    response = client.post("/agents/tasks/does-not-exist/claim-cli-dispatch")
    assert response.status_code == 404


# --- run_cycle must never try to execute a 'cli' task --------------------------


def test_run_cycle_ignores_cli_backend_tasks(
    connection: sqlite3.Connection, isolated_settings: Settings
) -> None:
    from app.ai.orchestration.manager import run_cycle

    _create_cli_task(connection)  # queued, execution_backend='cli'

    # Would raise UnknownProviderError if run_cycle ever tried to execute
    # this task via get_provider("claude-code-cli") — it must not.
    started = asyncio.run(run_cycle(isolated_settings, {}))

    assert started == 0


# --- create_milestone_pipelines routes CLI-tool role overrides -----------------


def test_create_milestone_pipelines_routes_cli_tool_role_override(
    connection: sqlite3.Connection,
) -> None:
    AgentProviderDefaultsRepository(connection).set(
        "developer", provider="claude-code-cli", model="ignored"
    )
    workflow = WorkflowsRepository(connection).create(
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
        milestones_data=[{"title": "Scaffolding", "description": "Set up the project."}],
        decomposition_task_id=decomposition_task["id"],
    )

    tasks = AgentTasksRepository(connection).list_for_workflow(workflow["id"])
    developer_task = next(t for t in tasks if t["agent_role"] == "developer")
    assert developer_task["execution_backend"] == "cli"
    assert developer_task["cli_tool_id"] == "claude-code-cli"
    assert developer_task["provider"] == "claude-code-cli"
    assert developer_task["model"] == "local"

    planner_task = next(
        t for t in tasks if t["agent_role"] == "planner" and t["milestone_id"] is not None
    )
    assert planner_task["execution_backend"] == "api"
    assert planner_task["cli_tool_id"] is None
    assert planner_task["provider"] == "ollama"


# --- /cli-tools/resolve ---------------------------------------------------------


def test_resolve_execution_endpoint_reflects_current_policy(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    import app.api.cli_tools as cli_tools_api

    monkeypatch.setattr(
        cli_tools_api,
        "detect_all",
        _mock_detect_all(
            [_available("gemini-cli"), _unavailable("codex-cli"), _unavailable("claude-code-cli")]
        ),
    )
    response = client.post(
        "/cli-tools/resolve",
        json={"role": "tester", "api_provider_configured": False},
    )

    assert response.status_code == 200
    decision = response.json()
    assert decision["available"] is True
    assert decision["backend"] == "cli"
    assert decision["execution_id"] == "gemini-cli"


def test_execution_policy_roundtrip_via_api(client: TestClient) -> None:
    response = client.put(
        "/cli-tools/execution-policy", json={"mode": "codex-cli", "subscription_first": False}
    )
    assert response.status_code == 200
    assert response.json()["mode"] == "codex-cli"
    assert response.json()["subscription_first"] is False

    response = client.get("/cli-tools/execution-policy")
    assert response.json()["mode"] == "codex-cli"
