from __future__ import annotations

import asyncio
from collections.abc import Iterator
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from app.ai.orchestration.manager import _extract_proposed_files
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


def _create_pipeline(client: TestClient, **overrides: Any) -> list[dict[str, Any]]:
    payload: dict[str, Any] = {
        "title": "Test pipeline",
        "description": "Do something useful.",
        "provider": "ollama",
        "model": OLLAMA_MODEL,
    }
    payload.update(overrides)
    response = client.post("/agents/tasks", json=payload)
    assert response.status_code == 201
    return response.json()  # type: ignore[no-any-return]


def test_agents_seeded_on_startup(client: TestClient) -> None:
    response = client.get("/agents")

    assert response.status_code == 200
    names = {a["name"] for a in response.json()}
    assert names == {
        "Architect",
        "Planner",
        "Developer",
        "Reviewer",
        "Tester",
        "Debugger",
        "Documentation",
        "Release Manager",
    }
    for agent in response.json():
        assert agent["role_file"].startswith("agents/")
        assert agent["enabled"] is True


def test_create_pipeline_chains_tasks_by_dependency(client: TestClient) -> None:
    tasks = _create_pipeline(client, stages=["planner", "developer", "reviewer", "tester"])

    assert len(tasks) == 4
    roles = [t["agent_role"] for t in tasks]
    assert roles == ["planner", "developer", "reviewer", "tester"]
    assert tasks[0]["depends_on_task_id"] is None
    assert tasks[1]["depends_on_task_id"] == tasks[0]["id"]
    assert tasks[2]["depends_on_task_id"] == tasks[1]["id"]
    assert tasks[3]["depends_on_task_id"] == tasks[2]["id"]
    assert all(t["status"] == "queued" for t in tasks)


def test_create_pipeline_defaults_to_full_four_stages(client: TestClient) -> None:
    tasks = _create_pipeline(client)

    assert [t["agent_role"] for t in tasks] == ["planner", "developer", "reviewer", "tester"]


def test_list_tasks_scoped_by_project(client: TestClient) -> None:
    project = client.post(
        "/projects/opened", json={"path": "/tmp/agent-proj", "name": "agent-proj"}
    ).json()
    _create_pipeline(client, project_id=project["id"], stages=["planner"])
    _create_pipeline(client, stages=["planner"])  # global, project_id=None

    scoped = client.get("/agents/tasks", params={"project_id": project["id"]}).json()
    assert len(scoped) == 1
    global_only = client.get("/agents/tasks").json()
    assert len(global_only) == 1


def test_run_cycle_only_starts_tasks_whose_dependency_is_satisfied(client: TestClient) -> None:
    """Without Ollama actually running, tasks will fail fast (network
    error) rather than hang — still proves the scheduler only ever
    attempts the dependency-satisfied task, never a downstream one."""
    tasks = _create_pipeline(client, stages=["planner", "developer"])

    result = client.post("/agents/run-cycle", json={"api_keys": {}})
    assert result.status_code == 200
    assert result.json()["started"] in (0, 1)  # 0 if Ollama unreachable and it failed instantly

    developer_task = client.get(f"/agents/tasks/{tasks[1]['id']}").json()
    assert developer_task["status"] == "queued"  # never touched — planner hasn't completed


def test_cancel_cascades_to_dependents(client: TestClient) -> None:
    tasks = _create_pipeline(client, stages=["planner", "developer", "reviewer"])

    response = client.post(f"/agents/tasks/{tasks[0]['id']}/cancel")
    assert response.status_code == 204

    developer_task = client.get(f"/agents/tasks/{tasks[1]['id']}").json()
    reviewer_task = client.get(f"/agents/tasks/{tasks[2]['id']}").json()
    assert developer_task["status"] == "cancelled"
    assert reviewer_task["status"] == "cancelled"


def test_cancel_unknown_task_returns_404(client: TestClient) -> None:
    response = client.post("/agents/tasks/does-not-exist/cancel")
    assert response.status_code == 404


def test_retry_unknown_or_non_failed_task_returns_404(client: TestClient) -> None:
    tasks = _create_pipeline(client, stages=["planner"])  # still 'queued', not 'failed'

    response = client.post(f"/agents/tasks/{tasks[0]['id']}/retry")
    assert response.status_code == 404


def test_extract_proposed_files_parses_fenced_file_blocks() -> None:
    sample = (
        "Here is my change:\n\n"
        "```file:src/utils/hello.ts\n"
        'export function hello(): string {\n  return "hi";\n}\n'
        "```\n\nDone."
    )

    result = _extract_proposed_files(sample)

    expected_content = 'export function hello(): string {\n  return "hi";\n}\n'
    assert result == [{"path": "src/utils/hello.ts", "content": expected_content}]


def test_extract_proposed_files_returns_empty_list_when_none_present() -> None:
    assert _extract_proposed_files("Just a plain text response, no code blocks.") == []


@pytest.mark.skipif(not _ollama_available(), reason="Ollama is not running locally")
def test_real_two_stage_pipeline_runs_end_to_end(client: TestClient) -> None:
    """A genuine, non-mocked pipeline run: Planner produces a plan, then
    (only once it completes) Developer runs and receives that plan as
    context via the memory-backed handoff."""
    tasks = _create_pipeline(
        client,
        title="Add a hello-world helper",
        description="Describe how to add a function that returns 'hello world'.",
        stages=["planner", "developer"],
    )
    planner_id, developer_id = tasks[0]["id"], tasks[1]["id"]

    async def drive_to_completion() -> None:
        for _ in range(20):
            client.post("/agents/run-cycle", json={"api_keys": {}})
            developer = client.get(f"/agents/tasks/{developer_id}").json()
            if developer["status"] in ("completed", "failed"):
                return
            await asyncio.sleep(1)

    asyncio.run(drive_to_completion())

    planner = client.get(f"/agents/tasks/{planner_id}").json()
    developer = client.get(f"/agents/tasks/{developer_id}").json()

    assert planner["status"] == "completed"
    assert developer["status"] == "completed"
    assert planner["conversation_id"] is not None
    assert developer["conversation_id"] is not None

    # The handoff actually happened: the developer's conversation history
    # includes the planner's output as context, not just the raw task
    # description.
    developer_conversation_id = developer["conversation_id"]
    developer_messages = client.get(
        f"/ai/conversations/{developer_conversation_id}/messages"
    ).json()
    user_message = next(m for m in developer_messages if m["role"] == "user")
    assert "Context from the prior stage" in user_message["content"]
