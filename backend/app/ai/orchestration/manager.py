from __future__ import annotations

import asyncio
import re
import time
from typing import Any

from app.ai.agent_roles import load_agent_roles
from app.ai.errors import MissingApiKeyError, ProviderError
from app.ai.orchestration.documentation import generate_feature_documentation
from app.ai.orchestration.project_manager import (
    _MILESTONE_PIPELINE,
    MILESTONE_FORMAT_INSTRUCTION,
    create_milestone_pipelines,
    parse_milestones,
)
from app.ai.registry import get_provider
from app.ai.types import ChatMessage, StreamChunk, StreamDone, TokenUsage
from app.core.config import Settings
from app.core.logging import get_logger
from app.db.connection import get_connection
from app.db.repositories.agent_tasks_repository import AgentTasksRepository, TaskStatus
from app.db.repositories.agents_repository import AgentsRepository
from app.db.repositories.ai_conversations_repository import ConversationsRepository
from app.db.repositories.ai_messages_repository import MessagesRepository
from app.db.repositories.history_repository import HistoryRepository
from app.db.repositories.knowledge_repository import KnowledgeRepository
from app.db.repositories.memory_repository import MemoryRepository
from app.db.repositories.milestones_repository import MilestonesRepository, MilestoneStatus
from app.db.repositories.provider_settings_repository import ProviderSettingsRepository
from app.db.repositories.workflows_repository import WorkflowsRepository
from app.knowledge.analysis import analyze_impact

# Sprint 13: how often (seconds) a running task's accumulated streamed
# text is flushed to `agent_tasks.live_output` for the AI Thinking Panel
# — frequent enough to feel "live", infrequent enough not to turn every
# token into its own SQLite write.
LIVE_OUTPUT_FLUSH_INTERVAL_SECONDS = 1.5

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
    finally:
        if task["workflow_id"]:
            await _sync_workflow_progress(settings, task["workflow_id"], api_keys)


def _handle_failure(settings: Settings, task_id: str, message: str) -> None:
    with get_connection(settings) as connection:
        tasks_repo = AgentTasksRepository(connection)
        task = tasks_repo.get(task_id)
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
            if task is not None:
                HistoryRepository(connection).record(
                    project_id=task["project_id"],
                    entity_type="agent_task",
                    entity_id=task_id,
                    action="updated",
                    snapshot={
                        "status": "failed",
                        "title": task["title"],
                        "agent_role": task["agent_role"],
                        "error_message": message,
                        "dependents_cancelled": cancelled,
                    },
                )
                # Sprint 14: Persistent AI Memory — a permanently-failed task
                # is a real "bug" the knowledge base should remember, so a
                # future goal touching similar work can be warned by it (see
                # _related_past_experience below).
                MemoryRepository(connection).remember(
                    project_id=task["project_id"],
                    type="knowledge",
                    key=f"bug:{task_id}",
                    value=(
                        f"Task '{task['title']}' ({task['agent_role']}) failed permanently "
                        f"after {task['retry_count'] + 1} attempt(s): {message}"
                    ),
                )


