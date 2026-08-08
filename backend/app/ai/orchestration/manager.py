from __future__ import annotations

import asyncio
import re
from typing import Any

from app.ai.agent_roles import load_agent_roles
from app.ai.errors import MissingApiKeyError, ProviderError
from app.ai.registry import get_provider
from app.ai.types import ChatMessage, StreamChunk, StreamDone, TokenUsage
from app.core.config import Settings
from app.core.logging import get_logger
from app.db.connection import get_connection
from app.db.repositories.agent_tasks_repository import AgentTasksRepository, TaskStatus
from app.db.repositories.agents_repository import AgentsRepository
from app.db.repositories.ai_conversations_repository import ConversationsRepository
from app.db.repositories.ai_messages_repository import MessagesRepository
from app.db.repositories.memory_repository import MemoryRepository

logger = get_logger("ai.orchestration")

# A real, deliberate bound on "parallel execution where safe" — unbounded
# fan-out would hammer whatever provider is configured and make retry
# back-off meaningless. Three concurrent LLM calls is enough to show real
# parallelism (e.g. two independent Planner tasks for different projects)
# without turning a single run_cycle() into an accidental rate-limit storm.
MAX_CONCURRENT_TASKS = 3

_FILE_BLOCK_RE = re.compile(r"```file:([^\n`]+)\n(.*?)```", re.DOTALL)

_DEVELOPER_FILE_BLOCK_INSTRUCTION = (
    "\n\nWhen you propose a new or changed file, emit it as a fenced code "
    "block using this exact format so it can be reviewed and applied:\n"
    "```file:relative/path/to/file.ext\n<the complete file content>\n```\n"
    "You may only propose changes this way — you cannot modify files "
    "directly. A human reviews and applies (or rejects) each proposal."
)


def _extract_proposed_files(content: str) -> list[dict[str, str]]:
    """Parses a Developer Agent's ```file:path``` blocks into a structured
    list the frontend renders as Apply/Reject cards — never applied
    automatically. See docs/ARCHITECTURE.md's AGENT ORCHESTRATION
    FRAMEWORK section for why file writes stay human-gated."""
    return [
        {"path": path.strip(), "content": body} for path, body in _FILE_BLOCK_RE.findall(content)
    ]


async def run_cycle(settings: Settings, api_keys: dict[str, str]) -> int:
    """Runs one batch of currently-runnable tasks (dependency already
    satisfied, or no dependency) in parallel, up to MAX_CONCURRENT_TASKS.

    Deliberately stateless and externally triggered (by Electron polling
    this via `POST /agents/run-cycle`, the same lightweight-polling
    pattern StatusBar already uses for backend health) rather than an
    internal background loop the backend drives itself: API keys are
    never persisted server-side (Sprint 10's locked decision) and are
    only ever supplied per-request by Electron after decrypting them from
    safeStorage — an internal loop would have no legitimate way to obtain
    them for anything but Ollama. Returns how many tasks were started.
    """
    with get_connection(settings) as connection:
        runnable = AgentTasksRepository(connection).list_runnable()

    batch = runnable[: min(MAX_CONCURRENT_TASKS, len(runnable))]
    if not batch:
        return 0
    await asyncio.gather(*(_run_task(settings, task["id"], api_keys) for task in batch))
    return len(batch)


async def _run_task(settings: Settings, task_id: str, api_keys: dict[str, str]) -> None:
    with get_connection(settings) as connection:
        tasks_repo = AgentTasksRepository(connection)
        task = tasks_repo.get(task_id)
        if task is None or task["status"] != "queued":
            return  # raced with a concurrent cycle or a cancellation
        tasks_repo.mark_running(task_id)

    try:
        await _execute(settings, task, api_keys)
    except ProviderError as exc:
        _handle_failure(settings, task_id, str(exc))
    except Exception:
        logger.exception("Unhandled error running agent task %s", task_id)
        _handle_failure(settings, task_id, "An unexpected error occurred.")


