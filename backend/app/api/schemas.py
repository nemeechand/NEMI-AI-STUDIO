from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

LogLevel = Literal["INFO", "WARNING", "ERROR", "DEBUG"]


class LogEntryCreate(BaseModel):
    level: LogLevel
    source: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=4000)
    project_id: str | None = None


class LogEntryOut(BaseModel):
    id: str
    project_id: str | None
    level: str
    source: str
    message: str
    created_at: str


class ProjectOpenedCreate(BaseModel):
    path: str = Field(min_length=1)
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)


class ProjectOut(BaseModel):
    id: str
    name: str
    path: str
    description: str | None
    created_at: str
    updated_at: str
    last_opened_at: str | None


# --- AI Layer (Sprint 10) ---

AiRole = Literal["user", "assistant", "system"]
AiMessageStatus = Literal["complete", "cancelled", "error"]


class AiProviderOut(BaseModel):
    id: str
    display_name: str
    requires_api_key: bool


class AiConversationCreate(BaseModel):
    project_id: str | None = None
    title: str = Field(min_length=1, max_length=200)
    provider: str = Field(min_length=1)
    model: str = Field(min_length=1)


class AiConversationRename(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class AiConversationOut(BaseModel):
    id: str
    project_id: str | None
    title: str
    provider: str
    model: str
    agent_id: str | None = None
    task_id: str | None = None
    created_at: str
    updated_at: str


class AiContextRefOut(BaseModel):
    path: str
    start_line: int | None = None
    end_line: int | None = None


class AiMessageOut(BaseModel):
    id: str
    conversation_id: str
    role: AiRole
    content: str
    provider: str | None
    model: str | None
    status: AiMessageStatus
    error_message: str | None
    prompt_tokens: int | None
    completion_tokens: int | None
    context_refs: list[AiContextRefOut] | None
    created_at: str


class AiContextRefIn(BaseModel):
    path: str = Field(min_length=1)
    content: str = Field(max_length=200_000)
    start_line: int | None = None
    end_line: int | None = None


class AiSendMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=20_000)
    provider: str = Field(min_length=1)
    model: str = Field(min_length=1)
    api_key: str | None = None
    context_refs: list[AiContextRefIn] | None = None


# --- Agent Orchestration (Sprint 11) ---

AgentRoleKey = Literal["planner", "developer", "reviewer", "tester"]
AgentTaskStatus = Literal["queued", "running", "completed", "failed", "cancelled"]

DEFAULT_PIPELINE: tuple[AgentRoleKey, ...] = ("planner", "developer", "reviewer", "tester")


class AgentOut(BaseModel):
    id: str
    name: str
    role_file: str
    enabled: bool


class ProposedFileOut(BaseModel):
    path: str
    content: str


class AgentTaskOut(BaseModel):
    id: str
    project_id: str | None
    title: str
    description: str
    agent_role: AgentRoleKey
    status: AgentTaskStatus
    priority: int
    depends_on_task_id: str | None
    provider: str
    model: str
    conversation_id: str | None
    retry_count: int
    max_retries: int
    result_summary: str | None
    proposed_files: list[ProposedFileOut] | None
    error_message: str | None
    created_at: str
    updated_at: str
    started_at: str | None
    completed_at: str | None


class AgentPipelineCreate(BaseModel):
    project_id: str | None = None
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=20_000)
    provider: str = Field(min_length=1)
    model: str = Field(min_length=1)
    priority: int = Field(default=2, ge=1, le=4)
    stages: list[AgentRoleKey] = Field(default_factory=lambda: list(DEFAULT_PIPELINE), min_length=1)


class AgentRunCycleRequest(BaseModel):
    api_keys: dict[str, str] = Field(default_factory=dict)


class AgentRunCycleResult(BaseModel):
    started: int
