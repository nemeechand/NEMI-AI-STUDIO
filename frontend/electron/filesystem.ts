import { promises as fs, type Stats } from 'node:fs';
import path from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import { postLog } from './backend-client';

export interface ExplorerEntry {
  name: string;
  path: string;
  type: 'file' | 'folder';
}

const IGNORED_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  'dist-electron',
  '__pycache__',
  '.venv',
  '.pytest_cache',
  '.ruff_cache',
  '.mypy_cache',
]);

const MAX_READABLE_FILE_BYTES = 2 * 1024 * 1024; // 2 MB — see docs/ARCHITECTURE.md

let watcher: FSWatcher | null = null;
let changeListener: ((event: { path: string }) => void) | null = null;

export function setChangeListener(listener: ((event: { path: string }) => void) | null): void {
  changeListener = listener;
}

async function statType(entryPath: string): Promise<'file' | 'folder' | null> {
  try {
    const stats: Stats = await fs.stat(entryPath);
    return stats.isDirectory() ? 'folder' : 'file';
  } catch {
    return null;
  }
}

export async function listDirectory(dirPath: string): Promise<ExplorerEntry[]> {
  const names = await fs.readdir(dirPath);
  const entries: ExplorerEntry[] = [];

  for (const name of names) {
    if (IGNORED_NAMES.has(name)) continue;
    const entryPath = path.join(dirPath, name);
    const type = await statType(entryPath);
    if (!type) continue;
    entries.push({ name, path: entryPath, type });
  }

  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return entries;
}

export async function readFile(filePath: string): Promise<string> {
  const stats = await fs.stat(filePath);
  if (stats.size > MAX_READABLE_FILE_BYTES) {
    const limitKb = Math.round(MAX_READABLE_FILE_BYTES / 1024);
    const sizeKb = Math.round(stats.size / 1024);
    throw new Error(`File is too large to open (${sizeKb} KB, limit ${limitKb} KB).`);
  }
  return fs.readFile(filePath, 'utf-8');
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, 'utf-8');
  postLog('INFO', 'fs.save', `Saved ${filePath}`);
}

export async function createFile(dirPath: string, name: string): Promise<string> {
  const targetPath = path.join(dirPath, name);
  try {
    await fs.writeFile(targetPath, '', { encoding: 'utf-8', flag: 'wx' });
  } catch (error) {
    if (isErrnoException(error) && error.code === 'EEXIST') {
      throw new Error(`"${name}" already exists in this folder.`);
    }
    throw error;
  }
  postLog('INFO', 'fs.create', `Created ${targetPath}`);
  return targetPath;
}

export async function renameEntry(entryPath: string, newName: string): Promise<string> {
  const newPath = path.join(path.dirname(entryPath), newName);
  await fs.rename(entryPath, newPath);
  postLog('INFO', 'fs.rename', `Renamed ${entryPath} -> ${newPath}`);
  return newPath;
}

export async function deleteEntry(entryPath: string): Promise<void> {
  await fs.rm(entryPath, { recursive: true });
  postLog('WARNING', 'fs.delete', `Deleted ${entryPath}`);
}

export async function openProject(projectPath: string): Promise<boolean> {
  const type = await statType(projectPath);
  if (type !== 'folder') return false;
  // Normalize to the real (long-form) path before watching. On Windows,
  // a short (8.3-style) path alias reaching the native watcher can crash
  // the process with a libuv assertion — see docs/ARCHITECTURE.md.
  const realPath = await fs.realpath(projectPath);
  await startWatching(realPath);
  return true;
}

export function closeProject(): void {
  stopWatching();
}

function startWatching(rootPath: string): Promise<void> {
  stopWatching();
  watcher = chokidar.watch(rootPath, {
    ignored: (watchedPath: string) => IGNORED_NAMES.has(path.basename(watchedPath)),
    ignoreInitial: true,
    depth: 20,
  });

  const notify = (changedPath: string) => {
    changeListener?.({ path: changedPath });
  };

  watcher
    .on('add', notify)
    .on('unlink', notify)
    .on('addDir', notify)
    .on('unlinkDir', notify)
    .on('change', notify)
    .on('error', (error: unknown) => {
      console.error('[filesystem] watcher error', error);
    });

  // Resolve once the watcher has finished its initial scan and is fully
  // armed — otherwise a file created immediately after openProject()
  // resolves could race the watcher's setup and go unnoticed.
  return new Promise((resolve) => {
    watcher?.once('ready', () => resolve());
  });
}

function stopWatching(): void {
  if (watcher) {
    void watcher.close();
    watcher = null;
  }
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
