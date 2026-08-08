from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

# The four roles the Sprint 11 task queue actually orchestrates. The other
# four files in agents/ (architect, debugger, documentation, release_manager)
# are still seeded into the `agents` table as chat-invokable personas (see
# AgentsRepository) but aren't part of the automated pipeline this sprint.
ORCHESTRATED_ROLES = ("planner", "developer", "reviewer", "tester")

# Maps a role file's stem to the display name used everywhere else
# (agents.name, agent_tasks.agent_role uses the lowercase key directly).
ROLE_DISPLAY_NAMES = {
    "architect": "Architect",
    "planner": "Planner",
    "developer": "Developer",
    "reviewer": "Reviewer",
    "tester": "Tester",
    "debugger": "Debugger",
    "documentation": "Documentation",
    "release_manager": "Release Manager",
}

_SECTION_RE = re.compile(r"^# (.+?)\s*$", re.MULTILINE)


@dataclass(frozen=True)
class AgentRole:
    key: str
    display_name: str
    role_file: str
    system_prompt: str


def _split_sections(markdown: str) -> list[tuple[str, str]]:
    """Splits on top-level `# Heading` markers into (heading, body) pairs,
    stripping the `---` separators the role files use between sections."""
    matches = list(_SECTION_RE.finditer(markdown))
    sections: list[tuple[str, str]] = []
    for index, match in enumerate(matches):
        heading = match.group(1).strip()
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(markdown)
        body = markdown[start:end].strip().strip("-").strip()
        sections.append((heading, body))
    return sections


def _adapt_to_users_project(text: str) -> str:
    """The role files refer to themselves in third person as "NEMI AI
    STUDIO" throughout (e.g. "You are the Lead Software Developer of NEMI
    AI STUDIO") — replaced with a generic reference so the persona reads
    as being of the user's own open project, not of this IDE. Applied only
    to text parsed FROM the role file, never to this module's own
    hand-written wrapper text, which already refers to NEMI AI STUDIO
    correctly and deliberately (see load_agent_roles's caller)."""
    return text.replace("NEMI AI STUDIO", "the user's project")


def _compose_system_prompt(markdown: str, display_name: str) -> str:
    sections = _split_sections(markdown)
    # The first section is always the title/version/project boilerplate
    # ("# {NAME} AI" with Version/Project lines) — not useful in a prompt.
    body_sections = sections[1:]

    parts = [
        f"You are acting as the {display_name} for the project the user "
        "currently has open in NEMI AI STUDIO. Apply the role definition "
        "below to THAT project — not to NEMI AI STUDIO's own codebase or "
        "documentation, which you have no access to and should never "
        "reference. This project may have its own README or docs; if so, "
        "treat those the way this role definition treats NEMI's own "
        "internal docs.",
    ]
    for heading, text in body_sections:
        if heading.upper().startswith("BEFORE"):
            # These sections list NEMI-internal docs to read first
            # (docs/SYSTEM_PROMPT.md etc.) — meaningless for an arbitrary
            # user project, so they're replaced rather than included
            # verbatim.
            parts.append(
                "## Before Doing Anything\n\nReview the project's own "
                "structure, README, and any docs it contains, plus any "
                "file references or code the user has attached to this "
                "conversation, before responding.",
            )
            continue
        parts.append(f"## {heading}\n\n{_adapt_to_users_project(text)}")

    return "\n\n".join(parts)


def load_agent_roles(agents_dir: Path) -> list[AgentRole]:
    """Parses every agents/*.md file into an AgentRole. Returns an empty
    list (never raises) if the directory is missing or empty — a missing
    role file is a packaging defect worth logging, not a reason to crash
    backend startup."""
    if not agents_dir.is_dir():
        return []

    roles: list[AgentRole] = []
    for path in sorted(agents_dir.glob("*.md")):
        key = path.stem
        display_name = ROLE_DISPLAY_NAMES.get(key, key.replace("_", " ").title())
        markdown = path.read_text(encoding="utf-8")
        roles.append(
            AgentRole(
                key=key,
                display_name=display_name,
                role_file=f"agents/{path.name}",
                system_prompt=_compose_system_prompt(markdown, display_name),
            )
        )
    return roles
