import { contextBridge, ipcRenderer } from 'electron';
import type { BackendHealth, ResourceUsage } from './backend-process';
import type { LogEntry, ProjectRecord } from './backend-client';
import type { ExplorerEntry, SearchMatch, SearchOptions } from './filesystem';
import type { ProviderId } from './ai-credentials';
import type {
  AiConversation,
  AiContextRefInput,
  AiMessage,
  AiProviderInfo,
  StreamEventPayload,
} from './ai-client';
import type {
  AgentInfo,
  AgentRoleKey,
  AgentTask,
  FileSnapshotInput,
  RollbackInfo,
} from './agent-client';
import type { ApprovalMode, FeatureSummary, Workflow, WorkflowDetail } from './workflow-client';
import type { GitStatus } from './git-status';
import type {
  AvailableRunners,
  RunnerId,
  RunnerOutputEvent,
  RunnerStatusEvent,
} from './build-runner';
import type { SystemMetrics } from './system-metrics';
import type { HistoryEntry, PerformanceStats, TokenStats } from './stats-client';
import type {
  DiagramResult,
  EmbedResult,
  EmbeddingProviderInfo,
  FileContext,
  ImpactResult,
  KnowledgeGraph,
  KnowledgeStats,
  IndexResult,
  MemoryEntry,
  SearchResult,
} from './knowledge-client';
import type {
  AgentProviderDefault,
  ConnectionTestResult,
  OllamaStatus,
  ProviderDashboardEntry,
  ProviderSettings,
} from './providers-client';

const backend = {
  health: (): Promise<BackendHealth> => ipcRenderer.invoke('backend:health'),
  logs: (limit?: number): Promise<LogEntry[]> => ipcRenderer.invoke('backend:logs', limit),
};

const fsApi = {
  selectProjectFolder: (): Promise<string | null> => ipcRenderer.invoke('fs:select-project-folder'),
  selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('fs:select-directory'),
  openProject: (projectPath: string): Promise<boolean> =>
    ipcRenderer.invoke('fs:open-project', projectPath),
  closeProject: (): Promise<void> => ipcRenderer.invoke('fs:close-project'),
  listDirectory: (dirPath: string): Promise<ExplorerEntry[]> =>
    ipcRenderer.invoke('fs:list-directory', dirPath),
  readFile: (filePath: string): Promise<string> => ipcRenderer.invoke('fs:read-file', filePath),
  writeFile: (filePath: string, content: string): Promise<void> =>
    ipcRenderer.invoke('fs:write-file', filePath, content),
  createFile: (dirPath: string, name: string): Promise<string> =>
    ipcRenderer.invoke('fs:create-file', dirPath, name),
  createDirectory: (parentPath: string, name: string): Promise<string> =>
    ipcRenderer.invoke('fs:create-directory', parentPath, name),
  renameEntry: (entryPath: string, newName: string): Promise<string> =>
    ipcRenderer.invoke('fs:rename-entry', entryPath, newName),
  deleteEntry: (entryPath: string): Promise<void> =>
    ipcRenderer.invoke('fs:delete-entry', entryPath),
  listAllFiles: (rootPath: string): Promise<string[]> =>
    ipcRenderer.invoke('fs:list-all-files', rootPath),
  searchInFiles: (
    rootPath: string,
    query: string,
    options?: SearchOptions,
  ): Promise<SearchMatch[]> => ipcRenderer.invoke('fs:search-in-files', rootPath, query, options),
  onChange: (callback: (event: { path: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { path: string }) =>
      callback(payload);
    ipcRenderer.on('fs:changed', listener);
    return () => ipcRenderer.removeListener('fs:changed', listener);
  },
};

const projects = {
  listRecent: (limit?: number): Promise<ProjectRecord[]> =>
    ipcRenderer.invoke('projects:list-recent', limit),
  recordOpened: (path: string, name: string, description?: string): Promise<ProjectRecord> =>
    ipcRenderer.invoke('projects:record-opened', path, name, description),
  remove: (id: string): Promise<void> => ipcRenderer.invoke('projects:remove', id),
};

const aiApi = {
  listProviders: (): Promise<AiProviderInfo[]> => ipcRenderer.invoke('ai:list-providers'),
  listOllamaModels: (): Promise<string[]> => ipcRenderer.invoke('ai:list-ollama-models'),
  hasApiKey: (provider: ProviderId): Promise<boolean> =>
    ipcRenderer.invoke('ai:has-api-key', provider),
  setApiKey: (provider: ProviderId, apiKey: string): Promise<void> =>
    ipcRenderer.invoke('ai:set-api-key', provider, apiKey),
  clearApiKey: (provider: ProviderId): Promise<void> =>
    ipcRenderer.invoke('ai:clear-api-key', provider),

  listConversations: (projectId: string | null): Promise<AiConversation[]> =>
    ipcRenderer.invoke('ai:list-conversations', projectId),
  createConversation: (input: {
    projectId: string | null;
    title: string;
    provider: string;
    model: string;
  }): Promise<AiConversation> => ipcRenderer.invoke('ai:create-conversation', input),
  renameConversation: (id: string, title: string): Promise<AiConversation> =>
    ipcRenderer.invoke('ai:rename-conversation', id, title),
  deleteConversation: (id: string): Promise<void> =>
    ipcRenderer.invoke('ai:delete-conversation', id),
  listMessages: (conversationId: string): Promise<AiMessage[]> =>
    ipcRenderer.invoke('ai:list-messages', conversationId),

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
  ): Promise<void> => ipcRenderer.invoke('ai:send-message', requestId, input),
  cancelMessage: (requestId: string): Promise<boolean> =>
    ipcRenderer.invoke('ai:cancel-message', requestId),
  onStreamEvent: (callback: (payload: StreamEventPayload) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: StreamEventPayload) =>
      callback(payload);
    ipcRenderer.on('ai:stream-event', listener);
    return () => ipcRenderer.removeListener('ai:stream-event', listener);
  },
};

