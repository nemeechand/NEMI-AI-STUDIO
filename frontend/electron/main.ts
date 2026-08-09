import { app, BrowserWindow, ipcMain } from 'electron';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getBackendHealth,
  getBackendResourceUsage,
  restartBackend,
  startBackend,
  stopBackend,
} from './backend-process';
import {
  fetchFullHealth,
  fetchRecentLogs,
  fetchRecentProjects,
  recordProjectOpened,
  removeRecentProject,
} from './backend-client';
import {
  closeProject,
  createDirectory,
  createFile,
  deleteEntry,
  listAllFiles,
  listDirectory,
  openProject,
  readFile,
  renameEntry,
  searchInFiles,
  setChangeListener,
  writeFile,
  type SearchOptions,
} from './filesystem';
import { selectDirectory, selectProjectFolder } from './project-dialogs';
import { clearApiKey, getApiKey, hasApiKey, setApiKey, type ProviderId } from './ai-credentials';
import {
  cancelMessageStream,
  createConversation,
  deleteConversation,
  listAiProviders,
  listConversations,
  listOllamaModels,
  listMessages,
  renameConversation,
  streamMessage,
  type AiContextRefInput,
} from './ai-client';
import {
  clearAgentProviderDefault,
  deleteOllamaModel,
  getOllamaStatus,
  getProviderDashboard,
  getProviderSettings,
  listAgentProviderDefaults,
  listFavoriteModels,
  listProviderSettings,
  pullOllamaModel,
  refreshProviderModels,
  setAgentProviderDefault,
  setFavoriteModel,
  testProviderConnection,
  updateProviderSettings,
} from './providers-client';
import {
  approveAgentTask,
  cancelAgentTask,
  createAgentPipeline,
  getAgentTask,
  getRollbackInfo,
  listAgentTasks,
  listAgents,
  markAgentTaskFilesApplied,
  markAgentTaskRolledBack,
  retryAgentTask,
  runAgentCycle,
  type AgentRoleKey,
  type FileSnapshotInput,
} from './agent-client';
import {
  cancelWorkflow,
  createWorkflow,
  getFeatureSummary,
  getWorkflow,
  listWorkflows,
  pauseWorkflow,
  recordTestResult,
  restartWorkflow,
  resumeWorkflow,
  type ApprovalMode,
} from './workflow-client';
import { getGitStatus } from './git-status';
import {
  cancelRunner,
  detectAvailableRunners,
  runBuild,
  runTests,
  runVerification,
  type RunnerId,
} from './build-runner';
import { getSystemMetrics } from './system-metrics';
import { getHistory, getPerformanceStats, getTokenStats } from './stats-client';
import {
  generateEmbeddings,
  getDiagram,
  getFileContext,
  getFileHistorySummary,
  getGraph,
  getImpact,
  getStats as getKnowledgeStats,
  indexProject,
  listEmbeddingProviders,
  listMemory,
  searchKnowledge,
} from './knowledge-client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Sprint 15.6: `app.getVersion()` only reliably reads package.json's
// `version` field once the app is packaged (electron-builder embeds it
// into app.asar) — confirmed live during a production-stabilization
// audit that in dev mode it silently falls back to Electron's OWN
// version instead (e.g. "32.3.3"), which both StatusBar and the About
// tab would then have shown as the app's version. `app.getVersion()`
// has no public setter, so `app:get-info` (below) reads this resolved
// value directly instead of calling `app.getVersion()` at all.
function resolveAppVersion(): string {
  try {
    const packageJsonPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar', 'package.json')
      : path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { version: string };
    return packageJson.version;
  } catch {
    return app.getVersion();
  }
}

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    frame: false,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximized-change', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximized-change', false);
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) {
      event.preventDefault();
    }
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:maximize-toggle', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.handle('window:close', () => {
  mainWindow?.close();
});

ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false);

