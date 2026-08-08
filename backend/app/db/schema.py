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
    connection.commit()