const agentsApi = {
  list: (): Promise<AgentInfo[]> => ipcRenderer.invoke('agents:list'),
  listTasks: (projectId: string | null): Promise<AgentTask[]> =>
    ipcRenderer.invoke('agents:list-tasks', projectId),
  getTask: (taskId: string): Promise<AgentTask> => ipcRenderer.invoke('agents:get-task', taskId),
  createPipeline: (input: {
    projectId: string | null;
    title: string;
    description: string;
    provider: string;
    model: string;
    priority?: number;
    stages?: AgentRoleKey[];
  }): Promise<AgentTask[]> => ipcRenderer.invoke('agents:create-pipeline', input),
  cancelTask: (taskId: string): Promise<void> => ipcRenderer.invoke('agents:cancel-task', taskId),
  retryTask: (taskId: string): Promise<AgentTask> =>
    ipcRenderer.invoke('agents:retry-task', taskId),
  approveTask: (taskId: string): Promise<AgentTask> =>
    ipcRenderer.invoke('agents:approve-task', taskId),
  markFilesApplied: (taskId: string, snapshots?: FileSnapshotInput[]): Promise<AgentTask> =>
    ipcRenderer.invoke('agents:mark-files-applied', taskId, snapshots),
  getRollbackInfo: (taskId: string): Promise<RollbackInfo> =>
    ipcRenderer.invoke('agents:get-rollback-info', taskId),
  markRolledBack: (taskId: string): Promise<AgentTask> =>
    ipcRenderer.invoke('agents:mark-rolled-back', taskId),
  onTasksChanged: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('agents:tasks-changed', listener);
    return () => ipcRenderer.removeListener('agents:tasks-changed', listener);
  },
};