def _handle_failure(settings: Settings, task_id: str, message: str) -> None:
    with get_connection(settings) as connection:
        tasks_repo = AgentTasksRepository(connection)
        next_status: TaskStatus = tasks_repo.mark_failed_or_retry(task_id, error_message=message)
        if next_status == "failed":
            cancelled = tasks_repo.cascade_cancel_dependents(task_id)
            if cancelled:
                logger.warning(
                    "Agent task %s failed permanently; cancelled %d dependent task(s): %s",
                    task_id,
                    len(cancelled),
                    cancelled,
                )


async def _execute(settings: Settings, task: dict[str, Any], api_keys: dict[str, str]) -> None:
    role_key = task["agent_role"]
    roles_by_key = {r.key: r for r in load_agent_roles(settings.agents_dir)}
    role = roles_by_key.get(role_key)
    if role is None:
        raise ProviderError(f"No role definition found for '{role_key}'")

    system_prompt = role.system_prompt
    if role_key == "developer":
        system_prompt += _DEVELOPER_FILE_BLOCK_INSTRUCTION

    # Agent-to-agent communication: recall the dependency's result from
    # `memory` — durable, so it survives a backend restart mid-pipeline,
    # unlike an in-process handoff would.
    user_content = task["description"]
    with get_connection(settings) as connection:
        if task["depends_on_task_id"]:
            prior = MemoryRepository(connection).recall(
                project_id=task["project_id"], type="task", key=task["depends_on_task_id"]
            )
            if prior:
                user_content = (
                    f"Context from the prior stage of this pipeline:\n\n{prior}\n\n"
                    f"---\n\nYour task:\n\n{task['description']}"
                )

        agent_row = AgentsRepository(connection).get_by_role_key(settings.agents_dir, role_key)
        conversation = ConversationsRepository(connection).create(
            project_id=task["project_id"],
            title=task["title"],
            provider=task["provider"],
            model=task["model"],
            agent_id=agent_row["id"] if agent_row else None,
            task_id=task["id"],
        )
        messages_repo = MessagesRepository(connection)
        messages_repo.add_system_message(conversation_id=conversation["id"], content=system_prompt)
        messages_repo.add_user_message(
            conversation_id=conversation["id"], content=user_content, context_refs=None
        )

    provider = get_provider(task["provider"])
    api_key = api_keys.get(task["provider"])
    if provider.requires_api_key and not api_key:
        raise MissingApiKeyError(
            f"No {task['provider']} API key was available when this task ran. "
            "Configure it in Settings, then retry."
        )

    chat_messages = [
        ChatMessage(role="system", content=system_prompt),
        ChatMessage(role="user", content=user_content),
    ]
    accumulated: list[str] = []
    usage = TokenUsage()
    async for event in provider.stream_chat(
        messages=chat_messages, model=task["model"], api_key=api_key
    ):
        if isinstance(event, StreamChunk):
            accumulated.append(event.delta)
        elif isinstance(event, StreamDone):
            usage = event.usage

    content = "".join(accumulated)
    proposed_files = _extract_proposed_files(content) if role_key == "developer" else []

    with get_connection(settings) as connection:
        MessagesRepository(connection).add_assistant_message(
            conversation_id=conversation["id"],
            content=content,
            provider=task["provider"],
            model=task["model"],
            status="complete",
            prompt_tokens=usage.prompt_tokens,
            completion_tokens=usage.completion_tokens,
        )
        ConversationsRepository(connection).touch(
            conversation["id"], provider=task["provider"], model=task["model"]
        )
        # Durable handoff for whatever task depends on this one.
        MemoryRepository(connection).remember(
            project_id=task["project_id"], type="task", key=task["id"], value=content
        )
        AgentTasksRepository(connection).mark_completed(
            task["id"],
            conversation_id=conversation["id"],
            result_summary=content[:2000],
            proposed_files=proposed_files or None,
        )
