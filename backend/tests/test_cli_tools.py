from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest

from app.ai.cli_tools import (
    CLI_TOOLS,
    CliToolStatus,
    detect_all,
    detect_cli_tool,
    is_available,
)


def _write_fake_binary(directory: Path, name: str) -> None:
    """A minimal, genuinely-on-PATH executable `shutil.which` can find —
    Windows resolves via PATHEXT (needs a recognized extension), POSIX via
    the executable bit."""
    if sys.platform == "win32":
        (directory / f"{name}.cmd").write_text("@echo 1.0.0\r\n")
    else:
        script = directory / name
        script.write_text("#!/bin/sh\necho '1.0.0'\n")
        script.chmod(0o755)


def test_detect_cli_tool_reports_not_installed_for_a_real_absent_binary() -> None:
    """A genuinely real result, not mocked: no binary named this exists on
    PATH on any machine running this test suite, so `installed` must be
    False and `authenticated`/`version` must not be fabricated as
    anything else."""
    status = detect_cli_tool("codex-cli")

    if status.installed:
        pytest.skip("codex CLI happens to be installed on this machine — nothing to assert here")
    assert status.installed is False
    assert status.binary_path is None
    assert status.version is None
    assert status.authenticated is None
    assert is_available(status) is False


def test_detect_cli_tool_finds_binary_on_path(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:  # type: ignore[no-untyped-def]
    """Real `shutil.which` PATH resolution, not a guess: a fake but real,
    executable file placed on PATH is genuinely found."""
    _write_fake_binary(tmp_path, "claude")
    monkeypatch.setenv("PATH", str(tmp_path))

    status = detect_cli_tool("claude-code-cli")

    assert status.installed is True
    assert status.binary_path is not None
    assert str(tmp_path) in status.binary_path


def test_detect_cli_tool_authenticated_true_when_credential_file_exists(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:  # type: ignore[no-untyped-def]
    fake_home = tmp_path / "home"
    (fake_home / ".claude").mkdir(parents=True)
    (fake_home / ".claude" / ".credentials.json").write_text('{"token": "fake"}')
    fake_binary_dir = tmp_path / "bin"
    fake_binary_dir.mkdir()
    _write_fake_binary(fake_binary_dir, "claude")
    monkeypatch.setenv("PATH", str(fake_binary_dir))
    monkeypatch.setattr("app.ai.cli_tools.Path.home", staticmethod(lambda: fake_home))

    status = detect_cli_tool("claude-code-cli")

    assert status.installed is True
    assert status.authenticated is True


def test_detect_cli_tool_authenticated_false_when_credential_file_absent(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:  # type: ignore[no-untyped-def]
    fake_home = tmp_path / "home"
    fake_home.mkdir()
    fake_binary_dir = tmp_path / "bin"
    fake_binary_dir.mkdir()
    _write_fake_binary(fake_binary_dir, "claude")
    monkeypatch.setenv("PATH", str(fake_binary_dir))
    monkeypatch.setattr("app.ai.cli_tools.Path.home", staticmethod(lambda: fake_home))

    status = detect_cli_tool("claude-code-cli")

    assert status.installed is True
    assert status.authenticated is False
    assert is_available(status) is False


def test_is_available_never_true_for_unknown_authentication() -> None:
    """'Do not fabricate availability': an installed tool whose auth state
    couldn't be confirmed (authenticated=None) must never be reported
    available — only a positively-confirmed True counts."""
    status = CliToolStatus(
        id="gemini-cli",
        display_name="Gemini CLI",
        installed=True,
        binary_path="/usr/bin/gemini",
        version="1.0.0",
        authenticated=None,
        roles=("developer",),
        role_note="",
    )
    assert is_available(status) is False


def test_detect_all_returns_one_status_per_registered_tool() -> None:
    statuses = asyncio.run(detect_all())
    assert {s.id for s in statuses} == set(CLI_TOOLS.keys())
    assert len(statuses) == 3
