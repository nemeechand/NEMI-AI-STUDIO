from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from pathlib import Path

import pytest

from app.core.config import Settings
from app.db.connection import get_connection
from app.db.repositories.files_repository import FilesRepository
from app.db.repositories.knowledge_repository import KnowledgeRepository
from app.db.schema import init_db
from app.knowledge.indexer import index_project


@pytest.fixture
def connection(isolated_settings: Settings) -> Iterator[sqlite3.Connection]:
    with get_connection(isolated_settings) as conn:
        init_db(conn)
        now = "2026-01-01T00:00:00+00:00"
        conn.execute(
            "INSERT INTO projects (id, name, path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            ("proj-a", "proj-a", "/tmp/proj-a", now, now),
        )
        conn.commit()
        yield conn


def _write_sample_project(tmp_path: Path) -> Path:
    root = tmp_path / "sample"
    (root / "app").mkdir(parents=True)
    (root / "node_modules" / "ignored-pkg").mkdir(parents=True)
    (root / "node_modules" / "ignored-pkg" / "index.js").write_text("module.exports = {};")

    (root / "app" / "__init__.py").write_text("")
    (root / "app" / "utils.py").write_text(
        "def helper():\n    return 1\n\nclass Helper:\n    pass\n"
    )
    (root / "app" / "main.py").write_text(
        "from app.utils import helper\n\ndef run():\n    return helper()\n"
    )
    return root


def test_index_project_creates_files_and_graph_nodes(
    tmp_path: Path, connection: sqlite3.Connection
) -> None:
    root = _write_sample_project(tmp_path)

    summary = index_project(connection, project_id="proj-a", project_path=str(root))

    assert summary.errors == []
    # 3 real python files indexed; node_modules is ignored entirely.
    files = FilesRepository(connection).list_for_project("proj-a")
    assert {f["relative_path"] for f in files} == {"app/__init__.py", "app/utils.py", "app/main.py"}
    assert all("node_modules" not in f["relative_path"] for f in files)

    graph_repo = KnowledgeRepository(connection)
    functions = graph_repo.list_nodes(project_id="proj-a", node_type="function")
    classes = graph_repo.list_nodes(project_id="proj-a", node_type="class")
    assert {f["label"] for f in functions} == {"app/utils.py::helper", "app/main.py::run"}
    assert {c["label"] for c in classes} == {"app/utils.py::Helper"}


def test_index_project_resolves_same_project_python_import(
    tmp_path: Path, connection: sqlite3.Connection
) -> None:
    root = _write_sample_project(tmp_path)

    index_project(connection, project_id="proj-a", project_path=str(root))

    graph_repo = KnowledgeRepository(connection)
    main_node = graph_repo.find_node(project_id="proj-a", node_type="file", label="app/main.py")
    utils_node = graph_repo.find_node(project_id="proj-a", node_type="file", label="app/utils.py")
    assert main_node is not None and utils_node is not None
    import_edges = graph_repo.edges_from(main_node["id"], relationship="imports")
    assert any(e["to_node_id"] == utils_node["id"] for e in import_edges)


def test_index_project_is_idempotent_and_removes_deleted_files(
    tmp_path: Path, connection: sqlite3.Connection
) -> None:
    root = _write_sample_project(tmp_path)
    index_project(connection, project_id="proj-a", project_path=str(root))

    (root / "app" / "utils.py").unlink()
    summary = index_project(connection, project_id="proj-a", project_path=str(root))

    assert summary.files_removed == 1
    files = FilesRepository(connection).list_for_project("proj-a")
    assert "app/utils.py" not in {f["relative_path"] for f in files}
    graph_repo = KnowledgeRepository(connection)
    assert graph_repo.find_node(project_id="proj-a", node_type="file", label="app/utils.py") is None


def test_index_project_records_commits_and_authors(
    tmp_path: Path, connection: sqlite3.Connection
) -> None:
    root = _write_sample_project(tmp_path)

    summary = index_project(
        connection,
        project_id="proj-a",
        project_path=str(root),
        commits=[
            {
                "hash": "abc123",
                "message": "Add helper",
                "author": "Jane Dev",
                "date": "2026-01-01",
                "files": ["app/utils.py"],
            }
        ],
    )

    assert summary.commits_indexed == 1
    graph_repo = KnowledgeRepository(connection)
    commit_node = graph_repo.find_node(project_id="proj-a", node_type="commit", label="abc123")
    author_node = graph_repo.find_node(project_id="proj-a", node_type="user", label="Jane Dev")
    assert commit_node is not None and author_node is not None
    authored_edges = graph_repo.edges_from(commit_node["id"], relationship="authored_by")
    assert any(e["to_node_id"] == author_node["id"] for e in authored_edges)
    utils_node = graph_repo.find_node(project_id="proj-a", node_type="file", label="app/utils.py")
    modifies_edges = graph_repo.edges_from(commit_node["id"], relationship="modifies")
    assert any(e["to_node_id"] == utils_node["id"] for e in modifies_edges)  # type: ignore[index]


def test_index_project_missing_path_reports_error_not_crash(connection: sqlite3.Connection) -> None:
    summary = index_project(connection, project_id="proj-a", project_path="/does/not/exist")

    assert summary.errors
    assert summary.files_indexed == 0
