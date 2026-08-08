from __future__ import annotations

import sqlite3
from typing import Any

from app.ai.agent_roles import load_agent_roles
from app.ai.errors import ProviderError
from app.ai.registry import get_provider
from app.ai.types import ChatMessage, StreamChunk, StreamDone, TokenUsage
from app.core.config import Settings
from app.core.logging import get_logger
from app.db.repositories.agents_repository import AgentsRepository
from app.db.repositories.ai_conversations_repository import ConversationsRepository
from app.db.repositories.ai_messages_repository import MessagesRepository

logger = get_logger("ai.orchestration.documentation")

# Appended to the real agents/documentation.md role prompt (this module is
# that role's first actual consumer — previously a chat-invokable persona
# only, per app.ai.agent_roles.ORCHESTRATED_ROLES). The instruction is
# deliberately strict about not inventing anything beyond the given facts:
# this generates real project documentation, not creative writing.
_GENERATION_INSTRUCTION = (
    "\n\nYou will be given the REAL, already-completed facts about a "
    "feature that was just implemented: its goal, its milestones, the "
    "files that were actually changed, and the real test result. Write a "
    "concise Markdown changelog-style entry documenting it — a "
    "'## <Feature Title>' heading, a short summary paragraph explaining "
    "what was built and why, and a 'Files changed' list. Base every "
    "statement strictly on the facts given below; never invent a file, "
    "milestone, decision, or outcome that wasn't listed."
)


def _gather_real_facts(
    workflow: dict[str, Any], milestones: list[dict[str, Any]], tasks: list[dict[str, Any]]
) -> str:
    developer_tasks = [
        t for t in tasks if t["agent_role"] == "developer" and t["status"] == "completed"
    ]
    changed_files: list[str] = []
    for task in developer_tasks:
        for proposed in task.get("proposed_files") or []:
            if proposed["path"] not in changed_files:
                changed_files.append(proposed["path"])

    milestone_lines = "\n".join(f"- {m['title']}" for m in milestones) or "(none)"
    files_lines = "\n".join(f"- {path}" for path in changed_files) or "(no files changed)"

    test_result = workflow.get("last_test_result")
    if not test_result:
        test_line = "Not run."
    elif test_result.get("passed"):
        test_line = "Passed."
    else:
        test_line = f"Failed (exit code {test_result.get('exit_code')})."

    return (
        f"Feature title: {workflow['title']}\n"
        f"Goal: {workflow['goal']}\n\n"
        f"Milestones completed ({len(milestones)}):\n{milestone_lines}\n\n"
        f"Files changed ({len(changed_files)}):\n{files_lines}\n\n"
        f"Test result: {test_line}"
    )


async def generate_feature_documentation(
    settings: Settings,
    connection: sqlite3.Connection,
    *,
    workflow: dict[str, Any],
    milestones: list[dict[str, Any]],
    tasks: list[dict[str, Any]],
    api_keys: dict[str, str],
) -> str | None:
    """Sprint 15's Documentation Engine: a real LLM call using the actual
    `agents/documentation.md` role, but strictly grounded in facts already
    known to be true from this workflow's own data — the model is never
    given room to invent what changed, only to narrate it. Returns None
    (never raises) on any provider/key/role problem: missing documentation
    must never block a feature from being marked completed.
    """
    provider = get_provider(workflow["provider"])
    api_key = api_keys.get(workflow["provider"])
    if provider.requires_api_key and not api_key:
        logger.info(
            "Skipping documentation generation for workflow %s: no API key available",
            workflow["id"],
        )
        return None

    role = next(
        (r for r in load_agent_roles(settings.agents_dir) if r.key == "documentation"), None
    )
    if role is None:
        logger.warning("No 'documentation' role file found; skipping documentation generation")
        return None

    system_prompt = role.system_prompt + _GENERATION_INSTRUCTION
    facts = _gather_real_facts(workflow, milestones, tasks)

    agent_row = AgentsRepository(connection).get_by_role_key(settings.agents_dir, "documentation")
    conversation = ConversationsRepository(connection).create(
        project_id=workflow["project_id"],
        title=f"Documentation: {workflow['title']}",
        provider=workflow["provider"],
        model=workflow["model"],
        agent_id=agent_row["id"] if agent_row else None,
        task_id=None,
    )
    messages_repo = MessagesRepository(connection)
    messages_repo.add_system_message(conversation_id=conversation["id"], content=system_prompt)
    messages_repo.add_user_message(
        conversation_id=conversation["id"], content=facts, context_refs=None
    )

    chat_messages = [
        ChatMessage(role="system", content=system_prompt),
        ChatMessage(role="user", content=facts),
    ]
    accumulated: list[str] = []
    usage = TokenUsage()
    try:
        async for event in provider.stream_chat(
            messages=chat_messages, model=workflow["model"], api_key=api_key
        ):
            if isinstance(event, StreamChunk):
                accumulated.append(event.delta)
            elif isinstance(event, StreamDone):
                usage = event.usage
    except ProviderError:
        logger.exception("Documentation generation failed for workflow %s", workflow["id"])
        return None

    content = "".join(accumulated)
    if not content:
        return None

    messages_repo.add_assistant_message(
        conversation_id=conversation["id"],
        content=content,
        provider=workflow["provider"],
        model=workflow["model"],
        status="complete",
        prompt_tokens=usage.prompt_tokens,
        completion_tokens=usage.completion_tokens,
    )
    ConversationsRepository(connection).touch(
        conversation["id"], provider=workflow["provider"], model=workflow["model"]
    )
    return content