async def _execute(settings: Settings, task: dict[str, Any], api_keys: dict[str, str]) -> None:
    role_key = task["agent_role"]
    roles_by_key = {r.key: r for r in load_agent_roles(settings.agents_dir)}
    role = roles_by_key.get(role_key)
    if role is None:
        raise ProviderError(f"No role definition found for '{role_key}'")

    # A workflow's very first task is a Planner task with no milestone yet
    # — its job is to decompose the user's goal into milestones (see
    # project_manager.py), not to plan one already-scoped piece of work
    # the way every other Planner task in the pipeline does.
    is_decomposition_task = bool(task["workflow_id"]) and task["milestone_id"] is None

    system_prompt = role.system_prompt
    if role_key == "developer":
        system_prompt += _DEVELOPER_FILE_BLOCK_INSTRUCTION
    elif is_decomposition_task:
        system_prompt += MILESTONE_FORMAT_INSTRUCTION

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

        # Sprint 14, AI Learning: retrieval over real past sprint summaries
        # (recorded in `_sync_workflow_progress` below) — a genuine, bounded
        # form of "improve future planning using previous projects": the
        # Planner sees what actually happened last time, it isn't claimed to
        # have learned anything on its own. Only for the one goal-
        # decomposition task per workflow, since that's the only point a
        # brand-new goal is being planned from scratch.
        if is_decomposition_task:
            experience = _related_past_experience(connection, task["description"])
            if experience:
                user_content += (
                    "\n\n---\n\nRelevant experience from previous sprints (use this to avoid "
                    "repeating past mistakes and to plan more effectively):\n"
                    + "\n".join(f"- {line}" for line in experience)
                )

        # Sprint 15, Autonomous Coding: grounds the Developer's own
        # "read existing files first / reuse existing modules / never
        # duplicate code" rules (agents/developer.md) with real matches
        # from the Knowledge Graph — a simple, honest keyword match
        # against real indexed file/function/class labels, not claimed
        # semantic understanding. Silently absent if the project hasn't
        # been indexed (Sprint 14) yet.
        if role_key == "developer" and task["project_id"]:
            related = _related_project_code(connection, task["project_id"], task["description"])
            if related:
                user_content += (
                    "\n\n---\n\nExisting project files/symbols that may already cover part of "
                    "this (read and reuse before writing new code):\n"
                    + "\n".join(f"- {line}" for line in related)
                )

        # Sprint 15, Review Engine: grounds the Reviewer's "Risk Level"
        # judgment (agents/reviewer.md's own RESPONSE FORMAT already asks
        # for one) with real Code Impact Analysis data for the files the
        # immediately-preceding Developer stage proposed, rather than
        # leaving it to guess from the diff text alone.
        elif role_key == "reviewer" and task["project_id"] and task["depends_on_task_id"]:
            dev_task = AgentTasksRepository(connection).get(task["depends_on_task_id"])
            if dev_task and dev_task.get("proposed_files"):
                impact_lines = []
                for proposed in dev_task["proposed_files"]:
                    impact = analyze_impact(
                        connection, project_id=task["project_id"], file_path=proposed["path"]
                    )
                    if impact.found:
                        impact_lines.append(
                            f"{proposed['path']}: {impact.risk_label} risk "
                            f"({len(impact.dependents)} file(s) depend on it)"
                        )
                if impact_lines:
                    user_content += (
                        "\n\n---\n\nReal dependency/risk data for the files under review "
                        "(from the project's knowledge graph):\n"
                        + "\n".join(f"- {line}" for line in impact_lines)
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
    with get_connection(settings) as connection:
        provider_settings_row = ProviderSettingsRepository(connection).get(task["provider"])
    base_url = provider_settings_row["base_url"] if provider_settings_row else None

    chat_messages = [
        ChatMessage(role="system", content=system_prompt),
        ChatMessage(role="user", content=user_content),
    ]
    accumulated: list[str] = []
    usage = TokenUsage()
    last_flush = time.monotonic()
    async for event in provider.stream_chat(
        messages=chat_messages, model=task["model"], api_key=api_key, base_url=base_url
    ):
        if isinstance(event, StreamChunk):
            accumulated.append(event.delta)
            now = time.monotonic()
            if now - last_flush >= LIVE_OUTPUT_FLUSH_INTERVAL_SECONDS:
                last_flush = now
                with get_connection(settings) as connection:
                    AgentTasksRepository(connection).update_live_output(
                        task["id"], "".join(accumulated)
                    )
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

        # Sprint 14: a task that needed one or more retries before it
        # finally succeeded is a real "fix" worth remembering — retry_count
        # here is the value BEFORE this run (mark_failed_or_retry is what
        # increments it, on a *previous* run), so > 0 means this run is the
        # one that got it right after prior failure(s).
        if task["retry_count"] > 0:
            MemoryRepository(connection).remember(
                project_id=task["project_id"],
                type="knowledge",
                key=f"fix:{task['id']}",
                value=(
                    f"Task '{task['title']}' ({task['agent_role']}) succeeded on attempt "
                    f"{task['retry_count'] + 1} after {task['retry_count']} prior failure(s)."
                ),
            )

        if role_key == "developer" and proposed_files and task["workflow_id"]:
            _detect_conflicts(connection, task, proposed_files)

        if is_decomposition_task:
            _apply_decomposition(connection, task, content)


_STOPWORDS = {
    "the", "a", "an", "and", "or", "for", "to", "of", "in", "on", "with", "that", "this",
    "is", "are", "be", "it", "as", "at", "by", "from", "into", "using", "use", "add", "build",
}


def _related_project_code(
    connection: Any, project_id: str, description: str, limit: int = 15
) -> list[str]:
    """Sprint 15: a real, bounded keyword match against the project's own
    indexed files/functions/classes (Sprint 14's knowledge graph) — the
    honest mechanism behind "read existing files first" / "avoid duplicate
    code": genuine retrieval over real labels, not a claim that the model
    understands the codebase. Returns nothing if the project hasn't been
    indexed yet (an empty/missing graph is a real, not a fabricated,
    absence of context)."""
    words = {w for w in re.findall(r"[a-z0-9]+", description.lower()) if len(w) > 3} - _STOPWORDS
    if not words:
        return []
    rows = connection.execute(
        """
        SELECT DISTINCT node_type, label FROM graph_nodes
        WHERE project_id = ? AND node_type IN ('file', 'function', 'class')
        """,
        (project_id,),
    ).fetchall()
    matches = []
    for row in rows:
        label_lower = row["label"].lower()
        if any(word in label_lower for word in words):
            matches.append(f"{row['node_type']}: {row['label']}")
    return matches[:limit]


def _related_past_experience(connection: Any, goal_text: str, limit: int = 3) -> list[str]:
    """Simple, real token-overlap ranking over every project's recorded
    sprint summaries and captured bugs/fixes — no embedding call required
    (this runs unconditionally for every workflow, even with no embedding
    provider configured), so this is deliberately cheap keyword scoring
    rather than semantic search. Cross-project on purpose: "previous
    projects", per Sprint 14's spec, not just this one."""
    goal_words = {w for w in re.findall(r"[a-z0-9]+", goal_text.lower()) if len(w) > 2} - _STOPWORDS
    if not goal_words:
        return []
    rows = connection.execute(
        "SELECT key, value FROM memory WHERE type IN ('long_term', 'knowledge') "
        "ORDER BY updated_at DESC LIMIT 300"
    ).fetchall()
    scored: list[tuple[int, str]] = []
    for row in rows:
        entry_words = {w for w in re.findall(r"[a-z0-9]+", row["value"].lower()) if len(w) > 2}
        overlap = len(goal_words & entry_words)
        if overlap > 0:
            scored.append((overlap, row["value"][:400]))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [text for _, text in scored[:limit]]


def _detect_conflicts(
    connection: Any, task: dict[str, Any], proposed_files: list[dict[str, str]]
) -> None:
    """Agent Collaboration's conflict detection: two Developer tasks in the
    same workflow (parallel milestones, or a retry racing an earlier
    attempt) proposing changes to the same file path is a real collision
    a human should see before applying either — flagged, never silently
    resolved or auto-merged."""
    siblings = AgentTasksRepository(connection).list_for_workflow(task["workflow_id"])
    proposed_paths = {f["path"] for f in proposed_files}
    conflicts = []
    for sibling in siblings:
        if sibling["id"] == task["id"]:
            continue
        sibling_paths = {f["path"] for f in (sibling.get("proposed_files") or [])}
        overlap = proposed_paths & sibling_paths
        if overlap:
            conflicts.append(f'"{sibling["title"]}" on {sorted(overlap)}')
    if conflicts:
        AgentTasksRepository(connection).set_conflict_warning(
            task["id"], "Proposed files overlap with: " + "; ".join(conflicts)
        )


def _apply_decomposition(connection: Any, task: dict[str, Any], content: str) -> None:
    """Turns the goal-decomposition Planner task's output into real
    milestone + pipeline rows, or fails the workflow outright if the
    model didn't follow the required format — an honest failure, not a
    silent no-op that would leave the workflow stuck at 'planning'
    forever with no visible reason."""
    workflow = WorkflowsRepository(connection).get(task["workflow_id"])
    if workflow is None:
        return
    milestones_data = parse_milestones(content)
    if not milestones_data:
        WorkflowsRepository(connection).set_status(
            workflow["id"],
            "failed",
            error_message=(
                "The AI Project Manager could not parse any milestones from the "
                "plan. Try rephrasing the goal, or a different model."
            ),
        )
        return
    create_milestone_pipelines(
        connection,
        workflow=workflow,
        milestones_data=milestones_data,
        decomposition_task_id=task["id"],
    )
    WorkflowsRepository(connection).set_status(workflow["id"], "queued")
    _record_knowledge_for_workflow(connection, workflow)


def _record_knowledge_for_workflow(connection: Any, workflow: dict[str, Any]) -> None:
    """Sprint 14, Knowledge Graph: a workflow IS a "Sprint" in the graph's
    vocabulary (see docs/ARCHITECTURE.md) — its goal doubles as its
    "Requirement" node (implements edge) since there's no separate
    requirements-gathering feature to derive one from, and it's linked to
    the four agent roles its pipeline will run (executed_by) — known
    upfront from the fixed Planner/Developer/Reviewer/Tester pipeline, not
    waited-for after the fact."""
    graph_repo = KnowledgeRepository(connection)
    workflow_node = graph_repo.upsert_node(
        project_id=workflow["project_id"], node_type="workflow", label=workflow["title"],
        ref_id=workflow["id"], metadata={"goal": workflow["goal"]},
    )
    if workflow["project_id"]:
        project_node = graph_repo.upsert_node(
            project_id=workflow["project_id"], node_type="project", label=workflow["project_id"],
            ref_id=workflow["project_id"],
        )
        graph_repo.add_edge(
            project_id=workflow["project_id"], from_node_id=project_node["id"],
            to_node_id=workflow_node["id"], relationship="contains",
        )
    requirement_node = graph_repo.upsert_node(
        project_id=workflow["project_id"], node_type="requirement",
        label=f"requirement:{workflow['id']}", metadata={"goal": workflow["goal"]},
    )
    graph_repo.add_edge(
        project_id=workflow["project_id"], from_node_id=workflow_node["id"],
        to_node_id=requirement_node["id"], relationship="implements",
    )
    for role in _MILESTONE_PIPELINE:
        agent_node = graph_repo.upsert_node(
            project_id=workflow["project_id"], node_type="agent", label=role
        )
        graph_repo.add_edge(
            project_id=workflow["project_id"], from_node_id=workflow_node["id"],
            to_node_id=agent_node["id"], relationship="executed_by",
        )
    connection.commit()


async def _sync_workflow_progress(
    settings: Settings, workflow_id: str, api_keys: dict[str, str]
) -> None:
    """Re-derives milestone and workflow status from their underlying
    agent_tasks' real statuses after every task transition — a workflow
    already in a terminal state (completed/failed/cancelled) is left
    alone, since a straggling in-flight task finishing afterward (e.g.
    one already running when the workflow was cancelled) shouldn't be
    able to resurrect it."""
    with get_connection(settings) as connection:
        workflows_repo = WorkflowsRepository(connection)
        workflow = workflows_repo.get(workflow_id)
        if workflow is None or workflow["status"] in ("completed", "failed", "cancelled"):
            return

        tasks_repo = AgentTasksRepository(connection)
        milestones_repo = MilestonesRepository(connection)
        tasks = tasks_repo.list_for_workflow(workflow_id)
        milestones = milestones_repo.list_for_workflow(workflow_id)

        for milestone in milestones:
            milestone_tasks = [t for t in tasks if t["milestone_id"] == milestone["id"]]
            if not milestone_tasks:
                continue
            statuses = {t["status"] for t in milestone_tasks}
            new_status: MilestoneStatus
            if statuses <= {"completed"}:
                new_status = "completed"
            elif "failed" in statuses:
                new_status = "failed"
            elif "running" in statuses or "completed" in statuses:
                new_status = "running"
            elif statuses <= {"cancelled"}:
                new_status = "cancelled"
            else:
                new_status = milestone["status"]
            if new_status != milestone["status"]:
                milestones_repo.set_status(milestone["id"], new_status)

        if not tasks:
            return
        all_statuses = {t["status"] for t in tasks}
        if all_statuses <= {"completed"}:
            workflows_repo.set_status(workflow_id, "completed")
            _record_workflow_history(connection, workflow, "completed")
            _record_sprint_summary_memory(connection, workflow, milestones, tasks)
            # Sprint 15's Documentation Engine: generated once per workflow
            # (documentation_generated_at is unset until this succeeds, so
            # a straggling task or a later poll never re-triggers it).
            if not workflow.get("documentation_generated_at"):
                documentation = await generate_feature_documentation(
                    settings, connection, workflow=workflow, milestones=milestones,
                    tasks=tasks, api_keys=api_keys,
                )
                if documentation:
                    workflows_repo.set_documentation(workflow_id, documentation)
        elif "failed" in all_statuses:
            workflows_repo.set_status(
                workflow_id,
                "failed",
                error_message="One or more milestone tasks failed permanently.",
            )
            _record_workflow_history(connection, workflow, "failed")
        elif "running" in all_statuses or "completed" in all_statuses:
            if workflow["status"] != "paused":
                workflows_repo.set_status(workflow_id, "running")
        elif all_statuses <= {"cancelled"}:
            workflows_repo.set_status(workflow_id, "cancelled")
        elif "queued" in all_statuses and workflow["status"] == "planning":
            workflows_repo.set_status(workflow_id, "queued")


def _record_workflow_history(connection: Any, workflow: dict[str, Any], new_status: str) -> None:
    HistoryRepository(connection).record(
        project_id=workflow["project_id"],
        entity_type="workflow",
        entity_id=workflow["id"],
        action="updated",
        snapshot={"status": new_status, "title": workflow["title"], "goal": workflow["goal"]},
    )


def _record_sprint_summary_memory(
    connection: Any,
    workflow: dict[str, Any],
    milestones: list[dict[str, Any]],
    tasks: list[dict[str, Any]],
) -> None:
    """Persistent AI Memory / Long-term Memory: a real, durable "what
    happened in this Sprint" record — retrieved by `_related_past_experience`
    above the next time a related goal is planned, and browsable directly
    via `GET /knowledge/memory`. Written once, when the workflow reaches
    'completed' (a permanently-failed workflow's individual task failures
    are already captured as `bug:` entries in `_handle_failure`)."""
    milestone_titles = ", ".join(m["title"] for m in milestones) or "(none)"
    summary = (
        f"Sprint '{workflow['title']}' completed.\nGoal: {workflow['goal']}\n"
        f"Milestones ({len(milestones)}): {milestone_titles}\n"
        f"Tasks completed: {len(tasks)}"
    )
    MemoryRepository(connection).remember(
        project_id=workflow["project_id"],
        type="long_term",
        key=f"sprint:{workflow['id']}",
        value=summary,
    )
