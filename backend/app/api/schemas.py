from __future__ import annotations

from typing import Any, Literal

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
    supports_base_url: bool = False


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
    latency_ms: int | None = None
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
    base_url: str | None = None
    context_refs: list[AiContextRefIn] | None = None


# --- AI Provider Management (Sprint 15.5) ---


class ProviderSettingsOut(BaseModel):
    provider_id: str
    enabled: bool
    base_url: str | None = None
    default_model: str | None = None
    last_used_model: str | None = None
    last_used_at: str | None = None
    last_connection_status: Literal["untested", "ok", "error"] = "untested"
    last_connection_message: str | None = None
    last_connection_at: str | None = None


class ProviderSettingsUpdate(BaseModel):
    enabled: bool | None = None
    base_url: str | None = None
    default_model: str | None = None


class ConnectionTestRequest(BaseModel):
    api_key: str | None = None
    base_url: str | None = None


class ConnectionTestOut(BaseModel):
    ok: bool
    message: str


class OllamaModelOut(BaseModel):
    name: str
    size_bytes: int
    modified_at: str | None = None


class OllamaPullRequest(BaseModel):
    model: str = Field(min_length=1)
    base_url: str | None = None


class OllamaStatusOut(BaseModel):
    installed: bool
    server_running: bool
    host: str
    models: list[OllamaModelOut]


class ModelFavoriteToggle(BaseModel):
    model_id: str = Field(min_length=1)
    favorite: bool


AgentDefaultRoleKey = Literal["planner", "developer", "reviewer", "tester", "documentation"]


class AgentProviderDefaultOut(BaseModel):
    agent_role: AgentDefaultRoleKey
    provider: str
    model: str
    updated_at: str


class AgentProviderDefaultSet(BaseModel):
    provider: str = Field(min_length=1)
    model: str = Field(min_length=1)


class ProviderDashboardEntry(BaseModel):
    provider_id: str
    display_name: str
    enabled: bool
    requires_api_key: bool
    configured: bool
    default_model: str | None = None
    last_used_model: str | None = None
    last_used_at: str | None = None
    last_connection_status: Literal["untested", "ok", "error"] = "untested"
    last_connection_message: str | None = None
    requests: int
    prompt_tokens: int
    completion_tokens: int
    estimated_cost_usd: float | None = None
    avg_latency_ms: float | None = None
    errors: int


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
    workflow_id: str | None = None
    milestone_id: str | None = None
    requires_approval: bool = False
    approved_at: str | None = None
    proposed_files_applied: bool = False
    conflict_warning: str | None = None
    live_output: str | None = None
    rolled_back_at: str | None = None
    created_at: str
    updated_at: str
    started_at: str | None
    completed_at: str | None


class FileSnapshotIn(BaseModel):
    """Sprint 15's Safe Change Engine: the real on-disk content of a file
    immediately before Electron overwrites it with a Developer task's
    proposal — `previous_content: null` means the file did not exist yet
    (a rollback should delete it, not restore empty content)."""

    path: str = Field(min_length=1)
    previous_content: str | None = None


class MarkFilesAppliedRequest(BaseModel):
    snapshots: list[FileSnapshotIn] = Field(default_factory=list)


class RollbackFileOut(BaseModel):
    path: str
    previous_content: str | None


class RollbackInfoOut(BaseModel):
    task_id: str
    files: list[RollbackFileOut]


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


# --- Workflow Engine / AI Project Manager (Sprint 12) ---

WorkflowStatus = Literal[
    "planning", "queued", "running", "paused", "completed", "failed", "cancelled"
]
ApprovalMode = Literal["auto", "review", "manual"]
MilestoneStatus = Literal["pending", "queued", "running", "completed", "failed", "cancelled"]


class MilestoneOut(BaseModel):
    id: str
    workflow_id: str
    title: str
    description: str
    order_index: int
    status: MilestoneStatus
    created_at: str
    updated_at: str


class TestResultOut(BaseModel):
    passed: bool
    exit_code: int | None = None
    output_tail: str | None = None
    ran_at: str


class WorkflowOut(BaseModel):
    id: str
    project_id: str | None
    title: str
    goal: str
    status: WorkflowStatus
    approval_mode: ApprovalMode
    provider: str
    model: str
    conversation_id: str | None
    error_message: str | None
    documentation: str | None = None
    documentation_generated_at: str | None = None
    last_test_result: TestResultOut | None = None
    created_at: str
    updated_at: str
    started_at: str | None
    completed_at: str | None


class WorkflowDetailOut(WorkflowOut):
    milestones: list[MilestoneOut]
    tasks: list[AgentTaskOut]


RiskLevel = Literal["low", "medium", "high", "unknown"]


