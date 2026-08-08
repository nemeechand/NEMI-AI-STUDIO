import { contextBridge, ipcRenderer } from 'electron';
import type { BackendHealth } from './backend-process';
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
});
