from __future__ import annotations

import sqlite3
from datetime import UTC, datetime
from uuid import uuid4


class ModelFavoritesRepository:
    """Data access for the `model_favorites` table (Sprint 15.5's Model
    Manager "Mark Favorites")."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def list_for_provider(self, provider_id: str) -> list[str]:
        rows = self._connection.execute(
            "SELECT model_id FROM model_favorites WHERE provider_id = ? ORDER BY created_at",
            (provider_id,),
        ).fetchall()
        return [row["model_id"] for row in rows]

    def add(self, provider_id: str, model_id: str) -> None:
        self._connection.execute(
            """
            INSERT INTO model_favorites (id, provider_id, model_id, created_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(provider_id, model_id) DO NOTHING
            """,
            (str(uuid4()), provider_id, model_id, datetime.now(UTC).isoformat()),
        )
        self._connection.commit()

    def remove(self, provider_id: str, model_id: str) -> None:
        self._connection.execute(
            "DELETE FROM model_favorites WHERE provider_id = ? AND model_id = ?",
            (provider_id, model_id),
        )
        self._connection.commit()

    def list_all(self) -> dict[str, list[str]]:
        rows = self._connection.execute(
            "SELECT provider_id, model_id FROM model_favorites ORDER BY created_at"
        ).fetchall()
        result: dict[str, list[str]] = {}
        for row in rows:
            result.setdefault(row["provider_id"], []).append(row["model_id"])
        return result
