from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest

from app.core.config import Settings, get_settings


@pytest.fixture(autouse=True)
def isolated_settings(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Settings]:
    """Point every test at an isolated tmp DB/log file instead of the
    real repo's database/ and logs/ folders, and reset the cached
    Settings singleton so each test sees its own env vars."""
    monkeypatch.setenv("NEMI_DB_PATH", str(tmp_path / "nemi.db"))
    monkeypatch.setenv("NEMI_LOG_FILE", str(tmp_path / "backend.log"))
    monkeypatch.setenv("NEMI_BACKEND_PORT", "8756")
    get_settings.cache_clear()
    try:
        yield get_settings()
    finally:
        get_settings.cache_clear()
