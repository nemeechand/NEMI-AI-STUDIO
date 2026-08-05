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
    connection.row_factory = sqlite3.Row
    try:
        yield connection
    finally:
        connection.close()