const workflowsApi = {
  list: (projectId: string | null): Promise<Workflow[]> =>
    ipcRenderer.invoke('workflows:list', projectId),
  get: (workflowId: string): Promise<WorkflowDetail> =>
    ipcRenderer.invoke('workflows:get', workflowId),
  create: (input: {
    projectId: string | null;
    title: string;
    goal: string;
    provider: string;
    model: string;
    approvalMode: ApprovalMode;
  }): Promise<Workflow> => ipcRenderer.invoke('workflows:create', input),
  pause: (workflowId: string): Promise<Workflow> =>
    ipcRenderer.invoke('workflows:pause', workflowId),
  resume: (workflowId: string): Promise<Workflow> =>
    ipcRenderer.invoke('workflows:resume', workflowId),
  cancel: (workflowId: string): Promise<Workflow> =>
    ipcRenderer.invoke('workflows:cancel', workflowId),
  restart: (workflowId: string): Promise<Workflow> =>
    ipcRenderer.invoke('workflows:restart', workflowId),
  recordTestResult: (
    workflowId: string,
    result: { passed: boolean; exitCode: number | null; outputTail: string | null },
  ): Promise<Workflow> => ipcRenderer.invoke('workflows:record-test-result', workflowId, result),
  getSummary: (workflowId: string): Promise<FeatureSummary> =>
    ipcRenderer.invoke('workflows:get-summary', workflowId),
};

const systemApi = {
  getResourceUsage: (): Promise<ResourceUsage | null> =>
    ipcRenderer.invoke('system:resource-usage'),
  getMetrics: (projectPath: string): Promise<SystemMetrics> =>
    ipcRenderer.invoke('system:get-metrics', projectPath),
};

const gitApi = {
  getStatus: (projectPath: string): Promise<GitStatus> =>
    ipcRenderer.invoke('git:status', projectPath),
};

const buildApi = {
  detectRunners: (projectPath: string): Promise<AvailableRunners> =>
    ipcRenderer.invoke('build:detect-runners', projectPath),
  runBuild: (projectPath: string): Promise<RunnerStatusEvent> =>
    ipcRenderer.invoke('build:run', projectPath),
  runTests: (projectPath: string): Promise<RunnerStatusEvent> =>
    ipcRenderer.invoke('build:test', projectPath),
  runVerification: (projectPath: string): Promise<RunnerStatusEvent> =>
    ipcRenderer.invoke('build:verify', projectPath),
  cancelRunner: (runnerId: RunnerId): Promise<boolean> =>
    ipcRenderer.invoke('build:cancel', runnerId),
  onOutput: (callback: (event: RunnerOutputEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: RunnerOutputEvent) =>
      callback(payload);
    ipcRenderer.on('build:output', listener);
    return () => ipcRenderer.removeListener('build:output', listener);
  },
};

const statsApi = {
  getPerformance: (projectId: string | null): Promise<PerformanceStats> =>
    ipcRenderer.invoke('stats:performance', projectId),
  getTokens: (): Promise<TokenStats> => ipcRenderer.invoke('stats:tokens'),
  getHistory: (projectId: string | null, limit?: number): Promise<HistoryEntry[]> =>
    ipcRenderer.invoke('stats:history', projectId, limit),
};

const knowledgeApi = {
  index: (projectId: string, projectPath: string): Promise<IndexResult> =>
    ipcRenderer.invoke('knowledge:index', projectId, projectPath),
  getGraph: (projectId: string): Promise<KnowledgeGraph> =>
    ipcRenderer.invoke('knowledge:get-graph', projectId),
  getStats: (projectId: string): Promise<KnowledgeStats> =>
    ipcRenderer.invoke('knowledge:get-stats', projectId),
  listEmbeddingProviders: (): Promise<EmbeddingProviderInfo[]> =>
    ipcRenderer.invoke('knowledge:list-embedding-providers'),
  generateEmbeddings: (input: {
    projectId: string;
    projectPath: string;
    provider: string;
    model: string;
  }): Promise<EmbedResult> => ipcRenderer.invoke('knowledge:generate-embeddings', input),
  search: (input: {
    projectId: string;
    query: string;
    provider?: string | null;
    model?: string | null;
  }): Promise<SearchResult> => ipcRenderer.invoke('knowledge:search', input),
  getImpact: (projectId: string, file: string): Promise<ImpactResult> =>
    ipcRenderer.invoke('knowledge:get-impact', projectId, file),
  getFileContext: (projectId: string, file: string): Promise<FileContext> =>
    ipcRenderer.invoke('knowledge:get-file-context', projectId, file),
  getFileHistory: (projectPath: string, file: string): Promise<string> =>
    ipcRenderer.invoke('knowledge:get-file-history', projectPath, file),
  getDiagram: (projectId: string, type: 'dependency' | 'architecture'): Promise<DiagramResult> =>
    ipcRenderer.invoke('knowledge:get-diagram', projectId, type),
  listMemory: (
    projectId: string | null,
    type: 'project' | 'conversation' | 'long_term' | 'task' | 'knowledge',
  ): Promise<MemoryEntry[]> => ipcRenderer.invoke('knowledge:list-memory', projectId, type),
};

