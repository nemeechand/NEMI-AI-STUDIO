import { contextBridge, ipcRenderer } from 'electron';
import type { BackendHealth } from './backend-process';
import type { LogEntry } from './backend-client';
import type { ExplorerEntry } from './filesystem';

const backend = {
  health: (): Promise<BackendHealth> => ipcRenderer.invoke('backend:health'),
  logs: (limit?: number): Promise<LogEntry[]> => ipcRenderer.invoke('backend:logs', limit),
};

const fsApi = {
  selectProjectFolder: (mode: 'open' | 'new'): Promise<string | null> =>
    ipcRenderer.invoke('fs:select-project-folder', mode),
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
  renameEntry: (entryPath: string, newName: string): Promise<string> =>
    ipcRenderer.invoke('fs:rename-entry', entryPath, newName),
  deleteEntry: (entryPath: string): Promise<void> =>
    ipcRenderer.invoke('fs:delete-entry', entryPath),
  onChange: (callback: (event: { path: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { path: string }) =>
      callback(payload);
    ipcRenderer.on('fs:changed', listener);
    return () => ipcRenderer.removeListener('fs:changed', listener);
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

contextBridge.exposeInMainWorld('nemi', { windowControls, backend, fs: fsApi });