ipcMain.handle('backend:health', () => getBackendHealth());
ipcMain.handle('backend:logs', (_event, limit?: number) => fetchRecentLogs(limit));
ipcMain.handle('backend:get-full-health', () => fetchFullHealth());
ipcMain.handle('backend:restart', () => restartBackend());
// Sprint 15.6: one real source of truth for the running app's version —
// `app.getVersion()` reads package.json's `version` field, the same
// value electron-builder stamps into the installer/portable artifact
// names, rather than a second hand-maintained copy (About tab previously
// had its own hardcoded string that had already drifted from it).
ipcMain.handle('app:get-info', () => ({
  appVersion: resolveAppVersion(),
  electronVersion: process.versions.electron,
  chromeVersion: process.versions.chrome,
  nodeVersion: process.versions.node,
  platform: process.platform,
}));

ipcMain.handle('fs:select-project-folder', () => {
  if (!mainWindow) return null;
  return selectProjectFolder(mainWindow);
});
ipcMain.handle('fs:select-directory', () => {
  if (!mainWindow) return null;
  return selectDirectory(mainWindow);
});
ipcMain.handle('fs:open-project', (_event, projectPath: string) => openProject(projectPath));
ipcMain.handle('fs:close-project', () => closeProject());
ipcMain.handle('fs:list-directory', (_event, dirPath: string) => listDirectory(dirPath));
ipcMain.handle('fs:read-file', (_event, filePath: string) => readFile(filePath));
ipcMain.handle('fs:write-file', (_event, filePath: string, content: string) =>
  writeFile(filePath, content),
);
ipcMain.handle('fs:create-file', (_event, dirPath: string, name: string) =>
  createFile(dirPath, name),
);
ipcMain.handle('fs:create-directory', (_event, parentPath: string, name: string) =>
  createDirectory(parentPath, name),
);
ipcMain.handle('fs:rename-entry', (_event, entryPath: string, newName: string) =>
  renameEntry(entryPath, newName),
);
ipcMain.handle('fs:delete-entry', (_event, entryPath: string) => deleteEntry(entryPath));
ipcMain.handle('fs:list-all-files', (_event, rootPath: string) => listAllFiles(rootPath));
ipcMain.handle(
  'fs:search-in-files',
  (_event, rootPath: string, query: string, options?: SearchOptions) =>
    searchInFiles(rootPath, query, options),
);

ipcMain.handle('projects:list-recent', (_event, limit?: number) => fetchRecentProjects(limit));
ipcMain.handle(
  'projects:record-opened',
  (_event, path: string, name: string, description?: string) =>
    recordProjectOpened(path, name, description),
);
ipcMain.handle('projects:remove', (_event, id: string) => removeRecentProject(id));

ipcMain.handle('ai:list-providers', () => listAiProviders());
ipcMain.handle('ai:list-ollama-models', () => listOllamaModels());
ipcMain.handle('ai:has-api-key', (_event, provider: ProviderId) => hasApiKey(provider));
ipcMain.handle('ai:set-api-key', (_event, provider: ProviderId, apiKey: string) =>
  setApiKey(provider, apiKey),
);
ipcMain.handle('ai:clear-api-key', (_event, provider: ProviderId) => clearApiKey(provider));

ipcMain.handle('ai:list-conversations', (_event, projectId: string | null) =>
  listConversations(projectId),
);
ipcMain.handle(
  'ai:create-conversation',
  (_event, input: { projectId: string | null; title: string; provider: string; model: string }) =>
    createConversation(input),
);
ipcMain.handle('ai:rename-conversation', (_event, id: string, title: string) =>
  renameConversation(id, title),
);
ipcMain.handle('ai:delete-conversation', (_event, id: string) => deleteConversation(id));
ipcMain.handle('ai:list-messages', (_event, conversationId: string) =>
  listMessages(conversationId),
);

ipcMain.handle(
  'ai:send-message',
  async (
    _event,
    requestId: string,
    input: {
      conversationId: string;
      content: string;
      provider: string;
      model: string;
      baseUrl?: string | null;
      contextRefs?: AiContextRefInput[];
    },
  ) => {
    const apiKey = await getApiKey(input.provider as ProviderId);
    await streamMessage(requestId, { ...input, apiKey }, (payload) => {
      mainWindow?.webContents.send('ai:stream-event', payload);
    });
  },
);
ipcMain.handle('ai:cancel-message', (_event, requestId: string) => cancelMessageStream(requestId));

