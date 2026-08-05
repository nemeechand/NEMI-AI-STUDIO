from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter

from app import __version__
from app.core.config import get_settings

router = APIRouter()

_START_TIME = time.monotonic()


@router.get("/health")
def health() -> dict[str, Any]:
    settings = get_settings()
    return {
        "status": "ok",
        "version": __version__,
        "env": settings.env,
        "uptime_seconds": round(time.monotonic() - _START_TIME, 3),
    }
