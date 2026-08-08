from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from typing import Any

import pytest

from app.core.config import Settings
from app.db.connection import get_connection
from app.db.repositories.knowledge_repository import KnowledgeRepository
from app.db.schema import init_db

PROJECT_ID = "proj-a"


@pytest.fixture
def connection(isolated_settings: Settings) -> Iterator[sqlite3.Connection]:
    with get_connection(isolated_settings) as conn:
        init_db(conn)
        # graph_nodes.project_id is a real FK into `projects` — insert a
        # genuine row rather than an arbitrary string (same lesson as
        # Sprint 10's ai_conversations test).
        now = "2026-01-01T00:00:00+00:00"
        conn.execute(
            "INSERT INTO projects (id, name, path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (PROJECT_ID, PROJECT_ID, "/tmp/proj-a", now, now),
        )
        conn.commit()
        yield conn


def _import_edge(repo: KnowledgeRepository, a: dict[str, Any], b: dict[str, Any]) -> dict[str, Any]:
    return repo.add_edge(
        project_id=PROJECT_ID, from_node_id=a["id"], to_node_id=b["id"], relationship="imports"
    )


def test_upsert_node_is_idempotent(connection: sqlite3.Connection) -> None:
    repo = KnowledgeRepository(connection)

    first = repo.upsert_node(project_id=PROJECT_ID, node_type="file", label="src/main.py")
    second = repo.upsert_node(project_id=PROJECT_ID, node_type="file", label="src/main.py")

    assert first["id"] == second["id"]
    assert len(repo.list_nodes(project_id=PROJECT_ID, node_type="file")) == 1


def test_add_edge_is_idempotent(connection: sqlite3.Connection) -> None:
    repo = KnowledgeRepository(connection)
    a = repo.upsert_node(project_id=PROJECT_ID, node_type="file", label="a.py")
    b = repo.upsert_node(project_id=PROJECT_ID, node_type="file", label="b.py")

    e1 = _import_edge(repo, a, b)
    e2 = _import_edge(repo, a, b)

    assert e1["id"] == e2["id"]
    assert len(repo.list_edges(project_id=PROJECT_ID)) == 1


def test_edges_to_finds_reverse_dependents(connection: sqlite3.Connection) -> None:
    repo = KnowledgeRepository(connection)
    a = repo.upsert_node(project_id=PROJECT_ID, node_type="file", label="a.py")
    b = repo.upsert_node(project_id=PROJECT_ID, node_type="file", label="b.py")
    _import_edge(repo, a, b)

    dependents = repo.edges_to(b["id"], relationship="imports")

    assert len(dependents) == 1
    assert dependents[0]["from_node_id"] == a["id"]


def test_stats_counts_by_node_type(connection: sqlite3.Connection) -> None:
    repo = KnowledgeRepository(connection)
    repo.upsert_node(project_id=PROJECT_ID, node_type="file", label="a.py")
    repo.upsert_node(project_id=PROJECT_ID, node_type="file", label="b.py")
    repo.upsert_node(project_id=PROJECT_ID, node_type="function", label="a.py::foo")

    stats = repo.stats(PROJECT_ID)

    assert stats["nodes_by_type"] == {"file": 2, "function": 1}
    assert stats["total_nodes"] == 3


def test_delete_nodes_not_in_removes_stale_files_and_their_edges(
    connection: sqlite3.Connection,
) -> None:
    repo = KnowledgeRepository(connection)
    a = repo.upsert_node(project_id=PROJECT_ID, node_type="file", label="a.py")
    b = repo.upsert_node(project_id=PROJECT_ID, node_type="file", label="b.py")
    _import_edge(repo, a, b)

    removed = repo.delete_nodes_not_in(project_id=PROJECT_ID, node_type="file", labels={"a.py"})

    assert removed == 1
    remaining = repo.list_nodes(project_id=PROJECT_ID, node_type="file")
    assert [n["label"] for n in remaining] == ["a.py"]
    assert repo.list_edges(project_id=PROJECT_ID) == []


def test_find_node_by_ref(connection: sqlite3.Connection) -> None:
    repo = KnowledgeRepository(connection)
    repo.upsert_node(
        project_id=PROJECT_ID, node_type="workflow", label="Build a thing", ref_id="wf-1"
    )

    found = repo.find_node_by_ref(project_id=PROJECT_ID, node_type="workflow", ref_id="wf-1")

    assert found is not None
    assert found["label"] == "Build a thing"
