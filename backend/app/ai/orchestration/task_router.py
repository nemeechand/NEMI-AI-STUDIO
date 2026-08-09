from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.ai.cli_tools import (
    CLI_TOOLS,
    ROLE_TOOL_PRIORITY,
    CliRole,
    CliToolId,
    CliToolStatus,
    is_available,
)

ExecutionMode = Literal["auto", "codex-cli", "claude-code-cli", "gemini-cli"]
ExecutionBackend = Literal["api", "cli"]


@dataclass(frozen=True)
class ExecutionDecision:
    """The Task Router's answer to "what should actually run this role's
    task right now". Never fabricated: `available=False` means honestly
    nothing usable was found, not a silently-chosen guess. `fallback_used`
    is the "clearly display which execution method is being used" /
    "never silently switch to paid API usage" signal the UI surfaces."""

    available: bool
    backend: ExecutionBackend | None
    execution_id: str | None  # a CliToolId, or an API provider id
    display_name: str | None
    fallback_used: bool
    reason: str


def resolve_execution(
    *,
    role: CliRole,
    mode: ExecutionMode,
    subscription_first: bool,
    cli_statuses: dict[CliToolId, CliToolStatus],
    api_provider_configured: bool,
    api_provider_id: str | None,
    api_provider_display_name: str | None,
) -> ExecutionDecision:
    """Pure decision function — the entire Task Router / Auto-mode /
    subscription-first policy in one place, deliberately side-effect-free
    so it's exhaustively unit-testable without a real CLI, a database, or
    a network call. Two ways in:

    - `mode` is an explicit CLI tool id (an explicit user choice, e.g. the
      "Code with Claude" button): use exactly that tool if it's available,
      otherwise report it unavailable — an explicit choice never silently
      redirects to a different tool or to an API provider.
    - `mode == "auto"`: try this role's CLI tools in priority order
      (`ROLE_TOOL_PRIORITY`); if `subscription_first` and none are
      available, fall back to the configured API provider (with
      `fallback_used=True` so the UI must say so); if not
      `subscription_first`, the configured API provider is tried first,
      CLI tools second — this is the user's own explicit policy choice,
      not a silent default.
    """
    if mode != "auto":
        status = cli_statuses.get(mode)
        tool = CLI_TOOLS[mode]
        if status is not None and is_available(status):
            return ExecutionDecision(
                available=True,
                backend="cli",
                execution_id=mode,
                display_name=tool.display_name,
                fallback_used=False,
                reason=f"Explicit selection: {tool.display_name}.",
            )
        return ExecutionDecision(
            available=False,
            backend=None,
            execution_id=None,
            display_name=tool.display_name,
            fallback_used=False,
            reason=_unavailable_reason(tool.display_name, status),
        )

    def _try_cli_tools() -> ExecutionDecision | None:
        for tool_id in ROLE_TOOL_PRIORITY[role]:
            status = cli_statuses.get(tool_id)
            if status is not None and is_available(status):
                tool = CLI_TOOLS[tool_id]
                return ExecutionDecision(
                    available=True,
                    backend="cli",
                    execution_id=tool_id,
                    display_name=tool.display_name,
                    fallback_used=False,
                    reason=f"Auto mode selected {tool.display_name} for the {role} role "
                    "(authenticated subscription tool, subscription-first policy).",
                )
        return None

    def _try_api() -> ExecutionDecision | None:
        if not api_provider_configured or not api_provider_id:
            return None
        return ExecutionDecision(
            available=True,
            backend="api",
            execution_id=api_provider_id,
            display_name=api_provider_display_name or api_provider_id,
            fallback_used=True,
            reason=(
                f"No authenticated subscription CLI is available for the {role} role; "
                f"falling back to the configured API provider "
                f"({api_provider_display_name or api_provider_id}). This uses paid API "
                "usage, not a subscription tool."
            ),
        )

    if subscription_first:
        decision = _try_cli_tools()
        if decision is not None:
            return decision
        decision = _try_api()
        if decision is not None:
            return decision
    else:
        decision = _try_api()
        if decision is not None:
            decision = ExecutionDecision(
                available=True,
                backend="api",
                execution_id=decision.execution_id,
                display_name=decision.display_name,
                fallback_used=False,
                reason=(
                    f"Subscription-first is off; using the configured API provider "
                    f"({decision.display_name}) for the {role} role."
                ),
            )
            return decision
        decision = _try_cli_tools()
        if decision is not None:
            return decision

    return ExecutionDecision(
        available=False,
        backend=None,
        execution_id=None,
        display_name=None,
        fallback_used=False,
        reason=(
            f"No authenticated subscription CLI and no configured API provider are "
            f"available for the {role} role. Install/authenticate a CLI tool, or "
            "configure an API provider in Settings."
        ),
    )


def _unavailable_reason(display_name: str, status: CliToolStatus | None) -> str:
    if status is None or not status.installed:
        return f"{display_name} is not installed."
    if status.authenticated is False:
        return f"{display_name} is installed but not authenticated. Run its login, then retry."
    return f"{display_name}'s authentication state could not be confirmed."
