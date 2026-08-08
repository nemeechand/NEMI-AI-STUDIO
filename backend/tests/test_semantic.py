from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from pathlib import Path

import pytest

from app.core.config import Settings
from app.db.connection import get_connection
from app.db.repositories.files_repository import FilesRepository
from app.db.schema import init_db
from app.knowledge.semantic import MAX_FILE_EMBED_CANDIDATES, gather_candidates


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


def test_gather_candidates_caps_file_count(tmp_path: Path, connection: sqlite3.Connection) -> None:
    files_repo = FilesRepository(connection)
    extra = MAX_FILE_EMBED_CANDIDATES + 10
    for i in range(extra):
        relative_path = f"file_{i:04d}.py"
        (tmp_path / relative_path).write_text(f"def f_{i}():\n    return {i}\n")
        files_repo.upsert(project_id="proj-a", relative_path=relative_path, language="python")

    candidates = gather_candidates(connection, project_id="proj-a", project_path=str(tmp_path))

    file_candidates = [c for c in candidates if c.entity_type == "file"]
    assert len(file_candidates) == MAX_FILE_EMBED_CANDIDATES


def test_gather_candidates_skips_unreadable_files(
    tmp_path: Path, connection: sqlite3.Connection
) -> None:
    FilesRepository(connection).upsert(
        project_id="proj-a", relative_path="missing.py", language="python"
    )

    candidates = gather_candidates(connection, project_id="proj-a", project_path=str(tmp_path))

    assert candidates == []