// Sprint 15.5: AI Provider Management. Settings CRUD, model favorites,
// Ollama management, and the dashboard aggregation all go straight to the
// backend (no secrets involved). Only `providers:test-connection` needs
// main-process involvement — it's the one call that needs the real
// decrypted API key, which the renderer must never see.
ipcMain.handle('providers:list-settings', () => listProviderSettings());
ipcMain.handle('providers:get-settings', (_event, providerId: string) =>
  getProviderSettings(providerId),
);
ipcMain.handle(
  'providers:update-settings',
  (
    _event,
    providerId: string,
    update: { enabled?: boolean; baseUrl?: string | null; defaultModel?: string | null },
  ) => updateProviderSettings(providerId, update),
);
ipcMain.handle(
  'providers:test-connection',
  async (_event, providerId: string, baseUrl: string | null) => {
    const apiKey = await getApiKey(providerId as ProviderId);
    return testProviderConnection(providerId, { apiKey, baseUrl });
  },
);
ipcMain.handle(
  'providers:refresh-models',
  async (_event, providerId: string, baseUrl: string | null) => {
    const apiKey = await getApiKey(providerId as ProviderId);
    return refreshProviderModels(providerId, { apiKey, baseUrl });
  },
);
ipcMain.handle('providers:list-favorites', (_event, providerId: string) =>
  listFavoriteModels(providerId),
);
ipcMain.handle(
  'providers:set-favorite',
  (_event, providerId: string, modelId: string, favorite: boolean) =>
    setFavoriteModel(providerId, modelId, favorite),
);
ipcMain.handle('providers:get-dashboard', () => getProviderDashboard());
ipcMain.handle('providers:ollama-status', (_event, baseUrl?: string | null) =>
  getOllamaStatus(baseUrl),
);
ipcMain.handle('providers:ollama-pull', (_event, model: string, baseUrl?: string | null) =>
  pullOllamaModel(model, baseUrl),
);
ipcMain.handle('providers:ollama-delete', (_event, model: string, baseUrl?: string | null) =>
  deleteOllamaModel(model, baseUrl),
);
ipcMain.handle('providers:list-agent-defaults', () => listAgentProviderDefaults());
ipcMain.handle(
  'providers:set-agent-default',
  (_event, agentRole: string, provider: string, model: string) =>
    setAgentProviderDefault(agentRole, provider, model),
);
ipcMain.handle('providers:clear-agent-default', (_event, agentRole: string) =>
  clearAgentProviderDefault(agentRole),
);

ipcMain.handle('agents:list', () => listAgents());
ipcMain.handle('agents:list-tasks', (_event, projectId: string | null) =>
  listAgentTasks(projectId),
);
ipcMain.handle('agents:get-task', (_event, taskId: string) => getAgentTask(taskId));
ipcMain.handle(
  'agents:create-pipeline',
  (
    _event,
    input: {
      projectId: string | null;
      title: string;
      description: string;
      provider: string;
      model: string;
      priority?: number;
      stages?: AgentRoleKey[];
    },
  ) => createAgentPipeline(input),
);
ipcMain.handle('agents:cancel-task', (_event, taskId: string) => cancelAgentTask(taskId));
ipcMain.handle('agents:retry-task', (_event, taskId: string) => retryAgentTask(taskId));
ipcMain.handle('agents:approve-task', (_event, taskId: string) => approveAgentTask(taskId));
ipcMain.handle(
  'agents:mark-files-applied',
  (_event, taskId: string, snapshots?: FileSnapshotInput[]) =>
    markAgentTaskFilesApplied(taskId, snapshots),
);
ipcMain.handle('agents:get-rollback-info', (_event, taskId: string) => getRollbackInfo(taskId));
ipcMain.handle('agents:mark-rolled-back', (_event, taskId: string) =>
  markAgentTaskRolledBack(taskId),
);

