from __future__ import annotations

import pytest

from app.main import main


def test_main_runs_server_and_returns_zero(monkeypatch: pytest.MonkeyPatch) -> None:
    called = False

    def fake_run_server() -> None:
        nonlocal called
        called = True

    monkeypatch.setattr("app.main.run_server", fake_run_server)

    assert main() == 0
    assert called


def test_main_returns_zero_on_keyboard_interrupt(monkeypatch: pytest.MonkeyPatch) -> None:
    def raise_keyboard_interrupt() -> None:
        raise KeyboardInterrupt

    monkeypatch.setattr("app.main.run_server", raise_keyboard_interrupt)

    assert main() == 0
