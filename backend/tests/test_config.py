from __future__ import annotations

import sys

import pytest

from app.core.config import _REPO_ROOT, _default_agents_dir, get_settings


def test_settings_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("NEMI_ENV", raising=False)
    monkeypatch.delenv("NEMI_LOG_LEVEL", raising=False)
    monkeypatch.delenv("NEMI_BACKEND_HOST", raising=False)
    get_settings.cache_clear()

    settings = get_settings()

    assert settings.env == "development"
    assert settings.log_level == "INFO"
    assert settings.host == "127.0.0.1"

    get_settings.cache_clear()


def test_settings_reads_env_overrides(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("NEMI_ENV", "production")
    monkeypatch.setenv("NEMI_BACKEND_PORT", "9999")
    get_settings.cache_clear()

    settings = get_settings()

    assert settings.env == "production"
    assert settings.port == 9999

    get_settings.cache_clear()


def test_default_agents_dir_uses_meipass_when_frozen(monkeypatch: pytest.MonkeyPatch) -> None:
    """Sprint 15.7's Alpha build verification found this live: PyInstaller
    6's onedir builds place bundled `datas` (including `agents/`) inside
    a `_internal/` contents directory, not next to the executable —
    `sys._MEIPASS` is PyInstaller's own documented, layout-independent
    way to find it, and must be used instead of guessing the executable's
    own parent directory."""
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(sys, "_MEIPASS", r"C:\fake\dist\nemi-backend\_internal", raising=False)

    result = _default_agents_dir()

    assert str(result) == r"C:\fake\dist\nemi-backend\_internal\agents"


def test_default_agents_dir_falls_back_to_executable_dir_without_meipass(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.delattr(sys, "_MEIPASS", raising=False)
    monkeypatch.setattr(sys, "executable", r"C:\fake\dist\nemi-backend\nemi-backend.exe")

    result = _default_agents_dir()

    assert str(result) == r"C:\fake\dist\nemi-backend\agents"


def test_default_agents_dir_uses_repo_root_when_not_frozen(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(sys, "frozen", False, raising=False)

    result = _default_agents_dir()

    assert result == _REPO_ROOT / "agents"
