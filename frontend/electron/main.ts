import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBackendHealth, startBackend, stopBackend } from './backend-process';
import { fetchRecentLogs } from './backend-client';
import {
  closeProject,
  createFile,
  deleteEntry,
  listDirectory,
  openProject,
  readFile,
  renameEntry,
  setChangeListener,
  writeFile,
} from './filesystem';
import { selectProjectFolder } from './project-dialogs';

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
      preload: path.join(__dirname, 'preload.js'),
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

ipcMain.handle('fs:select-project-folder', (_event, mode: 'open' | 'new') => {
  if (!mainWindow) return null;
  return selectProjectFolder(mainWindow, mode);
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
ipcMain.handle('fs:rename-entry', (_event, entryPath: string, newName: string) =>
  renameEntry(entryPath, newName),
);
ipcMain.handle('fs:delete-entry', (_event, entryPath: string) => deleteEntry(entryPath));

app.whenReady().then(() => {
  createMainWindow();
  startBackend(__dirname);
  setChangeListener((event) => {
    mainWindow?.webContents.send('fs:changed', event);
  });
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
});
