from __future__ import annotations

import sqlite3
from collections.abc import Iterator

import pytest

from app.ai.orchestration.manager import (
    _handle_failure,
    _record_knowledge_for_workflow,
    _record_sprint_summary_memory,
    _related_past_experience,
)
from app.core.config import Settings
from app.db.connection import get_connection
from app.db.repositories.agent_tasks_repository import AgentTasksRepository
from app.db.repositories.knowledge_repository import KnowledgeRepository
from app.db.repositories.memory_repository import MemoryRepository
from app.db.repositories.workflows_repository import WorkflowsRepository
from app.db.schema import init_db


@pytest.fixture
def connection(isolated_settings: Settings) -> Iterator[sqlite3.Connection]:
    with get_connection(isolated_settings) as conn:
        init_db(conn)
        yield conn


def test_related_past_experience_ranks_by_word_overlap(connection: sqlite3.Connection) -> None:
    memory_repo = MemoryRepository(connection)
    memory_repo.remember(
        project_id=None, type="long_term", key="sprint:1",
        value="Sprint 'Build authentication system' completed. Goal: add login and signup.",
    )
    memory_repo.remember(
        project_id=None, type="long_term", key="sprint:2",
        value="Sprint 'Build a todo list' completed. Goal: add tasks with due dates.",
    )

    experience = _related_past_experience(connection, "Add a new login and signup flow")

    assert experience
    assert "authentication" in experience[0].lower()


def test_related_past_experience_returns_empty_when_nothing_relevant(
    connection: sqlite3.Connection,
) -> None:
    assert _related_past_experience(connection, "Do something entirely unrelated") == []


def test_record_knowledge_for_workflow_creates_graph_nodes(connection: sqlite3.Connection) -> None:
    now = "2026-01-01T00:00:00+00:00"
    connection.execute(
        "INSERT INTO projects (id, name, path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        ("proj-a", "proj-a", "/tmp/proj-a", now, now),
    )
    connection.commit()
    workflow = WorkflowsRepository(connection).create(
        project_id="proj-a", title="Build a thing", goal="Make it work",
        provider="ollama", model="qwen2.5:0.5b", approval_mode="review",
    )

    _record_knowledge_for_workflow(connection, workflow)

    graph_repo = KnowledgeRepository(connection)
    workflow_node = graph_repo.find_node_by_ref(
        project_id="proj-a", node_type="workflow", ref_id=workflow["id"]
    )
    assert workflow_node is not None
    requirement_edges = graph_repo.edges_from(workflow_node["id"], relationship="implements")
    assert len(requirement_edges) == 1
    agent_edges = graph_repo.edges_from(workflow_node["id"], relationship="executed_by")
    assert {graph_repo.get_node(e["to_node_id"])["label"] for e in agent_edges} == {
        "planner", "developer", "reviewer", "tester",
    }


def test_record_sprint_summary_memory_writes_long_term_entry(
    connection: sqlite3.Connection,
) -> None:
    workflow = {
        "id": "wf-1", "project_id": None, "title": "Build a thing", "goal": "Make it work",
    }
    milestones = [{"title": "Milestone A"}]
    tasks = [{"id": "t1"}, {"id": "t2"}]

    _record_sprint_summary_memory(connection, workflow, milestones, tasks)

    value = MemoryRepository(connection).recall(
        project_id=None, type="long_term", key="sprint:wf-1"
    )
    assert value is not None
    assert "Milestone A" in value
    assert "Tasks completed: 2" in value


def test_handle_failure_records_bug_memory_on_permanent_failure(
    isolated_settings: Settings, connection: sqlite3.Connection
) -> None:
    tasks_repo = AgentTasksRepository(connection)
    task = tasks_repo.create(
        project_id=None, title="Flaky task", description="D", agent_role="developer",
        priority=2, depends_on_task_id=None, provider="ollama", model="qwen2.5:0.5b",
        max_retries=0,
    )
    tasks_repo.mark_running(task["id"])
    connection.commit()

    _handle_failure(isolated_settings, task["id"], "Simulated provider failure")

    assert tasks_repo.get(task["id"])["status"] == "failed"
    entries = MemoryRepository(connection).list_by_type(project_id=None, type="knowledge")
    bug_entries = [e for e in entries if e["key"] == f"bug:{task['id']}"]
    assert len(bug_entries) == 1
    assert "Simulated provider failure" in bug_entries[0]["value"]
