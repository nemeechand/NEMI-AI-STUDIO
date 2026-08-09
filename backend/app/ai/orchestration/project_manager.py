from __future__ import annotations

import re
import sqlite3
from typing import Any

from app.ai.cli_tools import CLI_TOOLS
from app.db.repositories.agent_provider_defaults_repository import (
    AgentProviderDefaultsRepository,
)
from app.db.repositories.agent_tasks_repository import AgentRoleKey, AgentTasksRepository
from app.db.repositories.milestones_repository import MilestonesRepository

# The four orchestrated roles, in pipeline order, mirrors
# app.api.schemas.DEFAULT_PIPELINE — duplicated here (not imported) to
# keep app.ai.orchestration free of a dependency on app.api, matching the
# existing layering (manager.py doesn't import from api either).
_MILESTONE_PIPELINE: tuple[AgentRoleKey, ...] = ("planner", "developer", "reviewer", "tester")

_MILESTONE_RE = re.compile(r"^### MILESTONE:\s*(.+?)\s*$", re.MULTILINE)

# Appended to the Planner role's own system prompt only for the one
# goal-decomposition task a workflow starts with — every other planner
# task (one per milestone, created below) uses the Planner's normal
# Sprint 11 prompt unchanged, since by that point it's planning a single
# concrete milestone, not decomposing the overall goal.
MILESTONE_FORMAT_INSTRUCTION = (
    "\n\nThe user has given you a high-level goal, not a single task. Break "
    "it into an ordered list of milestones — each one a coherent, "
    "independently shippable chunk of work that its own "
    "Planner/Developer/Reviewer/Tester pipeline could execute. Output EACH "
    "milestone in exactly this format, one after another, in the order "
    "they must be completed (earlier milestones are foundational to "
    "later ones):\n\n"
    "### MILESTONE: <short title>\n"
    "<one paragraph describing exactly what this milestone must deliver, "
    "followed by these lines — omit a line entirely if genuinely not "
    "applicable, but do not skip the analysis:\n"
    "Affected files: <existing files this will change, or 'none identified yet'>\n"
    "New files: <new files this will create, or 'none'>\n"
    "Database changes: <schema/migration impact, or 'none'>\n"
    "API changes: <new/changed endpoints, or 'none'>\n"
    "UI changes: <new/changed screens or components, or 'none'>\n"
    "Documentation changes: <docs that will need updating, or 'none'>\n"
    "Test requirements: <what should be tested, or 'none'>\n\n"
    "Output nothing else outside this format — no preamble, no summary "
    "after the last milestone."
)


def parse_milestones(content: str) -> list[dict[str, str]]:
    """Parses the Planner's goal-decomposition response into an ordered
    list of {title, description} — mirrors manager.py's
    _extract_proposed_files()'s regex-parsing convention for structured
    agent output. Returns an empty list if the model didn't follow the
    format (the caller treats that as a workflow-level failure, not a
    silent no-op — see manager.py)."""
    matches = list(_MILESTONE_RE.finditer(content))
    milestones: list[dict[str, str]] = []
    for index, match in enumerate(matches):
        title = match.group(1).strip()
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(content)
        description = content[start:end].strip()
        if title and description:
            milestones.append({"title": title, "description": description})
    return milestones


def _resolve_execution(provider: str) -> tuple[str, str | None]:
    """Sprint 16: `agent_provider_defaults.provider` (Sprint 15.5) is a
    free-text column that already accepts any provider id — including
    the three CLI tool ids the Settings' "AI Coding Control" tab can now
    write there (see AiCodingControlTab.tsx). A pipeline created from a
    role whose override IS a CLI tool id must be marked
    `execution_backend='cli'`, or `run_cycle`'s API-provider poller would
    try `get_provider()` on it and raise `UnknownProviderError` — this is
    the one place that resolution has to happen for goal-driven (Sprint
    12 AI Project Manager) pipelines, mirroring what api/agents.py's
    create_pipeline already does for ad-hoc (`use_task_router`) ones."""
    if provider in CLI_TOOLS:
        return "cli", provider
    return "api", None


def create_milestone_pipelines(
    connection: sqlite3.Connection,
    *,
    workflow: dict[str, Any],
    milestones_data: list[dict[str, str]],
    decomposition_task_id: str,
) -> None:
    """Turns the AI Project Manager's parsed milestone list into real
    rows: one `milestones` row plus a full planner/developer/reviewer/
    tester pipeline (`agent_tasks`) per milestone. Milestones run in
    order — each milestone's Planner stage depends on the *previous*
    milestone's Tester stage (or, for the first milestone, on the
    goal-decomposition task itself) — a single linear chain across the
    whole workflow, not a multi-parent dependency graph (see
    docs/ARCHITECTURE.md's Sprint 11 scoping of `depends_on_task_id` as
    one link, carried forward here rather than revisited)."""
    milestones_repo = MilestonesRepository(connection)
    tasks_repo = AgentTasksRepository(connection)
    requires_approval = workflow["approval_mode"] == "manual"
    # Sprint 15.5: each role can override the workflow's provider/model —
    # a role with no row here simply inherits the workflow's own choice.
    role_defaults = AgentProviderDefaultsRepository(connection).list_all()

    previous_stage_task_id = decomposition_task_id
    for order_index, data in enumerate(milestones_data):
        milestone = milestones_repo.create(
            workflow_id=workflow["id"],
            title=data["title"],
            description=data["description"],
            order_index=order_index,
        )
        for role in _MILESTONE_PIPELINE:
            override = role_defaults.get(role)
            provider = override["provider"] if override else workflow["provider"]
            execution_backend, cli_tool_id = _resolve_execution(provider)
            fallback_model = override["model"] if override else workflow["model"]
            model = "local" if cli_tool_id else fallback_model
            task = tasks_repo.create(
                project_id=workflow["project_id"],
                title=f"{milestone['title']} — {role.capitalize()}",
                description=data["description"],
                agent_role=role,
                priority=2,
                depends_on_task_id=previous_stage_task_id,
                provider=provider,
                model=model,
                workflow_id=workflow["id"],
                milestone_id=milestone["id"],
                requires_approval=requires_approval,
                execution_backend=execution_backend,
                cli_tool_id=cli_tool_id,
            )
            previous_stage_task_id = task["id"]
