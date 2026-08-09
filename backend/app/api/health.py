from __future__ import annotations

import asyncio
import platform
import signal
import sqlite3
import time
from typing import Any

import httpx
from fastapi import APIRouter

from app import __version__
from app.ai.providers.ollama_provider import is_ollama_installed, is_server_running, resolve_host
from app.core.config import get_settings
from app.db.connection import get_connection
from app.db.repositories.provider_settings_repository import ProviderSettingsRepository
from app.db.repositories.stats_repository import StatsRepository

router = APIRouter()

_START_TIME = time.monotonic()
_INTERNET_CHECK_TIMEOUT_SECONDS = 2.0
_INTERNET_CHECK_URL = "https://www.google.com/generate_204"

# Sprint 15.6: keeps the shutdown-delay task alive until it actually runs —
# `asyncio.create_task()` with no other reference is eligible for garbage
# collection mid-flight (a documented asyncio pitfall), which would
# silently drop the graceful-shutdown signal.
_background_tasks: set[asyncio.Task[None]] = set()


@router.get("/health")
def health() -> dict[str, Any]:
    settings = get_settings()
    return {
        "status": "ok",
        "version": __version__,
        "env": settings.env,
        "uptime_seconds": round(time.monotonic() - _START_TIME, 3),
    }


def _check_database() -> dict[str, Any]:
    """A real query, not just "the file exists" — proves the connection,
    schema, and file are all actually usable right now, the same signal
    every other endpoint's first `get_connection()` call depends on."""
    settings = get_settings()
    try:
        with get_connection(settings) as connection:
            connection.execute("SELECT 1").fetchone()
        size_bytes = settings.db_path.stat().st_size if settings.db_path.exists() else None
        return {
            "ok": True,
            "path": str(settings.db_path),
            "size_bytes": size_bytes,
            "message": None,
        }
    except sqlite3.Error as exc:
        return {
            "ok": False,
            "path": str(settings.db_path),
            "size_bytes": None,
            "message": str(exc),
        }


async def _check_internet() -> dict[str, Any]:
    """A real, cheap outbound request with a short timeout — reports
    connectivity, never bandwidth (this app has no honest way to measure
    throughput), and never raises: any failure (offline, DNS, firewall)
    is reported as `ok: False`, not an exception."""
    try:
        async with httpx.AsyncClient(timeout=_INTERNET_CHECK_TIMEOUT_SECONDS) as client:
            response = await client.head(_INTERNET_CHECK_URL)
            return {"ok": response.status_code < 500, "message": None}
    except httpx.HTTPError as exc:
        return {"ok": False, "message": str(exc)}


async def _check_ollama() -> dict[str, Any]:
    host = resolve_host(None)
    # Sprint 15.6: reuses the exact same real detection functions
    # `/providers/ollama/status` already calls (app/ai/providers/
    # ollama_provider.py) — the Health Center reports installed/running
    # only, not the full model list, which stays the Settings panel's job.
    installed = is_ollama_installed()
    server_running = await is_server_running(None)
    return {"installed": installed, "server_running": server_running, "host": host}


def _check_providers() -> dict[str, Any]:
    """Reuses the exact same repositories `/providers/dashboard` already
    aggregates (ProviderSettingsRepository, StatsRepository) — no new
    counting logic, just a smaller summary shape for an at-a-glance
    health signal."""
    settings = get_settings()
    with get_connection(settings) as connection:
        settings_rows = ProviderSettingsRepository(connection).list_all()
        usage = StatsRepository(connection).provider_dashboard()
    total = 7  # the registered provider count — see app/ai/registry.py
    connected = sum(1 for row in settings_rows if row["last_connection_status"] == "ok")
    errors_total = sum(bucket["errors"] for bucket in usage.values())
    requests_total = sum(bucket["requests"] for bucket in usage.values())
    return {
        "total": total,
        "connected": connected,
        "errors_total": errors_total,
        "requests_total": requests_total,
    }


@router.post("/shutdown")
async def shutdown() -> dict[str, str]:
    """Sprint 15.6: lets Electron request a real graceful stop instead of
    the abrupt TerminateProcess-equivalent kill `stopBackend()` previously
    used unconditionally on every quit — see frontend/electron/
    backend-process.ts. Responds first, then delivers a real SIGINT to
    this same process — the exact signal uvicorn's own graceful-shutdown
    handler already listens for, so the FastAPI lifespan's shutdown code
    (previously dead code in practice — TerminateProcess never let it
    run) finally executes."""

    async def _raise_sigint_shortly() -> None:
        await asyncio.sleep(0.05)
        signal.raise_signal(signal.SIGINT)

    task = asyncio.create_task(_raise_sigint_shortly())
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)
    return {"status": "shutting down"}


@router.get("/health/full")
async def health_full() -> dict[str, Any]:
    """Sprint 15.6's Health Center backend aggregation: real backend
    status plus every real, backend-owned health signal (database,
    Python runtime, AI providers, Ollama, internet) in one call. Git,
    workspace, build, and system resource metrics are genuinely
    Electron/renderer-owned concepts (the backend has no notion of
    "the currently open project" or the host's CPU/memory/disk) and are
    combined with this response client-side by the Health Center panel,
    reusing the same IPC calls the rest of the app already makes —
    never duplicated here.
    """
    settings = get_settings()
    database = _check_database()
    internet = await _check_internet()
    return {
        "status": "ok" if database["ok"] else "degraded",
        "version": __version__,
        "env": settings.env,
        "uptime_seconds": round(time.monotonic() - _START_TIME, 3),
        "python": {
            "version": platform.python_version(),
            "implementation": platform.python_implementation(),
        },
        "database": database,
        "providers": _check_providers(),
        "ollama": await _check_ollama(),
        "internet": internet,
    }
