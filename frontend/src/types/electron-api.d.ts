export {};

declare global {
  type BackendState = 'starting' | 'ready' | 'error' | 'stopped';

  interface BackendHealth {
    state: BackendState;
    port: number;
    message?: string;
    version?: string;
    uptimeSeconds?: number;
  }

  /** Sprint 15.6's Health Center backend aggregation. */
  interface FullHealthResponse {
    status: string;
    version: string;
    env: string;
    uptime_seconds: number;
    python: { version: string; implementation: string };
    database: { ok: boolean; path: string; size_bytes: number | null; message: string | null };
    providers: { total: number; connected: number; errors_total: number; requests_total: number };
    ollama: { installed: boolean; server_running: boolean; host: string };
    internet: { ok: boolean; message: string | null };
  }

  interface AppInfo {
    appVersion: string;
    electronVersion: string;
    chromeVersion: string;
    nodeVersion: string;
    platform: string;
  }

  type LogLevel = 'INFO' | 'WARNING' | 'ERROR' | 'DEBUG';

  interface LogEntry {
    id: string;
    project_id: string | null;
    level: LogLevel;
    source: string;
    message: string;
    created_at: string;
  }

  type ExplorerEntryType = 'file' | 'folder';

  interface ExplorerEntry {
    name: string;
    path: string;
    type: ExplorerEntryType;
  }

  interface SearchMatch {
    path: string;
    line: number;
    column: number;
    lineText: string;
  }

  interface SearchOptions {
    caseSensitive?: boolean;
    useRegex?: boolean;
  }

  interface ProjectRecord {
    id: string;
    name: string;
    path: string;
    description: string | null;
    created_at: string;
    updated_at: string;
    last_opened_at: string | null;
  }

  type AiProviderId = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'deepseek' | 'grok' | 'custom';

  interface AiProviderInfo {
    id: string;
    display_name: string;
    requires_api_key: boolean;
    supports_base_url: boolean;
  }

  interface ProviderSettings {
    provider_id: string;
    enabled: boolean;
    base_url: string | null;
    default_model: string | null;
    last_used_model: string | null;
    last_used_at: string | null;
    last_connection_status: 'untested' | 'ok' | 'error';
    last_connection_message: string | null;
    last_connection_at: string | null;
  }

  interface ConnectionTestResult {
    ok: boolean;
    message: string;
  }

  interface OllamaModelInfo {
    name: string;
    size_bytes: number;
    modified_at: string | null;
  }

  interface OllamaStatus {
    installed: boolean;
    server_running: boolean;
    host: string;
    models: OllamaModelInfo[];
  }

  type AgentDefaultRoleKey = 'planner' | 'developer' | 'reviewer' | 'tester' | 'documentation';

  interface AgentProviderDefault {
    agent_role: AgentDefaultRoleKey;
    provider: string;
    model: string;
    updated_at: string;
  }

  interface ProviderDashboardEntry {
    provider_id: string;
    display_name: string;
    enabled: boolean;
    requires_api_key: boolean;
    configured: boolean;
    default_model: string | null;
    last_used_model: string | null;
    last_used_at: string | null;
    last_connection_status: 'untested' | 'ok' | 'error';
    last_connection_message: string | null;
    requests: number;
    prompt_tokens: number;
    completion_tokens: number;
    estimated_cost_usd: number | null;
    avg_latency_ms: number | null;
    errors: number;
  }

  interface AiConversation {
    id: string;
    project_id: string | null;
    title: string;
    provider: string;
    model: string;
    agent_id: string | null;
    task_id: string | null;
    created_at: string;
    updated_at: string;
  }

  interface AiContextRef {
    path: string;
    start_line: number | null;
    end_line: number | null;
  }

  type AiMessageRole = 'user' | 'assistant' | 'system';
  type AiMessageStatus = 'complete' | 'cancelled' | 'error';

  interface AiMessage {
    id: string;
    conversation_id: string;
    role: AiMessageRole;
    content: string;
    provider: string | null;
    model: string | null;
    status: AiMessageStatus;
    error_message: string | null;
    prompt_tokens: number | null;
    completion_tokens: number | null;
    context_refs: AiContextRef[] | null;
    latency_ms: number | null;
    created_at: string;
  }

  interface AiContextRefInput {
    path: string;
    content: string;
    startLine?: number;
    endLine?: number;
  }

  type AiStreamEventName = 'chunk' | 'usage' | 'done' | 'error';

  interface AiStreamEventPayload {
    requestId: string;
    event: AiStreamEventName;
    data: Record<string, unknown>;
  }

  interface AgentInfo {
    id: string;
    name: string;
    role_file: string;
    enabled: boolean;
  }

  type AgentRoleKey = 'planner' | 'developer' | 'reviewer' | 'tester';
  type AgentTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

  interface ProposedFile {
    path: string;
    content: string;
  }

  interface AgentTask {
    id: string;
    project_id: string | null;
    title: string;
    description: string;
    agent_role: AgentRoleKey;
    status: AgentTaskStatus;
    priority: number;
    depends_on_task_id: string | null;
    provider: string;
    model: string;
    conversation_id: string | null;
    retry_count: number;
    max_retries: number;
    result_summary: string | null;
    proposed_files: ProposedFile[] | null;
    error_message: string | null;
    workflow_id: string | null;
    milestone_id: string | null;
    requires_approval: boolean;
    approved_at: string | null;
    proposed_files_applied: boolean;
    conflict_warning: string | null;
    live_output: string | null;
    rolled_back_at: string | null;
    // Sprint 16: Task Router / Multi-AI Subscription Coding Control Center.
    execution_backend: 'api' | 'cli';
    cli_tool_id: CliToolId | null;
    files_changed: string[] | null;
    cli_exit_code: number | null;
    created_at: string;
    updated_at: string;
    started_at: string | null;
    completed_at: string | null;
  }

  // --- Sprint 16: Multi-AI Subscription Coding Control Center ---

  type CliToolId = 'codex-cli' | 'claude-code-cli' | 'gemini-cli';
  type ExecutionMode = 'auto' | CliToolId;

  interface CliToolStatus {
    id: CliToolId;
    display_name: string;
    installed: boolean;
    binary_path: string | null;
    version: string | null;
    authenticated: boolean | null;
    available: boolean;
    roles: AgentRoleKey[];
    role_note: string;
  }

  interface ExecutionPolicy {
    mode: ExecutionMode;
    subscription_first: boolean;
    updated_at: string | null;
  }

  interface ExecutionDecision {
    available: boolean;
    backend: 'api' | 'cli' | null;
    execution_id: string | null;
    display_name: string | null;
    fallback_used: boolean;
    reason: string;
  }

  interface CliOutputEvent {
    taskId: string;
    stream: 'stdout' | 'stderr';
    chunk: string;
  }

  interface FileSnapshotInput {
    path: string;
    previousContent: string | null;
  }

  interface RollbackFile {
    path: string;
    previous_content: string | null;
  }

  interface RollbackInfo {
    task_id: string;
    files: RollbackFile[];
  }

  type WorkflowStatus =
    'planning' | 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  type ApprovalMode = 'auto' | 'review' | 'manual';
  type MilestoneStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  type RiskLevel = 'low' | 'medium' | 'high' | 'unknown';

  interface Milestone {
    id: string;
    workflow_id: string;
    title: string;
    description: string;
    order_index: number;
    status: MilestoneStatus;
    created_at: string;
    updated_at: string;
  }

  interface TestResult {
    passed: boolean;
    exit_code: number | null;
    output_tail: string | null;
    ran_at: string;
  }

  interface Workflow {
    id: string;
    project_id: string | null;
    title: string;
    goal: string;
    status: WorkflowStatus;
    approval_mode: ApprovalMode;
    provider: string;
    model: string;
    conversation_id: string | null;
    error_message: string | null;
    documentation: string | null;
    documentation_generated_at: string | null;
    last_test_result: TestResult | null;
    created_at: string;
    updated_at: string;
    started_at: string | null;
    completed_at: string | null;
  }

  interface WorkflowDetail extends Workflow {
    milestones: Milestone[];
    tasks: AgentTask[];
  }

  interface FeatureSummary {
    workflow_id: string;
    files_changed: string[];
    files_created: string[];
    files_removed: string[];
    test_result: TestResult | null;
    risk_level: RiskLevel;
  }

  interface ResourceUsage {
    memoryMb: number;
    cpuPercent: number | null;
  }

  interface SystemMetrics {
    cpu: { usedPercent: number | null; cores: number };
    memory: { totalMb: number; freeMb: number; usedPercent: number };
    disk: { totalMb: number | null; freeMb: number | null; usedPercent: number | null };
    electronMemoryMb: number;
  }

  interface GitCommit {
    hash: string;
    message: string;
    author: string;
    date: string;
  }

  interface GitStatus {
    isRepo: boolean;
    branch: string | null;
    isDirty: boolean;
    ahead: number | null;
    behind: number | null;
    lastCommit: GitCommit | null;
    recentCommits: GitCommit[];
  }

  type RunnerId = 'build' | 'test' | 'verify';
  type RunnerState = 'idle' | 'running' | 'success' | 'failed' | 'cancelled';

  interface RunnerOutputEvent {
    runnerId: RunnerId;
    stream: 'stdout' | 'stderr';
    chunk: string;
  }

  interface RunnerStatusEvent {
    runnerId: RunnerId;
    state: RunnerState;
    exitCode: number | null;
  }

  interface AvailableRunners {
    build: boolean;
    test: boolean;
  }

  interface PerformanceStats {
    total_tasks: number;
    completed_tasks: number;
    failed_tasks: number;
    success_rate: number | null;
    failure_rate: number | null;
    retry_rate: number | null;
    avg_task_seconds: number | null;
    avg_agent_seconds: Record<string, number | null>;
    tasks_completed_last_hour: number;
  }

  interface TokenWindowStats {
    by_provider: Record<
      string,
      { prompt_tokens: number; completion_tokens: number; estimated_cost_usd: number | null }
    >;
    total_prompt_tokens: number;
    total_completion_tokens: number;
    total_estimated_cost_usd: number | null;
  }

  interface TokenStats {
    session: TokenWindowStats;
    day: TokenWindowStats;
    month: TokenWindowStats;
  }

  interface HistoryEntry {
    id: string;
    project_id: string | null;
    entity_type: string;
    entity_id: string;
    action: 'created' | 'updated' | 'deleted';
    snapshot: Record<string, unknown>;
    created_at: string;
  }

  type KnowledgeNodeType =
    | 'project'
    | 'file'
    | 'function'
    | 'class'
    | 'agent'
    | 'workflow'
    | 'commit'
    | 'user'
    | 'requirement';
  type KnowledgeRelationship =
    | 'contains'
    | 'defines'
    | 'imports'
    | 'modifies'
    | 'executed_by'
    | 'authored_by'
    | 'implements'
    | 'related_to';

  interface GraphNode {
    id: string;
    project_id: string | null;
    node_type: KnowledgeNodeType;
    label: string;
    ref_id: string | null;
    metadata: Record<string, unknown> | null;
  }

  interface GraphEdge {
    id: string;
    project_id: string | null;
    from_node_id: string;
    to_node_id: string;
    relationship: KnowledgeRelationship;
  }

  interface KnowledgeGraph {
    nodes: GraphNode[];
    edges: GraphEdge[];
  }

  interface KnowledgeStats {
    nodes_by_type: Record<string, number>;
    total_nodes: number;
    total_edges: number;
    files_indexed: number;
    embeddings_count: number;
  }

  interface IndexResult {
    files_indexed: number;
    files_removed: number;
    functions_found: number;
    classes_found: number;
    edges_created: number;
    commits_indexed: number;
    truncated: boolean;
    duration_ms: number;
    errors: string[];
  }

  interface EmbeddingProviderInfo {
    id: string;
    display_name: string;
    requires_api_key: boolean;
    default_model: string;
  }

  interface EmbedResult {
    embedded: number;
    skipped_unchanged: number;
    failed: number;
    provider: string;
    model: string;
  }

  type KnowledgeSearchMode = 'semantic' | 'keyword_fallback';

  interface SearchHit {
    entity_type: string;
    entity_id: string;
    score: number;
    preview: string;
  }

  interface SearchResult {
    mode: KnowledgeSearchMode;
    fallback_reason: string | null;
    hits: SearchHit[];
  }

  interface ImpactResult {
    file: string;
    found: boolean;
    dependents: string[];
    defines: string[];
    related_bugs: string[];
    risk_score: number;
    risk_label: string;
  }

  interface DiagramResult {
    mermaid: string;
    node_count: number;
    edge_count: number;
    truncated: boolean;
  }

  interface FileContext {
    file: string;
    found_in_graph: boolean;
    imported_by: string[];
    defines: string[];
    related_memory: Array<{ type: string; key: string; value: string; updated_at: string }>;
    risk_score: number;
    risk_label: string;
  }

  type MemoryEntryType = 'project' | 'conversation' | 'long_term' | 'task' | 'knowledge';

  interface MemoryEntry {
    id: string;
    project_id: string | null;
    type: string;
    key: string;
    value: string;
    created_at: string;
    updated_at: string;
  }

  interface Window {
    nemi: {
      windowControls: {
        minimize: () => Promise<void>;
        maximizeToggle: () => Promise<void>;
        close: () => Promise<void>;
        isMaximized: () => Promise<boolean>;
        onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void;
      };
      backend: {
        health: () => Promise<BackendHealth>;
        logs: (limit?: number) => Promise<LogEntry[]>;
        getFullHealth: () => Promise<FullHealthResponse>;
        getAppInfo: () => Promise<AppInfo>;
        restart: () => Promise<void>;
      };
      fs: {
        selectProjectFolder: () => Promise<string | null>;
        selectDirectory: () => Promise<string | null>;
        openProject: (projectPath: string) => Promise<boolean>;
        closeProject: () => Promise<void>;
        listDirectory: (dirPath: string) => Promise<ExplorerEntry[]>;
        readFile: (filePath: string) => Promise<string>;
        writeFile: (filePath: string, content: string) => Promise<void>;
        createFile: (dirPath: string, name: string) => Promise<string>;
        createDirectory: (parentPath: string, name: string) => Promise<string>;
        renameEntry: (entryPath: string, newName: string) => Promise<string>;
        deleteEntry: (entryPath: string) => Promise<void>;
        listAllFiles: (rootPath: string) => Promise<string[]>;
        searchInFiles: (
          rootPath: string,
          query: string,
          options?: SearchOptions,
        ) => Promise<SearchMatch[]>;
        onChange: (callback: (event: { path: string }) => void) => () => void;
      };
      projects: {
        listRecent: (limit?: number) => Promise<ProjectRecord[]>;
        recordOpened: (path: string, name: string, description?: string) => Promise<ProjectRecord>;
        remove: (id: string) => Promise<void>;
      };
      ai: {
        listProviders: () => Promise<AiProviderInfo[]>;
        listOllamaModels: () => Promise<string[]>;
        hasApiKey: (provider: AiProviderId) => Promise<boolean>;
        setApiKey: (provider: AiProviderId, apiKey: string) => Promise<void>;
        clearApiKey: (provider: AiProviderId) => Promise<void>;
        listConversations: (projectId: string | null) => Promise<AiConversation[]>;
        createConversation: (input: {
          projectId: string | null;
          title: string;
          provider: string;
          model: string;
        }) => Promise<AiConversation>;
        renameConversation: (id: string, title: string) => Promise<AiConversation>;
        deleteConversation: (id: string) => Promise<void>;
        listMessages: (conversationId: string) => Promise<AiMessage[]>;
        sendMessage: (
          requestId: string,
          input: {
            conversationId: string;
            content: string;
            provider: string;
            model: string;
            baseUrl?: string | null;
            contextRefs?: AiContextRefInput[];
          },
        ) => Promise<void>;
        cancelMessage: (requestId: string) => Promise<boolean>;
        onStreamEvent: (callback: (payload: AiStreamEventPayload) => void) => () => void;
      };
      providers: {
        listSettings: () => Promise<ProviderSettings[]>;
        getSettings: (providerId: string) => Promise<ProviderSettings>;
        updateSettings: (
          providerId: string,
          update: { enabled?: boolean; baseUrl?: string | null; defaultModel?: string | null },
        ) => Promise<ProviderSettings>;
        testConnection: (
          providerId: string,
          baseUrl: string | null,
        ) => Promise<ConnectionTestResult>;
        refreshModels: (providerId: string, baseUrl: string | null) => Promise<string[]>;
        listFavorites: (providerId: string) => Promise<string[]>;
        setFavorite: (providerId: string, modelId: string, favorite: boolean) => Promise<string[]>;
        getDashboard: () => Promise<ProviderDashboardEntry[]>;
        getOllamaStatus: (baseUrl?: string | null) => Promise<OllamaStatus>;
        pullOllamaModel: (
          model: string,
          baseUrl?: string | null,
        ) => Promise<Record<string, unknown>>;
        deleteOllamaModel: (model: string, baseUrl?: string | null) => Promise<void>;
        listAgentDefaults: () => Promise<AgentProviderDefault[]>;
        setAgentDefault: (
          agentRole: string,
          provider: string,
          model: string,
        ) => Promise<AgentProviderDefault>;
        clearAgentDefault: (agentRole: string) => Promise<void>;
      };
      agents: {
        list: () => Promise<AgentInfo[]>;
        listTasks: (projectId: string | null) => Promise<AgentTask[]>;
        getTask: (taskId: string) => Promise<AgentTask>;
        createPipeline: (input: {
          projectId: string | null;
          title: string;
          description: string;
          provider: string;
          model: string;
          priority?: number;
          stages?: AgentRoleKey[];
          useTaskRouter?: boolean;
        }) => Promise<AgentTask[]>;
        cancelTask: (taskId: string) => Promise<void>;
        retryTask: (taskId: string) => Promise<AgentTask>;
        approveTask: (taskId: string) => Promise<AgentTask>;
        markFilesApplied: (taskId: string, snapshots?: FileSnapshotInput[]) => Promise<AgentTask>;
        getRollbackInfo: (taskId: string) => Promise<RollbackInfo>;
        markRolledBack: (taskId: string) => Promise<AgentTask>;
        onTasksChanged: (callback: () => void) => () => void;
      };
      cliTools: {
        getStatus: () => Promise<CliToolStatus[]>;
        getExecutionPolicy: () => Promise<ExecutionPolicy>;
        updateExecutionPolicy: (update: {
          mode?: ExecutionMode;
          subscriptionFirst?: boolean;
        }) => Promise<ExecutionPolicy>;
        resolveExecution: (input: {
          role: AgentRoleKey;
          apiProviderId?: string | null;
          apiProviderDisplayName?: string | null;
          apiProviderConfigured?: boolean;
        }) => Promise<ExecutionDecision>;
        isDispatchActive: () => Promise<boolean>;
        cancelDispatch: (taskId: string) => Promise<boolean>;
        onOutput: (callback: (event: CliOutputEvent) => void) => () => void;
      };
      workflows: {
        list: (projectId: string | null) => Promise<Workflow[]>;
        get: (workflowId: string) => Promise<WorkflowDetail>;
        create: (input: {
          projectId: string | null;
          title: string;
          goal: string;
          provider: string;
          model: string;
          approvalMode: ApprovalMode;
        }) => Promise<Workflow>;
        pause: (workflowId: string) => Promise<Workflow>;
        resume: (workflowId: string) => Promise<Workflow>;
        cancel: (workflowId: string) => Promise<Workflow>;
        restart: (workflowId: string) => Promise<Workflow>;
        recordTestResult: (
          workflowId: string,
          result: { passed: boolean; exitCode: number | null; outputTail: string | null },
        ) => Promise<Workflow>;
        getSummary: (workflowId: string) => Promise<FeatureSummary>;
      };
      system: {
        getResourceUsage: () => Promise<ResourceUsage | null>;
        getMetrics: (projectPath: string) => Promise<SystemMetrics>;
      };
      git: {
        getStatus: (projectPath: string) => Promise<GitStatus>;
      };
      build: {
        detectRunners: (projectPath: string) => Promise<AvailableRunners>;
        runBuild: (projectPath: string) => Promise<RunnerStatusEvent>;
        runTests: (projectPath: string) => Promise<RunnerStatusEvent>;
        runVerification: (projectPath: string) => Promise<RunnerStatusEvent>;
        cancelRunner: (runnerId: RunnerId) => Promise<boolean>;
        onOutput: (callback: (event: RunnerOutputEvent) => void) => () => void;
      };
      stats: {
        getPerformance: (projectId: string | null) => Promise<PerformanceStats>;
        getTokens: () => Promise<TokenStats>;
        getHistory: (projectId: string | null, limit?: number) => Promise<HistoryEntry[]>;
      };
      knowledge: {
        index: (projectId: string, projectPath: string) => Promise<IndexResult>;
        getGraph: (projectId: string) => Promise<KnowledgeGraph>;
        getStats: (projectId: string) => Promise<KnowledgeStats>;
        listEmbeddingProviders: () => Promise<EmbeddingProviderInfo[]>;
        generateEmbeddings: (input: {
          projectId: string;
          projectPath: string;
          provider: string;
          model: string;
        }) => Promise<EmbedResult>;
        search: (input: {
          projectId: string;
          query: string;
          provider?: string | null;
          model?: string | null;
        }) => Promise<SearchResult>;
        getImpact: (projectId: string, file: string) => Promise<ImpactResult>;
        getFileContext: (projectId: string, file: string) => Promise<FileContext>;
        getFileHistory: (projectPath: string, file: string) => Promise<string>;
        getDiagram: (
          projectId: string,
          type: 'dependency' | 'architecture',
        ) => Promise<DiagramResult>;
        listMemory: (projectId: string | null, type: MemoryEntryType) => Promise<MemoryEntry[]>;
      };
    };
  }
}
