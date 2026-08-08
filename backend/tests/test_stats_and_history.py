from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.ai.pricing import estimate_cost_usd
from app.core.config import Settings
from app.db.connection import get_connection
from app.db.repositories.agent_tasks_repository import AgentTasksRepository
from app.db.repositories.ai_conversations_repository import ConversationsRepository
from app.db.repositories.ai_messages_repository import MessagesRepository
from app.db.repositories.history_repository import HistoryRepository
from app.db.repositories.stats_repository import StatsRepository
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


# --- pricing -----------------------------------------------------------------


def test_estimate_cost_ollama_is_always_free() -> None:
    assert estimate_cost_usd("ollama", "qwen2.5:0.5b", 10_000, 5_000) == 0.0


def test_estimate_cost_known_model_computes_real_rate() -> None:
    cost = estimate_cost_usd("openai", "gpt-4o-mini", 1_000_000, 1_000_000)
    assert cost == pytest.approx(0.15 + 0.60)


def test_estimate_cost_unknown_model_returns_none() -> None:
    assert estimate_cost_usd("openai", "some-future-model", 100, 100) is None


# --- live_output ---------------------------------------------------------------


def test_update_live_output_round_trips(connection: sqlite3.Connection) -> None:
    repo = AgentTasksRepository(connection)
    task = repo.create(
        project_id=None,
        title="T",
        description="D",
        agent_role="planner",
        priority=2,
        depends_on_task_id=None,
        provider="ollama",
        model=OLLAMA_MODEL,
    )
    assert task["live_output"] is None

    repo.update_live_output(task["id"], "partial output so far...")

    assert repo.get(task["id"])["live_output"] == "partial output so far..."


def test_live_output_cleared_on_completion(connection: sqlite3.Connection) -> None:
    repo = AgentTasksRepository(connection)
    task = repo.create(
        project_id=None,
        title="T",
        description="D",
        agent_role="planner",
        priority=2,
        depends_on_task_id=None,
        provider="ollama",
        model=OLLAMA_MODEL,
    )
    repo.update_live_output(task["id"], "still thinking...")

    repo.mark_completed(
        task["id"], conversation_id=None, result_summary="done", proposed_files=None  # type: ignore[arg-type]
    )

    assert repo.get(task["id"])["live_output"] is None


def test_live_output_cleared_on_permanent_failure(connection: sqlite3.Connection) -> None:
    repo = AgentTasksRepository(connection)
    task = repo.create(
        project_id=None,
        title="T",
        description="D",
        agent_role="planner",
        priority=2,
        depends_on_task_id=None,
        provider="ollama",
        model=OLLAMA_MODEL,
        max_retries=0,
    )
    repo.update_live_output(task["id"], "partial...")

    status = repo.mark_failed_or_retry(task["id"], error_message="boom")

    assert status == "failed"
    assert repo.get(task["id"])["live_output"] is None


# --- history -------------------------------------------------------------------


def test_history_records_and_lists_newest_first(connection: sqlite3.Connection) -> None:
    repo = HistoryRepository(connection)
    repo.record(
        project_id=None,
        entity_type="workflow",
        entity_id="w1",
        action="created",
        snapshot={"title": "First"},
    )
    repo.record(
        project_id=None,
        entity_type="workflow",
        entity_id="w1",
        action="updated",
        snapshot={"status": "completed"},
    )

    entries = repo.list_recent(limit=10)

    assert len(entries) == 2
    assert entries[0]["snapshot"] == {"status": "completed"}
    assert entries[1]["snapshot"] == {"title": "First"}


def test_workflow_creation_and_completion_recorded_to_history(client: TestClient) -> None:
    response = client.post(
        "/workflows",
        json={
            "title": "T",
            "goal": "G",
            "provider": "ollama",
            "model": OLLAMA_MODEL,
        },
    )
    workflow_id = response.json()["id"]

    history = client.get("/history").json()
    created_events = [
        h for h in history if h["entity_id"] == workflow_id and h["action"] == "created"
    ]
    assert len(created_events) == 1
    assert created_events[0]["entity_type"] == "workflow"


# --- restart -------------------------------------------------------------------


