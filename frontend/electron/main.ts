import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getBackendHealth,
  getBackendResourceUsage,
  startBackend,
  stopBackend,
} from './backend-process';
import {
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
  approveAgentTask,
  cancelAgentTask,
  createAgentPipeline,
  getAgentTask,
  listAgentTasks,
  listAgents,
  markAgentTaskFilesApplied,
  retryAgentTask,
  runAgentCycle,
  type AgentRoleKey,
} from './agent-client';
import {
  cancelWorkflow,
  createWorkflow,
  getWorkflow,
  listWorkflows,
  pauseWorkflow,
  resumeWorkflow,
  type ApprovalMode,
} from './workflow-client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
ipcMain.handle('agents:mark-files-applied', (_event, taskId: string) =>
  markAgentTaskFilesApplied(taskId),
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

ipcMain.handle('system:resource-usage', () => getBackendResourceUsage());

const AGENT_RUN_CYCLE_INTERVAL_MS = 4_000;
const AGENT_CYCLE_PROVIDERS: ProviderId[] = ['openai', 'anthropic', 'gemini'];
let agentCycleTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Drives the agent task queue forward. Deliberately a steady interval
 * poll from Electron main, not a loop the backend runs on its own: API
 * keys are only ever decrypted here (safeStorage) and attached per
 * request, the same way ai:send-message already works — the backend
 * itself never persists or caches a key (Sprint 10's locked decision).
 * Ollama needs no key and is unaffected by whether any are configured.
 */
async function runAgentCycleOnce(): Promise<void> {
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
  }
}

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

app.on('before-quit', () => {
  stopBackend();
  closeProject();
  if (agentCycleTimer) clearInterval(agentCycleTimer);
});
