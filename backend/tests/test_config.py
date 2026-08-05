from __future__ import annotations

import pytest

from app.core.config import get_settings


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
