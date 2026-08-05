from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI

from app import __version__
from app.api.health import router as health_router
from app.api.logs import router as logs_router
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging, get_logger
from app.db.connection import get_connection
from app.db.repositories.logs_repository import LogsRepository
from app.db.schema import init_db


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings)
    logger = get_logger("startup")

    with get_connection(settings) as connection:
        init_db(connection)
        LogsRepository(connection).insert(
            level="INFO",
            source="backend.startup",
            message="Backend started and database initialized",
        )

    logger.info("NEMI backend ready on %s:%s", settings.host, settings.port)
    yield
    get_logger("shutdown").info("NEMI backend shutting down")


def create_app() -> FastAPI:
    app = FastAPI(title="NEMI AI STUDIO Backend", version=__version__, lifespan=_lifespan)
    app.include_router(health_router)
    app.include_router(logs_router)
    register_exception_handlers(app)
    return app


def run_server() -> None:
    settings = get_settings()
    uvicorn.run(create_app(), host=settings.host, port=settings.port, log_config=None)