const providersApi = {
  listSettings: (): Promise<ProviderSettings[]> => ipcRenderer.invoke('providers:list-settings'),
  getSettings: (providerId: string): Promise<ProviderSettings> =>
    ipcRenderer.invoke('providers:get-settings', providerId),
  updateSettings: (
    providerId: string,
    update: { enabled?: boolean; baseUrl?: string | null; defaultModel?: string | null },
  ): Promise<ProviderSettings> =>
    ipcRenderer.invoke('providers:update-settings', providerId, update),
  testConnection: (providerId: string, baseUrl: string | null): Promise<ConnectionTestResult> =>
    ipcRenderer.invoke('providers:test-connection', providerId, baseUrl),
  refreshModels: (providerId: string, baseUrl: string | null): Promise<string[]> =>
    ipcRenderer.invoke('providers:refresh-models', providerId, baseUrl),
  listFavorites: (providerId: string): Promise<string[]> =>
    ipcRenderer.invoke('providers:list-favorites', providerId),
  setFavorite: (providerId: string, modelId: string, favorite: boolean): Promise<string[]> =>
    ipcRenderer.invoke('providers:set-favorite', providerId, modelId, favorite),
  getDashboard: (): Promise<ProviderDashboardEntry[]> =>
    ipcRenderer.invoke('providers:get-dashboard'),
  getOllamaStatus: (baseUrl?: string | null): Promise<OllamaStatus> =>
    ipcRenderer.invoke('providers:ollama-status', baseUrl),
  pullOllamaModel: (model: string, baseUrl?: string | null): Promise<Record<string, unknown>> =>
    ipcRenderer.invoke('providers:ollama-pull', model, baseUrl),
  deleteOllamaModel: (model: string, baseUrl?: string | null): Promise<void> =>
    ipcRenderer.invoke('providers:ollama-delete', model, baseUrl),
  listAgentDefaults: (): Promise<AgentProviderDefault[]> =>
    ipcRenderer.invoke('providers:list-agent-defaults'),
  setAgentDefault: (
    agentRole: string,
    provider: string,
    model: string,
  ): Promise<AgentProviderDefault> =>
    ipcRenderer.invoke('providers:set-agent-default', agentRole, provider, model),
  clearAgentDefault: (agentRole: string): Promise<void> =>
    ipcRenderer.invoke('providers:clear-agent-default', agentRole),
};

const windowControls = {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximizeToggle: () => ipcRenderer.invoke('window:maximize-toggle'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, isMaximized: boolean) =>
      callback(isMaximized);
    ipcRenderer.on('window:maximized-change', listener);
    return () => ipcRenderer.removeListener('window:maximized-change', listener);
  },
};

contextBridge.exposeInMainWorld('nemi', {
  windowControls,
  backend,
  fs: fsApi,
  projects,
  ai: aiApi,
  providers: providersApi,
  agents: agentsApi,
  workflows: workflowsApi,
  system: systemApi,
  git: gitApi,
  build: buildApi,
  stats: statsApi,
  knowledge: knowledgeApi,
});
