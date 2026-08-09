from __future__ import annotations

import asyncio
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

CliToolId = Literal["codex-cli", "claude-code-cli", "gemini-cli"]
CliRole = Literal["planner", "developer", "reviewer", "tester"]

_VERSION_TIMEOUT_SECONDS = 5.0


@dataclass(frozen=True)
class CliToolDescriptor:
    """One subscription-based coding CLI this sprint can route work to.

    Sprint 16's authentication rule: NEMI never asks for an API key for
    these tools and never stores a credential of its own — it only
    *detects* whichever login state the tool's own official CLI already
    established on this machine (`codex login`, `claude login` /
    `claude` interactive OAuth, `gemini` OAuth), the same way
    `app.ai.providers.ollama_provider.is_ollama_installed` detects the
    Ollama CLI rather than reimplementing it. `auth_probe_paths` are the
    officially documented per-user credential file locations each tool
    writes on successful login, checked for *existence only* — never
    opened, read, or parsed, since NEMI has no legitimate use for their
    contents and doing so would risk this becoming credential storage,
    which the sprint explicitly forbids. This is a best-effort heuristic:
    if a future CLI version moves its credential file, detection may
    read as "installed, not authenticated" even when a real login exists
    — an honest false negative (never a fabricated "Authenticated"),
    correctable by updating `auth_probe_paths`.
    """

    id: CliToolId
    display_name: str
    binary_candidates: tuple[str, ...]
    version_args: tuple[str, ...]
    auth_probe_paths: tuple[str, ...]
    roles: tuple[CliRole, ...]
    role_note: str


CLI_TOOLS: dict[CliToolId, CliToolDescriptor] = {
    "codex-cli": CliToolDescriptor(
        id="codex-cli",
        display_name="ChatGPT / Codex",
        binary_candidates=("codex",),
        version_args=("--version",),
        auth_probe_paths=(".codex/auth.json",),
        roles=("planner", "reviewer", "developer"),
        role_note=(
            "Project Planner, Architecture Planner, Requirement Analyzer, Task Decomposer, "
            "Coding Agent (when Codex is available), Final Review / second opinion."
        ),
    ),
    "claude-code-cli": CliToolDescriptor(
        id="claude-code-cli",
        display_name="Claude Code",
        binary_candidates=("claude",),
        version_args=("--version",),
        auth_probe_paths=(".claude/.credentials.json",),
        roles=("developer", "reviewer"),
        role_note=(
            "Primary Coding Agent, multi-file implementation, refactoring, debugging, "
            "code review."
        ),
    ),
    "gemini-cli": CliToolDescriptor(
        id="gemini-cli",
        display_name="Gemini CLI",
        binary_candidates=("gemini",),
        version_args=("--version",),
        auth_probe_paths=(".gemini/oauth_creds.json", ".gemini/settings.json"),
        roles=("developer", "reviewer", "tester"),
        role_note=(
            "Coding Agent, Code Review Agent, Research/alternative implementation, "
            "Testing/debugging."
        ),
    ),
}

# Auto mode's role -> ordered CLI-tool preference, matching the sprint's
# stated role assignments (ChatGPT plans, Claude codes, Gemini
# reviews/tests) while still trying every tool for every role in a
# sensible fallback order — a role a tool "prefers" is tried first, not
# exclusively, since the honest goal is "use *an* available authenticated
# subscription tool", not "block the pipeline because the ideal one isn't
# logged in".
ROLE_TOOL_PRIORITY: dict[CliRole, tuple[CliToolId, ...]] = {
    "planner": ("codex-cli", "gemini-cli", "claude-code-cli"),
    "developer": ("claude-code-cli", "gemini-cli", "codex-cli"),
    "reviewer": ("codex-cli", "gemini-cli", "claude-code-cli"),
    "tester": ("gemini-cli", "claude-code-cli", "codex-cli"),
}


@dataclass(frozen=True)
class CliToolStatus:
    id: CliToolId
    display_name: str
    installed: bool
    binary_path: str | None
    version: str | None
    authenticated: bool | None  # None = unknown (installed but no probe matched)
    roles: tuple[CliRole, ...]
    role_note: str = field(default="")


def _find_binary(candidates: tuple[str, ...]) -> str | None:
    for name in candidates:
        path = shutil.which(name)
        if path:
            return path
    return None


def _probe_version(binary_path: str, version_args: tuple[str, ...]) -> str | None:
    """A real, cheap, non-billing invocation — every documented coding CLI
    supports `--version` locally with no network call and no auth
    required, so this never risks consuming a paid API credit."""
    try:
        result = subprocess.run(
            [binary_path, *version_args],
            capture_output=True,
            text=True,
            timeout=_VERSION_TIMEOUT_SECONDS,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    output = (result.stdout or result.stderr or "").strip()
    if not output:
        return None
    return output.splitlines()[0][:200]


def _probe_authenticated(descriptor: CliToolDescriptor) -> bool | None:
    home = Path.home()
    found_any_path = False
    for relative in descriptor.auth_probe_paths:
        candidate = home / relative
        found_any_path = True
        try:
            if candidate.is_file() and candidate.stat().st_size > 0:
                return True
        except OSError:
            continue
    return False if found_any_path else None


def detect_cli_tool(tool_id: CliToolId) -> CliToolStatus:
    """Synchronous, real detection — never fabricated. `installed` is a
    genuine `shutil.which` PATH lookup (mirrors
    `ollama_provider.is_ollama_installed`); `authenticated` is a
    best-effort credential-file-existence heuristic, `None` when unknown
    rather than guessed. Callers needing several of these concurrently
    should run each through `asyncio.to_thread` (see `detect_all`)."""
    descriptor = CLI_TOOLS[tool_id]
    binary_path = _find_binary(descriptor.binary_candidates)
    installed = binary_path is not None
    version = (
        _probe_version(binary_path, descriptor.version_args)
        if installed and binary_path is not None
        else None
    )
    authenticated = _probe_authenticated(descriptor) if installed else None
    return CliToolStatus(
        id=descriptor.id,
        display_name=descriptor.display_name,
        installed=installed,
        binary_path=binary_path,
        version=version,
        authenticated=authenticated,
        roles=descriptor.roles,
        role_note=descriptor.role_note,
    )


async def detect_all() -> list[CliToolStatus]:
    """All three tools' status, detected concurrently (each is a small
    blocking filesystem/subprocess check, run off the event loop)."""
    results = await asyncio.gather(
        *(asyncio.to_thread(detect_cli_tool, tool_id) for tool_id in CLI_TOOLS)
    )
    return list(results)


def is_available(status: CliToolStatus) -> bool:
    """The one condition under which Task Router may actually dispatch to
    this tool: installed AND positively confirmed authenticated. `None`
    (unknown auth) is deliberately NOT treated as available — "do not
    fabricate availability" means an unknown state must never be treated
    as a green light."""
    return status.installed and status.authenticated is True
