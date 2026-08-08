from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

# backend/app/core/config.py -> parents[3] is the repository root
# (core -> app -> backend -> repo root), independent of the process cwd.
_REPO_ROOT = Path(__file__).resolve().parents[3]


def _default_agents_dir() -> Path:
    """`agents/*.md` (Sprint 11) are read at runtime to build each AI
    agent's system prompt — unlike NEMI_DB_PATH/NEMI_LOG_FILE (Sprint 8),
    these are static bundled content, not per-user data, so they don't
    need an env var from Electron: the backend can self-detect whether
    it's a frozen PyInstaller build (`sys.frozen`) the same way it would
    for any bundled read-only resource. `nemi-backend.spec` copies
    `agents/` next to the built executable for exactly this lookup;
    dev mode reads the real repo-root `agents/` directly.
    """
    if getattr(sys, "frozen", False):
        return Path(sys.executable).parent / "agents"
    return _REPO_ROOT / "agents"


@dataclass(frozen=True)
class Settings:
    env: str
    log_level: str
    host: str
    port: int
    db_path: Path
    log_file_path: Path
    agents_dir: Path


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
        agents_dir=Path(os.environ.get("NEMI_AGENTS_DIR", str(_default_agents_dir()))),
    )