ipcMain.handle('workflows:list', (_event, projectId: string | null) => listWorkflows(projectId));
ipcMain.handle('workflows:get', (_event, workflowId: string) => getWorkflow(workflowId));
ipcMain.handle(
  'workflows:create',
  (
    _event,
    input: {
      projectId: string | null;
      title: string;
      goal: string;
      provider: string;
      model: string;
      approvalMode: ApprovalMode;
    },
  ) => createWorkflow(input),
);
ipcMain.handle('workflows:pause', (_event, workflowId: string) => pauseWorkflow(workflowId));
ipcMain.handle('workflows:resume', (_event, workflowId: string) => resumeWorkflow(workflowId));
ipcMain.handle('workflows:cancel', (_event, workflowId: string) => cancelWorkflow(workflowId));
ipcMain.handle('workflows:restart', (_event, workflowId: string) => restartWorkflow(workflowId));
ipcMain.handle(
  'workflows:record-test-result',
  (
    _event,
    workflowId: string,
    result: { passed: boolean; exitCode: number | null; outputTail: string | null },
  ) => recordTestResult(workflowId, result),
);
ipcMain.handle('workflows:get-summary', (_event, workflowId: string) =>
  getFeatureSummary(workflowId),
);

ipcMain.handle('system:resource-usage', () => getBackendResourceUsage());
ipcMain.handle('system:get-metrics', (_event, projectPath: string) =>
  getSystemMetrics(projectPath),
);

ipcMain.handle('git:status', (_event, projectPath: string) => getGitStatus(projectPath));

ipcMain.handle('build:detect-runners', (_event, projectPath: string) =>
  detectAvailableRunners(projectPath),
);
function runnerOutput(event: { runnerId: RunnerId; stream: string; chunk: string }): void {
  mainWindow?.webContents.send('build:output', event);
}
ipcMain.handle('build:run', async (_event, projectPath: string) =>
  runBuild(projectPath, runnerOutput),
);
ipcMain.handle('build:test', async (_event, projectPath: string) =>
  runTests(projectPath, runnerOutput),
);
ipcMain.handle('build:verify', async (_event, projectPath: string) =>
  runVerification(projectPath, runnerOutput),
);
ipcMain.handle('build:cancel', (_event, runnerId: RunnerId) => cancelRunner(runnerId));

ipcMain.handle('stats:performance', (_event, projectId: string | null) =>
  getPerformanceStats(projectId),
);
ipcMain.handle('stats:tokens', () => getTokenStats());
ipcMain.handle('stats:history', (_event, projectId: string | null, limit?: number) =>
  getHistory(projectId, limit),
);

ipcMain.handle('knowledge:index', (_event, projectId: string, projectPath: string) =>
  indexProject(projectId, projectPath),
);
ipcMain.handle('knowledge:get-graph', (_event, projectId: string) => getGraph(projectId));
ipcMain.handle('knowledge:get-stats', (_event, projectId: string) => getKnowledgeStats(projectId));
ipcMain.handle('knowledge:list-embedding-providers', () => listEmbeddingProviders());
ipcMain.handle(
  'knowledge:generate-embeddings',
  async (
    _event,
    input: { projectId: string; projectPath: string; provider: string; model: string },
  ) => {
    const apiKey = await getApiKey(input.provider as ProviderId);
    return generateEmbeddings({ ...input, apiKey });
  },
);
ipcMain.handle(
  'knowledge:search',
  async (
    _event,
    input: { projectId: string; query: string; provider?: string | null; model?: string | null },
  ) => {
    const apiKey = input.provider ? await getApiKey(input.provider as ProviderId) : null;
    return searchKnowledge({ ...input, apiKey });
  },
);
ipcMain.handle('knowledge:get-impact', (_event, projectId: string, file: string) =>
  getImpact(projectId, file),
);
ipcMain.handle('knowledge:get-file-context', (_event, projectId: string, file: string) =>
  getFileContext(projectId, file),
);
ipcMain.handle('knowledge:get-file-history', (_event, projectPath: string, file: string) =>
  getFileHistorySummary(projectPath, file),
);
ipcMain.handle(
  'knowledge:get-diagram',
  (_event, projectId: string, type: 'dependency' | 'architecture') => getDiagram(projectId, type),
);
ipcMain.handle(
  'knowledge:list-memory',
  (
    _event,
    projectId: string | null,
    type: 'project' | 'conversation' | 'long_term' | 'task' | 'knowledge',
  ) => listMemory(projectId, type),
);

