from __future__ import annotations

from app.ai.cli_tools import CliToolStatus
from app.ai.orchestration.task_router import resolve_execution


def _status(tool_id: str, *, installed: bool, authenticated: bool | None) -> CliToolStatus:
    return CliToolStatus(
        id=tool_id,  # type: ignore[arg-type]
        display_name=tool_id,
        installed=installed,
        binary_path="/usr/bin/x" if installed else None,
        version="1.0.0" if installed else None,
        authenticated=authenticated,
        roles=("developer",),
        role_note="",
    )


ALL_UNAVAILABLE = {
    "codex-cli": _status("codex-cli", installed=False, authenticated=None),
    "claude-code-cli": _status("claude-code-cli", installed=False, authenticated=None),
    "gemini-cli": _status("gemini-cli", installed=False, authenticated=None),
}


def test_explicit_mode_uses_that_tool_when_available() -> None:
    statuses = {
        **ALL_UNAVAILABLE,
        "claude-code-cli": _status("claude-code-cli", installed=True, authenticated=True),
    }
    decision = resolve_execution(
        role="developer",
        mode="claude-code-cli",
        subscription_first=True,
        cli_statuses=statuses,
        api_provider_configured=True,
        api_provider_id="openai",
        api_provider_display_name="OpenAI",
    )
    assert decision.available is True
    assert decision.backend == "cli"
    assert decision.execution_id == "claude-code-cli"
    assert decision.fallback_used is False


def test_explicit_mode_reports_unavailable_without_silently_switching() -> None:
    """An explicit choice ('Code with Claude') must never silently redirect
    to a different tool or the API provider when Claude isn't available —
    per the sprint's 'do not silently switch' rule."""
    decision = resolve_execution(
        role="developer",
        mode="claude-code-cli",
        subscription_first=True,
        cli_statuses=ALL_UNAVAILABLE,
        api_provider_configured=True,
        api_provider_id="openai",
        api_provider_display_name="OpenAI",
    )
    assert decision.available is False
    assert decision.backend is None
    assert decision.execution_id is None
    assert decision.fallback_used is False
    assert "not installed" in decision.reason.lower()


def test_explicit_mode_installed_but_not_authenticated_gives_specific_reason() -> None:
    statuses = {
        **ALL_UNAVAILABLE,
        "gemini-cli": _status("gemini-cli", installed=True, authenticated=False),
    }
    decision = resolve_execution(
        role="developer",
        mode="gemini-cli",
        subscription_first=True,
        cli_statuses=statuses,
        api_provider_configured=False,
        api_provider_id=None,
        api_provider_display_name=None,
    )
    assert decision.available is False
    assert "not authenticated" in decision.reason.lower()


def test_auto_mode_picks_role_priority_order_first_available() -> None:
    # developer's priority order is claude-code-cli, gemini-cli, codex-cli —
    # claude unavailable, gemini available: gemini must win, not codex.
    statuses = {
        "codex-cli": _status("codex-cli", installed=True, authenticated=True),
        "claude-code-cli": _status("claude-code-cli", installed=False, authenticated=None),
        "gemini-cli": _status("gemini-cli", installed=True, authenticated=True),
    }
    decision = resolve_execution(
        role="developer",
        mode="auto",
        subscription_first=True,
        cli_statuses=statuses,
        api_provider_configured=True,
        api_provider_id="openai",
        api_provider_display_name="OpenAI",
    )
    assert decision.available is True
    assert decision.backend == "cli"
    assert decision.execution_id == "gemini-cli"
    assert decision.fallback_used is False


def test_auto_mode_subscription_first_falls_back_to_api_when_no_cli_available() -> None:
    decision = resolve_execution(
        role="developer",
        mode="auto",
        subscription_first=True,
        cli_statuses=ALL_UNAVAILABLE,
        api_provider_configured=True,
        api_provider_id="anthropic",
        api_provider_display_name="Claude (Anthropic)",
    )
    assert decision.available is True
    assert decision.backend == "api"
    assert decision.execution_id == "anthropic"
    assert decision.fallback_used is True
    assert "paid api" in decision.reason.lower()


def test_auto_mode_subscription_first_with_no_cli_and_no_api_is_honestly_unavailable() -> None:
    decision = resolve_execution(
        role="developer",
        mode="auto",
        subscription_first=True,
        cli_statuses=ALL_UNAVAILABLE,
        api_provider_configured=False,
        api_provider_id=None,
        api_provider_display_name=None,
    )
    assert decision.available is False
    assert decision.backend is None
    assert decision.fallback_used is False


def test_auto_mode_without_subscription_first_prefers_api_even_when_cli_available() -> None:
    statuses = {
        **ALL_UNAVAILABLE,
        "claude-code-cli": _status("claude-code-cli", installed=True, authenticated=True),
    }
    decision = resolve_execution(
        role="developer",
        mode="auto",
        subscription_first=False,
        cli_statuses=statuses,
        api_provider_configured=True,
        api_provider_id="openai",
        api_provider_display_name="OpenAI",
    )
    assert decision.available is True
    assert decision.backend == "api"
    assert decision.execution_id == "openai"
    # This is the user's own explicit policy choice, not a silent default —
    # fallback_used should read False since nothing was "fallen back to".
    assert decision.fallback_used is False


def test_auto_mode_without_subscription_first_uses_cli_when_no_api_configured() -> None:
    statuses = {
        **ALL_UNAVAILABLE,
        "codex-cli": _status("codex-cli", installed=True, authenticated=True),
    }
    decision = resolve_execution(
        role="reviewer",
        mode="auto",
        subscription_first=False,
        cli_statuses=statuses,
        api_provider_configured=False,
        api_provider_id=None,
        api_provider_display_name=None,
    )
    assert decision.available is True
    assert decision.backend == "cli"
    assert decision.execution_id == "codex-cli"


def test_planner_role_priority_prefers_codex_over_claude() -> None:
    statuses = {
        "codex-cli": _status("codex-cli", installed=True, authenticated=True),
        "claude-code-cli": _status("claude-code-cli", installed=True, authenticated=True),
        "gemini-cli": _status("gemini-cli", installed=False, authenticated=None),
    }
    decision = resolve_execution(
        role="planner",
        mode="auto",
        subscription_first=True,
        cli_statuses=statuses,
        api_provider_configured=False,
        api_provider_id=None,
        api_provider_display_name=None,
    )
    assert decision.execution_id == "codex-cli"


def test_tester_role_priority_prefers_gemini() -> None:
    statuses = {
        "codex-cli": _status("codex-cli", installed=True, authenticated=True),
        "claude-code-cli": _status("claude-code-cli", installed=True, authenticated=True),
        "gemini-cli": _status("gemini-cli", installed=True, authenticated=True),
    }
    decision = resolve_execution(
        role="tester",
        mode="auto",
        subscription_first=True,
        cli_statuses=statuses,
        api_provider_configured=False,
        api_provider_id=None,
        api_provider_display_name=None,
    )
    assert decision.execution_id == "gemini-cli"
