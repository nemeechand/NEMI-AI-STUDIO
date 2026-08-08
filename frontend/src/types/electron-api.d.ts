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

  type AiProviderId = 'openai' | 'anthropic' | 'gemini' | 'ollama';

  interface AiProviderInfo {
    id: string;
    display_name: string;
    requires_api_key: boolean;
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
    created_at: string;
    updated_at: string;
    started_at: string | null;
    completed_at: string | null;
  }

  type WorkflowStatus =
    'planning' | 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  type ApprovalMode = 'auto' | 'review' | 'manual';
  type MilestoneStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

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
    created_at: string;
    updated_at: string;
    started_at: string | null;
    completed_at: string | null;
  }

  interface WorkflowDetail extends Workflow {
    milestones: Milestone[];
    tasks: AgentTask[];
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
            contextRefs?: AiContextRefInput[];
          },
        ) => Promise<void>;
        cancelMessage: (requestId: string) => Promise<boolean>;
        onStreamEvent: (callback: (payload: AiStreamEventPayload) => void) => () => void;
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
        }) => Promise<AgentTask[]>;
        cancelTask: (taskId: string) => Promise<void>;
        retryTask: (taskId: string) => Promise<AgentTask>;
        approveTask: (taskId: string) => Promise<AgentTask>;
        markFilesApplied: (taskId: string) => Promise<AgentTask>;
        onTasksChanged: (callback: () => void) => () => void;
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
    };
  }
}
