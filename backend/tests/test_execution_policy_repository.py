from __future__ import annotations

import sqlite3
from collections.abc import Iterator

import pytest

from app.core.config import Settings
from app.db.connection import get_connection
from app.db.repositories.execution_policy_repository import ExecutionPolicyRepository
from app.db.schema import init_db


@pytest.fixture
def connection(isolated_settings: Settings) -> Iterator[sqlite3.Connection]:
    with get_connection(isolated_settings) as conn:
        init_db(conn)
        yield conn


def test_get_returns_defaults_when_never_written(connection: sqlite3.Connection) -> None:
    policy = ExecutionPolicyRepository(connection).get()

    assert policy["mode"] == "auto"
    assert policy["subscription_first"] is True
    assert policy["updated_at"] is None


def test_upsert_creates_row_and_persists(connection: sqlite3.Connection) -> None:
    repo = ExecutionPolicyRepository(connection)

    updated = repo.upsert(mode="claude-code-cli", subscription_first=False)

    assert updated["mode"] == "claude-code-cli"
    assert updated["subscription_first"] is False
    assert updated["updated_at"] is not None
    assert repo.get() == updated


def test_upsert_partial_update_preserves_other_field(connection: sqlite3.Connection) -> None:
    repo = ExecutionPolicyRepository(connection)
    repo.upsert(mode="gemini-cli", subscription_first=False)

    updated = repo.upsert(subscription_first=True)

    assert updated["mode"] == "gemini-cli"
    assert updated["subscription_first"] is True
