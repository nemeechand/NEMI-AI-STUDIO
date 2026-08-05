from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

# backend/app/core/config.py -> parents[3] is the repository root
# (core -> app -> backend -> repo root), independent of the process cwd.
_REPO_ROOT = Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class Settings:
    env: str
    log_level: str
    host: str
    port: int
    db_path: Path
    log_file_path: Path


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        env=os.environ.get("NEMI_ENV", "development"),
        log_level=os.environ.get("NEMI_LOG_LEVEL", "INFO"),
        host=os.environ.get("NEMI_BACKEND_HOST", "127.0.0.1"),
        port=int(os.environ.get("NEMI_BACKEND_PORT", "8756")),
        db_path=Path(
            os.environ.get("NEMI_DB_PATH", str(_REPO_ROOT / "database" / "nemi.db"))
        ),
        log_file_path=Path(
            os.environ.get("NEMI_LOG_FILE", str(_REPO_ROOT / "logs" / "backend.log"))
        ),
    )
