import { contextBridge, ipcRenderer } from 'electron';
import type { BackendHealth } from './backend-process';
import type { LogEntry, ProjectRecord } from './backend-client';
import type { ExplorerEntry, SearchMatch, SearchOptions } from './filesystem';

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

contextBridge.exposeInMainWorld('nemi', { windowControls, backend, fs: fsApi, projects });
