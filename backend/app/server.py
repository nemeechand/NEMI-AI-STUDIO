from __future__ import annotations

import asyncio
import logging
import sqlite3
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI

from app import __version__
from app.api.agents import router as agents_router
from app.api.ai import router as ai_router
from app.api.health import router as health_router
from app.api.knowledge import router as knowledge_router
from app.api.logs import router as logs_router
from app.api.projects import router as projects_router
from app.api.providers import router as providers_router
from app.api.stats import router as stats_router
from app.api.workflows import router as workflows_router
from app.core.config import Settings, get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging, get_logger
from app.db.connection import get_connection
from app.db.repositories.agent_tasks_repository import AgentTasksRepository
from app.db.repositories.agents_repository import AgentsRepository
from app.db.repositories.logs_repository import LogsRepository
from app.db.schema import init_db

# Sprint 15.6: a locked database at startup (another process still
# closing, an antivirus scan holding a file handle, a previous instance
# not fully exited yet — see the single-instance-lock fix in
# frontend/electron/main.ts) is a real, transient condition, not
# corruption. A short bounded retry gives that window a chance to clear
# instead of crashing the whole backend process on the very first
# request. A DB that is still locked (or genuinely corrupted) after
# every attempt still fails loudly — this is recovery from a transient
# condition, never a way to silently hide a real problem.
_STARTUP_DB_RETRY_ATTEMPTS = 5
_STARTUP_DB_RETRY_DELAY_SECONDS = 1.0


async def _init_db_with_retry(settings: Settings, logger: logging.Logger) -> None:
    for attempt in range(1, _STARTUP_DB_RETRY_ATTEMPTS + 1):
        try:
            with get_connection(settings) as connection:
                init_db(connection)
                AgentsRepository(connection).seed_from_role_files(settings.agents_dir)
                # Sprint 12's "Auto Resume after restart": any task still
                # marked 'running' can only be a leftover from a previous
                # process that died mid-execution — there's no live call
                # to finish it.
                requeued = AgentTasksRepository(connection).requeue_orphaned_running_tasks()
                if requeued:
                    logger.info(
                        "Requeued %d orphaned running agent task(s) on startup", len(requeued)
                    )
                LogsRepository(connection).insert(
                    level="INFO",
                    source="backend.startup",
                    message="Backend started and database initialized",
                )
            return
        except sqlite3.OperationalError as exc:
            if attempt == _STARTUP_DB_RETRY_ATTEMPTS:
                logger.error(
                    "Database unavailable after %d attempts, giving up: %s",
                    _STARTUP_DB_RETRY_ATTEMPTS,
                    exc,
                )
                raise
            logger.warning(
                "Database unavailable on startup (attempt %d/%d): %s — retrying in %.0fs",
                attempt,
                _STARTUP_DB_RETRY_ATTEMPTS,
                exc,
                _STARTUP_DB_RETRY_DELAY_SECONDS,
            )
            await asyncio.sleep(_STARTUP_DB_RETRY_DELAY_SECONDS)


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings)
    logger = get_logger("startup")

    await _init_db_with_retry(settings, logger)

    logger.info("NEMI backend ready on %s:%s", settings.host, settings.port)
    yield
    get_logger("shutdown").info("NEMI backend shutting down")


def create_app() -> FastAPI:
    app = FastAPI(title="NEMI AI STUDIO Backend", version=__version__, lifespan=_lifespan)
    app.include_router(health_router)
    app.include_router(logs_router)
    app.include_router(projects_router)
    app.include_router(ai_router)
    app.include_router(agents_router)
    app.include_router(workflows_router)
    app.include_router(stats_router)
    app.include_router(knowledge_router)
    app.include_router(providers_router)
    register_exception_handlers(app)
    return app


def run_server() -> None:
    settings = get_settings()
    uvicorn.run(create_app(), host=settings.host, port=settings.port, log_config=None)