class FeatureSummaryOut(BaseModel):
    """Sprint 15's Feature Approval summary: real data assembled from the
    workflow's own tasks/snapshots/test result — never a fabricated
    "review" of changes that weren't actually inspected."""

    workflow_id: str
    files_changed: list[str]
    files_created: list[str]
    # A Developer task can only ever propose new/changed file content
    # (see manager.py's _extract_proposed_files, Sprint 11's locked
    # human-gated-apply decision) — it has no mechanism to propose a
    # deletion, so this is always empty. Included, and always empty,
    # rather than omitted, so the UI can state that honestly instead of
    # silently implying deletions were checked for.
    files_removed: list[str]
    test_result: TestResultOut | None
    risk_level: RiskLevel


class WorkflowCreate(BaseModel):
    project_id: str | None = None
    title: str = Field(min_length=1, max_length=200)
    goal: str = Field(min_length=1, max_length=20_000)
    provider: str = Field(min_length=1)
    model: str = Field(min_length=1)
    approval_mode: ApprovalMode = "review"


class TestResultIn(BaseModel):
    """Sprint 15's Test Engine: reported by Electron after actually
    running the open project's real test suite (`build.runTests()`,
    Sprint 13) — the backend never executes the user's project itself."""

    passed: bool
    exit_code: int | None = None
    output_tail: str | None = Field(default=None, max_length=4000)


# --- Knowledge Graph / AI Memory Engine (Sprint 14) ---

NodeTypeOut = Literal[
    "project", "file", "function", "class", "agent", "workflow", "commit", "user", "requirement"
]
RelationshipOut = Literal[
    "contains", "defines", "imports", "modifies", "executed_by", "authored_by", "implements",
    "related_to",
]


class GraphNodeOut(BaseModel):
    id: str
    project_id: str | None
    node_type: NodeTypeOut
    label: str
    ref_id: str | None
    metadata: dict[str, Any] | None = None


class GraphEdgeOut(BaseModel):
    id: str
    project_id: str | None
    from_node_id: str
    to_node_id: str
    relationship: RelationshipOut


class KnowledgeGraphOut(BaseModel):
    nodes: list[GraphNodeOut]
    edges: list[GraphEdgeOut]


class KnowledgeStatsOut(BaseModel):
    nodes_by_type: dict[str, int]
    total_nodes: int
    total_edges: int
    files_indexed: int
    embeddings_count: int


class CommitIn(BaseModel):
    hash: str = Field(min_length=1)
    message: str = ""
    author: str = ""
    date: str = ""
    files: list[str] = Field(default_factory=list)


class KnowledgeIndexRequest(BaseModel):
    project_id: str = Field(min_length=1)
    project_path: str = Field(min_length=1)
    commits: list[CommitIn] = Field(default_factory=list)


class KnowledgeIndexResult(BaseModel):
    files_indexed: int
    files_removed: int
    functions_found: int
    classes_found: int
    edges_created: int
    commits_indexed: int
    truncated: bool
    duration_ms: int
    errors: list[str]


class EmbeddingProviderOut(BaseModel):
    id: str
    display_name: str
    requires_api_key: bool
    default_model: str


class KnowledgeEmbedRequest(BaseModel):
    project_id: str = Field(min_length=1)
    project_path: str = Field(min_length=1)
    provider: str = Field(min_length=1)
    model: str = Field(min_length=1)
    api_key: str | None = None


class KnowledgeEmbedResult(BaseModel):
    embedded: int
    skipped_unchanged: int
    failed: int
    provider: str
    model: str


class KnowledgeSearchRequest(BaseModel):
    project_id: str = Field(min_length=1)
    query: str = Field(min_length=1, max_length=2000)
    provider: str | None = None
    model: str | None = None
    api_key: str | None = None


SearchMode = Literal["semantic", "keyword_fallback"]


class SearchHitOut(BaseModel):
    entity_type: str
    entity_id: str
    score: float
    preview: str


class KnowledgeSearchResult(BaseModel):
    mode: SearchMode
    fallback_reason: str | None = None
    hits: list[SearchHitOut]


class ImpactOut(BaseModel):
    file: str
    found: bool
    dependents: list[str]
    defines: list[str]
    related_bugs: list[str]
    risk_score: int
    risk_label: str


class DiagramOut(BaseModel):
    mermaid: str
    node_count: int
    edge_count: int
    truncated: bool


class FileContextOut(BaseModel):
    file: str
    found_in_graph: bool
    imported_by: list[str]
    defines: list[str]
    related_memory: list[dict[str, Any]]
    risk_score: int
    risk_label: str


class MemoryEntryOut(BaseModel):
    id: str
    project_id: str | None
    type: str
    key: str
    value: str
    created_at: str
    updated_at: str
