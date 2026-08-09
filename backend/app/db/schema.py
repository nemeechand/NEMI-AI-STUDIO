from __future__ import annotations

import sqlite3

# Mirrors docs/DATABASE_SCHEMA.md exactly. Update both together.
SCHEMA_STATEMENTS: tuple[str, ...] = (
    """
    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_opened_at TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id),
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL
            CHECK (status IN ('pending', 'in_progress', 'review', 'done', 'blocked')),
        priority TEXT NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
        agent TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)",
    """
    CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id),
        relative_path TEXT NOT NULL,
        language TEXT,
        last_indexed TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (project_id, relative_path)
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_files_project_id ON files(project_id)",
    """
    CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        role_file TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS memory (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id),
        type TEXT NOT NULL
            CHECK (type IN ('project', 'conversation', 'long_term', 'task', 'knowledge')),
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_memory_project_type ON memory(project_id, type)",
    """
    CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id),
        level TEXT NOT NULL CHECK (level IN ('INFO', 'WARNING', 'ERROR', 'DEBUG')),
        source TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at)",
    """
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS history (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id),
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
        snapshot TEXT,
        created_at TEXT NOT NULL
    )
    """,
    # Sprint 10: normalized conversation/message tables, distinct from the
    # generic `memory` table's single JSON `value` blob — an ordered,
    # per-message-metadata transcript (role, provider, model, token counts,
    # streaming outcome) needs real columns to be queryable and indexable,
    # not a JSON blob re-parsed on every read. See docs/DATABASE_SCHEMA.md.
    """
    CREATE TABLE IF NOT EXISTS ai_conversations (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id),
        title TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_ai_conversations_project_id ON ai_conversations(project_id)",
    """
    CREATE TABLE IF NOT EXISTS ai_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES ai_conversations(id),
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        provider TEXT,
        model TEXT,
        status TEXT NOT NULL
            CHECK (status IN ('complete', 'cancelled', 'error')) DEFAULT 'complete',
        error_message TEXT,
        prompt_tokens INTEGER,
        completion_tokens INTEGER,
        context_refs TEXT,
        created_at TEXT NOT NULL
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON ai_messages(conversation_id)",
    # Sprint 11: the agent orchestration task queue. One row per unit of
    # work assigned to one of the four orchestrated roles (planner/
    # developer/reviewer/tester — Architect/Debugger/Documentation/Release
    # Manager exist in `agents` as chat-invokable personas but aren't part
    # of the automated pipeline this sprint). `depends_on_task_id` chains
    # a pipeline (Developer depends on its Planner, Reviewer on its
    # Developer, ...) so the scheduler only starts a task once its
    # dependency has actually completed.
    """
    CREATE TABLE IF NOT EXISTS agent_tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        agent_role TEXT NOT NULL
            CHECK (agent_role IN ('planner', 'developer', 'reviewer', 'tester')),
        status TEXT NOT NULL
            CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled'))
            DEFAULT 'queued',
        priority INTEGER NOT NULL DEFAULT 2,
        depends_on_task_id TEXT REFERENCES agent_tasks(id),
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        conversation_id TEXT REFERENCES ai_conversations(id),
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 2,
        result_summary TEXT,
        proposed_files TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_agent_tasks_project_id ON agent_tasks(project_id)",
    "CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status)",
    "CREATE INDEX IF NOT EXISTS idx_agent_tasks_depends_on ON agent_tasks(depends_on_task_id)",
    # Sprint 12: the AI Project Manager turns one high-level user goal into
    # an ordered list of milestones, each of which becomes its own
    # planner/developer/reviewer/tester pipeline (see agent_tasks.workflow_id/
    # milestone_id below) — a workflow is the durable record of that goal
    # and its overall run state (including pause/resume, which the workflow
    # engine implements by filtering agent_tasks.list_runnable() rather than
    # touching agent_tasks.status, so no CHECK-constraint migration is
    # needed on the table that already shipped in Sprint 11).
    """
    CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id),
        title TEXT NOT NULL,
        goal TEXT NOT NULL,
        status TEXT NOT NULL
            CHECK (status IN
                ('planning', 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled'))
            DEFAULT 'planning',
        approval_mode TEXT NOT NULL
            CHECK (approval_mode IN ('auto', 'review', 'manual'))
            DEFAULT 'review',
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        conversation_id TEXT REFERENCES ai_conversations(id),
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_workflows_project_id ON workflows(project_id)",
    """
    CREATE TABLE IF NOT EXISTS milestones (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL REFERENCES workflows(id),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        status TEXT NOT NULL
            CHECK (status IN ('pending', 'queued', 'running', 'completed', 'failed', 'cancelled'))
            DEFAULT 'pending',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_milestones_workflow_id ON milestones(workflow_id)",
    # Sprint 14: the knowledge graph. A relational (not a dedicated graph-DB)
    # model, consistent with this project's SQLite-only architecture — nodes
    # reference the *real* row that backs them (ref_id into files/agent_tasks/
    # workflows/etc, or null for a derived node like a git author) rather than
    # duplicating that data, so the graph stays cheap to keep in sync. See
    # docs/ARCHITECTURE.md's KNOWLEDGE GRAPH ENGINE section for the full node/
    # relationship vocabulary and what's deliberately NOT modeled (no per-task
    # nodes, no external-package nodes for unresolved imports).
    """
    CREATE TABLE IF NOT EXISTS graph_nodes (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id),
        node_type TEXT NOT NULL CHECK (node_type IN
            ('project', 'file', 'function', 'class', 'agent', 'workflow',
             'commit', 'user', 'requirement')),
        label TEXT NOT NULL,
        ref_id TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (project_id, node_type, label)
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_graph_nodes_project_type ON graph_nodes(project_id, node_type)",
    """
    CREATE TABLE IF NOT EXISTS graph_edges (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id),
        from_node_id TEXT NOT NULL REFERENCES graph_nodes(id),
        to_node_id TEXT NOT NULL REFERENCES graph_nodes(id),
        relationship TEXT NOT NULL CHECK (relationship IN
            ('contains', 'defines', 'imports', 'modifies', 'executed_by',
             'authored_by', 'implements', 'related_to')),
        metadata TEXT,
        created_at TEXT NOT NULL,
        UNIQUE (from_node_id, to_node_id, relationship)
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_graph_edges_from ON graph_edges(from_node_id)",
    "CREATE INDEX IF NOT EXISTS idx_graph_edges_to ON graph_edges(to_node_id)",
    # Sprint 14: real embedding vectors (never fabricated similarity) for
    # semantic search — brute-force cosine similarity at query time in
    # Python (app/knowledge/semantic_search.py), which is honest and
    # sufficient at this app's single-user, low-thousands-of-entities scale;
    # a dedicated vector index would be premature infrastructure. `vector`
    # is a JSON-encoded float array (SQLite has no native vector type).
    """
    CREATE TABLE IF NOT EXISTS embeddings (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id),
        entity_type TEXT NOT NULL CHECK (entity_type IN ('file', 'memory', 'workflow')),
        entity_id TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        dimensions INTEGER NOT NULL,
        vector TEXT NOT NULL,
        text_preview TEXT,
        created_at TEXT NOT NULL,
        UNIQUE (project_id, entity_type, entity_id)
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_embeddings_project_entity "
    "ON embeddings(project_id, entity_type)",
    # Sprint 15: the Safe Change Engine's rollback baseline. One row per
    # (task, file) the first time that file is applied for that task —
    # `previous_content` is the file's real on-disk content immediately
    # before the overwrite (captured by Electron, since the backend never
    # reads/writes the open project's files itself — Sprint 5's Filesystem
    # Ownership rule), or NULL if the file did not exist yet, meaning a
    # rollback should delete it rather than restore old content.
    """
    CREATE TABLE IF NOT EXISTS file_snapshots (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES agent_tasks(id),
        project_id TEXT REFERENCES projects(id),
        relative_path TEXT NOT NULL,
        previous_content TEXT,
        created_at TEXT NOT NULL,
        UNIQUE (task_id, relative_path)
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_file_snapshots_task_id ON file_snapshots(task_id)",
    # Sprint 15.5: structured, per-provider configuration (enable/disable,
    # base URL, default/last-used model, last real connection-test
    # outcome) — deliberately its own table rather than rows in the
    # generic `settings` key-value table, matching the precedent set by
    # `ai_conversations`/`ai_messages` over the generic `memory` blob.
    # `provider_id` is one of the app.ai.registry provider ids ('openai',
    # 'anthropic', 'gemini', 'ollama', 'deepseek', 'grok', 'custom').
    """
    CREATE TABLE IF NOT EXISTS provider_settings (
        provider_id TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 1,
        base_url TEXT,
        default_model TEXT,
        last_used_model TEXT,
        last_used_at TEXT,
        last_connection_status TEXT NOT NULL
            CHECK (last_connection_status IN ('untested', 'ok', 'error')) DEFAULT 'untested',
        last_connection_message TEXT,
        last_connection_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """,
    # Sprint 15.5: the Model Manager's per-provider favorites list.
    """
    CREATE TABLE IF NOT EXISTS model_favorites (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        model_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (provider_id, model_id)
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_model_favorites_provider ON model_favorites(provider_id)",
    # Sprint 15.5: lets each orchestrated agent role use its own
    # provider/model instead of always inheriting the workflow's provider —
    # consulted by create_milestone_pipelines()/generate_feature_documentation(),
    # falling back to the workflow's own provider/model when no row exists
    # for a role.
    """
    CREATE TABLE IF NOT EXISTS agent_provider_defaults (
        agent_role TEXT PRIMARY KEY
            CHECK (agent_role IN ('planner', 'developer', 'reviewer', 'tester', 'documentation')),
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """,
    # Sprint 16: the Task Router's persisted policy. A singleton row
    # (`id = 'default'`) rather than a new key-value convention — this is
    # exactly two flat fields, so a dedicated table with real columns
    # matches `provider_settings`/`agent_provider_defaults`'s precedent of
    # "structured settings get their own table" more directly than
    # reusing the generic `settings` blob would. `mode` is 'auto' or one
    # of the three CLI tool ids (an explicit, non-Auto choice); which
    # provider/CLI each *role* prefers is deliberately NOT duplicated here
    # — that's what `agent_provider_defaults.provider` already is (Sprint
    # 15.5), and it already accepts any provider id, including the three
    # new CLI tool ids this sprint registers. See app/ai/cli_tools.py.
    """
    CREATE TABLE IF NOT EXISTS execution_policy (
        id TEXT PRIMARY KEY,
        mode TEXT NOT NULL
            CHECK (mode IN ('auto', 'codex-cli', 'claude-code-cli', 'gemini-cli'))
            DEFAULT 'auto',
        subscription_first INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
    )
    """,
)


def _add_column_if_missing(
    connection: sqlite3.Connection, table: str, column: str, column_type: str
) -> None:
    """CREATE TABLE IF NOT EXISTS is a no-op on a table that already exists,
    so a new column on an existing table (e.g. `projects` has existed empty
    since Sprint 4) needs an explicit, idempotent ALTER TABLE — see
    docs/DATABASE_SCHEMA.md's note on revisiting this once a column changes.
    """
    existing_columns = {
        row[1] for row in connection.execute(f"PRAGMA table_info({table})").fetchall()
    }
    if column not in existing_columns:
        connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {column_type}")


def init_db(connection: sqlite3.Connection) -> None:
    for statement in SCHEMA_STATEMENTS:
        connection.execute(statement)
    _add_column_if_missing(connection, "projects", "last_opened_at", "TEXT")
    # Sprint 11: a conversation can now be scoped to an agent persona
    # (agent_id) and, when driven by the task queue rather than manual
    # chat, to the specific task it's doing the work for (task_id).
    _add_column_if_missing(connection, "ai_conversations", "agent_id", "TEXT")
    _add_column_if_missing(connection, "ai_conversations", "task_id", "TEXT")
    # Sprint 12: all additive/nullable-or-defaulted, deliberately avoiding
    # any change to agent_tasks' existing `status` CHECK constraint, which
    # SQLite can't alter in place on a table created under the old
    # definition — see the workflows table comment above.
    _add_column_if_missing(connection, "agent_tasks", "workflow_id", "TEXT")
    _add_column_if_missing(connection, "agent_tasks", "milestone_id", "TEXT")
    _add_column_if_missing(
        connection, "agent_tasks", "requires_approval", "INTEGER NOT NULL DEFAULT 0"
    )
    _add_column_if_missing(connection, "agent_tasks", "approved_at", "TEXT")
    _add_column_if_missing(
        connection, "agent_tasks", "proposed_files_applied", "INTEGER NOT NULL DEFAULT 0"
    )
    _add_column_if_missing(connection, "agent_tasks", "conflict_warning", "TEXT")
    # Sprint 13: the accumulated-so-far streamed text of a currently
    # `running` task, flushed periodically (not per-chunk — see
    # manager.py) so the AI Thinking Panel can show genuine in-progress
    # model output rather than fabricated "reasoning". Cleared back to
    # NULL once the task completes (result_summary takes over).
    _add_column_if_missing(connection, "agent_tasks", "live_output", "TEXT")
    # Sprint 15: the Safe Change Engine's rollback marker — set when a
    # task's applied files have been restored to their pre-apply state
    # (see file_snapshots above). Deliberately reuses `proposed_files_applied`
    # (reset to 0 on rollback) rather than adding a parallel status enum.
    _add_column_if_missing(connection, "agent_tasks", "rolled_back_at", "TEXT")
    # Sprint 15: the Documentation Engine's output — a real, grounded
    # Markdown summary generated once a workflow completes (see
    # app/ai/orchestration/documentation.py), and the Test Engine's real
    # pass/fail result from actually running the open project's test
    # suite. Both nullable: neither blocks a feature from completing if
    # unavailable (no API key, no test script detected).
    _add_column_if_missing(connection, "workflows", "documentation", "TEXT")
    _add_column_if_missing(connection, "workflows", "documentation_generated_at", "TEXT")
    _add_column_if_missing(connection, "workflows", "last_test_result", "TEXT")
    # Sprint 15.5: real wall-clock milliseconds from request start to the
    # provider's final StreamDone event — the AI Chat's "Response Time".
    _add_column_if_missing(connection, "ai_messages", "latency_ms", "INTEGER")
    # Sprint 16: which kind of execution actually ran this task. Additive/
    # defaulted so every pre-Sprint-16 row is implicitly 'api' (correct —
    # CLI-tool execution didn't exist before this sprint), same pattern as
    # every prior agent_tasks column addition above. `cli_tool_id` is one
    # of app.ai.cli_tools' three registered ids when execution_backend is
    # 'cli', else NULL. `files_changed` is the real list of paths a CLI
    # coding tool actually wrote to disk (detected via git diff against
    # the pre-dispatch checkpoint commit — see frontend/electron/
    # cli-tools.ts) — distinct from `proposed_files`, which only a
    # Developer-role *API* task ever populates (Sprint 11's human-gated
    # fenced-block proposals). `cli_exit_code` is the CLI process's real
    # exit code, never fabricated.
    _add_column_if_missing(
        connection, "agent_tasks", "execution_backend", "TEXT NOT NULL DEFAULT 'api'"
    )
    _add_column_if_missing(connection, "agent_tasks", "cli_tool_id", "TEXT")
    _add_column_if_missing(connection, "agent_tasks", "files_changed", "TEXT")
    _add_column_if_missing(connection, "agent_tasks", "cli_exit_code", "INTEGER")
    connection.commit()
