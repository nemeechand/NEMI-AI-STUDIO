from __future__ import annotations

import sqlite3
from datetime import UTC, datetime
from typing import Any

_DEFAULT_ROW_KEYS = (
    "provider_id",
    "enabled",
    "base_url",
    "default_model",
    "last_used_model",
    "last_used_at",
    "last_connection_status",
    "last_connection_message",
    "last_connection_at",
    "created_at",
    "updated_at",
)


class ProviderSettingsRepository:
    """Data access for the `provider_settings` table (Sprint 15.5) — one
    row per provider id, created lazily on first write so a provider the
    user never touched simply doesn't have a row (all-defaults on read)."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def get(self, provider_id: str) -> dict[str, Any] | None:
        row = self._connection.execute(
            "SELECT * FROM provider_settings WHERE provider_id = ?", (provider_id,)
        ).fetchone()
        return dict(row) if row else None

    def list_all(self) -> list[dict[str, Any]]:
        rows = self._connection.execute(
            "SELECT * FROM provider_settings ORDER BY provider_id"
        ).fetchall()
        return [dict(row) for row in rows]

    def _ensure_row(self, provider_id: str) -> None:
        now = datetime.now(UTC).isoformat()
        self._connection.execute(
            """
            INSERT INTO provider_settings (provider_id, enabled, created_at, updated_at)
            VALUES (?, 1, ?, ?)
            ON CONFLICT(provider_id) DO NOTHING
            """,
            (provider_id, now, now),
        )

    def upsert(
        self,
        provider_id: str,
        *,
        enabled: bool | None = None,
        base_url: str | None = None,
        default_model: str | None = None,
    ) -> dict[str, Any]:
        self._ensure_row(provider_id)
        updates: list[str] = []
        params: list[Any] = []
        if enabled is not None:
            updates.append("enabled = ?")
            params.append(1 if enabled else 0)
        if base_url is not None:
            updates.append("base_url = ?")
            params.append(base_url or None)
        if default_model is not None:
            updates.append("default_model = ?")
            params.append(default_model or None)
        updates.append("updated_at = ?")
        now = datetime.now(UTC).isoformat()
        params.append(now)
        params.append(provider_id)
        self._connection.execute(
            f"UPDATE provider_settings SET {', '.join(updates)} WHERE provider_id = ?",
            params,
        )
        self._connection.commit()
        return self.get(provider_id)  # type: ignore[return-value]

    def record_connection_test(
        self, provider_id: str, *, ok: bool, message: str
    ) -> dict[str, Any]:
        self._ensure_row(provider_id)
        now = datetime.now(UTC).isoformat()
        self._connection.execute(
            """
            UPDATE provider_settings
            SET last_connection_status = ?, last_connection_message = ?, last_connection_at = ?,
                updated_at = ?
            WHERE provider_id = ?
            """,
            ("ok" if ok else "error", message, now, now, provider_id),
        )
        self._connection.commit()
        return self.get(provider_id)  # type: ignore[return-value]

    def record_used(self, provider_id: str, *, model: str) -> None:
        self._ensure_row(provider_id)
        now = datetime.now(UTC).isoformat()
        self._connection.execute(
            """
            UPDATE provider_settings
            SET last_used_model = ?, last_used_at = ?, updated_at = ?
            WHERE provider_id = ?
            """,
            (model, now, now, provider_id),
        )
        self._connection.commit()
