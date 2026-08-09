from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager

from app.core.config import Settings, get_settings


@contextmanager
def get_connection(settings: Settings | None = None) -> Iterator[sqlite3.Connection]:
    """Open a SQLite connection with foreign keys enforced and row access by name.

    Callers own the transaction: commit explicitly after writes.
    """
    resolved_settings = settings or get_settings()
    resolved_settings.db_path.parent.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(resolved_settings.db_path)
    connection.execute("PRAGMA foreign_keys = ON")
    # Sprint 15.6: this app opens one short-lived connection per request
    # rather than sharing a pool, so brief overlaps (the 4s agent-cycle
    # poll landing mid-write, two IPC calls racing) are expected, not a
    # bug — but SQLite's default busy behavior is to fail immediately
    # with "database is locked" instead of waiting. WAL mode lets reads
    # proceed concurrently with a writer, and a real (if short) busy
    # timeout gives a genuinely concurrent write a chance to complete
    # instead of surfacing as an error the caller has no way to recover
    # from.
    connection.execute("PRAGMA journal_mode = WAL")
    connection.execute("PRAGMA busy_timeout = 5000")
    connection.row_factory = sqlite3.Row
    try:
        yield connection
    finally:
        connection.close()