def test_restart_workflow_requeues_failed_tasks_and_leaves_completed_alone(
    connection: sqlite3.Connection,
) -> None:
    workflows_repo = WorkflowsRepository(connection)
    workflow = workflows_repo.create(
        project_id=None,
        title="W",
        goal="G",
        provider="ollama",
        model=OLLAMA_MODEL,
        approval_mode="review",
    )
    tasks_repo = AgentTasksRepository(connection)
    completed_task = tasks_repo.create(
        project_id=None,
        title="Planner",
        description="D",
        agent_role="planner",
        priority=2,
        depends_on_task_id=None,
        provider="ollama",
        model=OLLAMA_MODEL,
        workflow_id=workflow["id"],
    )
    tasks_repo.mark_completed(
        completed_task["id"],
        conversation_id=None,  # type: ignore[arg-type]
        result_summary="ok",
        proposed_files=None,
    )
    failed_task = tasks_repo.create(
        project_id=None,
        title="Developer",
        description="D",
        agent_role="developer",
        priority=2,
        depends_on_task_id=completed_task["id"],
        provider="ollama",
        model=OLLAMA_MODEL,
        workflow_id=workflow["id"],
    )
    tasks_repo.mark_failed_or_retry(failed_task["id"], error_message="boom")
    tasks_repo.mark_failed_or_retry(failed_task["id"], error_message="boom")
    tasks_repo.mark_failed_or_retry(failed_task["id"], error_message="boom")
    assert tasks_repo.get(failed_task["id"])["status"] == "failed"
    workflows_repo.set_status(workflow["id"], "failed")

    reset_ids = tasks_repo.reset_tasks_for_workflow(workflow["id"])

    assert reset_ids == [failed_task["id"]]
    refreshed_failed = tasks_repo.get(failed_task["id"])
    assert refreshed_failed["status"] == "queued"
    assert refreshed_failed["retry_count"] == 0
    assert tasks_repo.get(completed_task["id"])["status"] == "completed"


def test_restart_workflow_via_api(client: TestClient) -> None:
    created = client.post(
        "/workflows",
        json={"title": "T", "goal": "G", "provider": "ollama", "model": OLLAMA_MODEL},
    ).json()
    # Not failed/cancelled yet — restart should be rejected.
    assert client.post(f"/workflows/{created['id']}/restart").status_code == 404

    client.post(f"/workflows/{created['id']}/cancel")
    response = client.post(f"/workflows/{created['id']}/restart")

    assert response.status_code == 200
    assert response.json()["status"] == "queued"


# --- stats ---------------------------------------------------------------------


def test_performance_stats_empty_project_returns_nulls_not_zeros(client: TestClient) -> None:
    response = client.get("/stats/performance")
    body = response.json()

    assert body["total_tasks"] == 0
    assert body["success_rate"] is None
    assert body["failure_rate"] is None


def test_performance_stats_computes_real_success_and_failure_rate(
    connection: sqlite3.Connection,
) -> None:
    repo = AgentTasksRepository(connection)
    completed = repo.create(
        project_id=None,
        title="ok",
        description="D",
        agent_role="planner",
        priority=2,
        depends_on_task_id=None,
        provider="ollama",
        model=OLLAMA_MODEL,
        max_retries=0,
    )
    repo.mark_running(completed["id"])
    repo.mark_completed(
        completed["id"], conversation_id=None, result_summary="ok", proposed_files=None  # type: ignore[arg-type]
    )
    failed = repo.create(
        project_id=None,
        title="bad",
        description="D",
        agent_role="developer",
        priority=2,
        depends_on_task_id=None,
        provider="ollama",
        model=OLLAMA_MODEL,
        max_retries=0,
    )
    repo.mark_running(failed["id"])
    repo.mark_failed_or_retry(failed["id"], error_message="boom")

    stats = StatsRepository(connection).performance_summary()

    assert stats["total_tasks"] == 2
    assert stats["completed_tasks"] == 1
    assert stats["failed_tasks"] == 1
    assert stats["success_rate"] == pytest.approx(0.5)
    assert stats["failure_rate"] == pytest.approx(0.5)
    assert stats["avg_task_seconds"] is not None
    assert stats["avg_task_seconds"] >= 0


def test_token_stats_sums_real_message_tokens_by_provider(
    connection: sqlite3.Connection,
) -> None:
    conversation = ConversationsRepository(connection).create(
        project_id=None, title="C", provider="openai", model="gpt-4o-mini"
    )
    MessagesRepository(connection).add_assistant_message(
        conversation_id=conversation["id"],
        content="hi",
        provider="openai",
        model="gpt-4o-mini",
        status="complete",
        prompt_tokens=1000,
        completion_tokens=500,
    )

    since = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    summary = StatsRepository(connection).token_summary(since=since)

    assert summary["total_prompt_tokens"] == 1000
    assert summary["total_completion_tokens"] == 500
    assert summary["by_provider"]["openai"]["prompt_tokens"] == 1000
    assert summary["total_estimated_cost_usd"] == pytest.approx(
        (1000 / 1_000_000) * 0.15 + (500 / 1_000_000) * 0.60
    )


def test_token_stats_api_returns_session_day_month_windows(client: TestClient) -> None:
    response = client.get("/stats/tokens")

    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"session", "day", "month"}
    for window in body.values():
        assert window["total_prompt_tokens"] == 0