const AGENT_RUN_CYCLE_INTERVAL_MS = 4_000;
const AGENT_CYCLE_PROVIDERS: ProviderId[] = [
  'openai',
  'anthropic',
  'gemini',
  'deepseek',
  'grok',
  'custom',
];
let agentCycleTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Drives the agent task queue forward. Deliberately a steady interval
 * poll from Electron main, not a loop the backend runs on its own: API
 * keys are only ever decrypted here (safeStorage) and attached per
 * request, the same way ai:send-message already works — the backend
 * itself never persists or caches a key (Sprint 10's locked decision).
 * Ollama needs no key and is unaffected by whether any are configured.
 */
// Sprint 15.6: without this guard, an overlapping cycle (any batch of
// tasks that takes longer than AGENT_RUN_CYCLE_INTERVAL_MS to run — routine
// for a cloud LLM call) let `setInterval` fire a second `runAgentCycleOnce()`
// on top of the first, found during a production-stabilization audit.
// `AgentTasksRepository.mark_running()`'s atomic `WHERE status = 'queued'`
// claim (backend/app/db/repositories/agent_tasks_repository.py) already
// makes double-execution of the *same* task impossible even without this,
// but skipping the overlap entirely also avoids exceeding the intended
// `MAX_CONCURRENT_TASKS` cap and avoids pointless duplicate `/agents/
// run-cycle` traffic while a batch is still in flight.
let agentCycleInProgress = false;

async function runAgentCycleOnce(): Promise<void> {
  if (agentCycleInProgress) return;
  agentCycleInProgress = true;
  try {
    const apiKeys: Record<string, string> = {};
    for (const provider of AGENT_CYCLE_PROVIDERS) {
      const key = await getApiKey(provider);
      if (key) apiKeys[provider] = key;
    }
    const result = await runAgentCycle(apiKeys);
    if (result.started > 0) {
      mainWindow?.webContents.send('agents:tasks-changed', {});
    }
  } catch {
    // Backend not reachable yet (e.g. still starting) — harmless, the
    // next tick tries again. No state is lost: tasks just stay 'queued'.
  } finally {
    agentCycleInProgress = false;
  }
}

// Sprint 15.6: without this, launching NEMI AI Studio a second time (a
// double-click, a second Start Menu launch while the first is still open)
// silently spawned a second Electron process, which spawned its own
// backend that failed to bind the already-held port 8756 — a fully
// interactive but permanently backend-less second window, confirmed
// during a production-stabilization audit. `requestSingleInstanceLock()`
// makes the second launch hand off to the first instance instead.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    createMainWindow();
    startBackend(__dirname);
    setChangeListener((event) => {
      mainWindow?.webContents.send('fs:changed', event);
    });
    agentCycleTimer = setInterval(() => void runAgentCycleOnce(), AGENT_RUN_CYCLE_INTERVAL_MS);
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });

  // Sprint 15.6: quit needs to actually wait for stopBackend()'s graceful
  // shutdown (POST /shutdown, then a bounded wait for real process exit)
  // before Electron tears the process down — a bare `before-quit` handler
  // can't do that, since returning a Promise from the listener doesn't
  // pause quit. This is the standard Electron pattern for async
  // quit-time cleanup: intercept the first request, run cleanup, then
  // call `app.quit()` again (the `isQuitting` guard lets that second
  // call proceed instead of re-entering this same handler forever).
  let isQuitting = false;
  app.on('before-quit', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    isQuitting = true;
    void (async () => {
      if (agentCycleTimer) clearInterval(agentCycleTimer);
      await stopBackend();
      closeProject();
      app.quit();
    })();
  });
}
