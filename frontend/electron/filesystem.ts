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

// Sprint 9: Quick Open / Global Search traversal caps — keep a huge repo
// from making either feature hang. Both walk the same directory tree
// listDirectory()/the watcher already ignore (IGNORED_NAMES).
const MAX_LIST_ALL_FILES = 5000;
const MAX_SEARCH_RESULTS = 500;
const MAX_SEARCHABLE_FILE_BYTES = MAX_READABLE_FILE_BYTES;

export interface SearchMatch {
  path: string;
  line: number;
  column: number;
  lineText: string;
}

export interface SearchOptions {
  caseSensitive?: boolean;
  useRegex?: boolean;
}

// Coalesces bursts of watcher events (e.g. `npm install`, a git checkout can
// fire hundreds of add/change events in milliseconds) into a single
// notification, instead of one renderer refetch per raw filesystem event.
const WATCH_NOTIFY_DEBOUNCE_MS = 300;

let watcher: FSWatcher | null = null;
let changeListener: ((event: { path: string }) => void) | null = null;
let pendingNotifyPath: string | null = null;
let notifyDebounceTimer: NodeJS.Timeout | null = null;
// Sprint 16: the CLI dispatch poller (cli-tools.ts) runs on its own
// interval in main.ts, not driven by a renderer call the way `git:status`/
// `build:run`/etc. are (those already receive `projectPath` as an
// explicit argument each time) — it needs to know the open project's path
// without one, so it's tracked here alongside the watcher, which is the
// existing single source of truth for "what project is currently open".
let currentProjectPath: string | null = null;

export function getCurrentProjectPath(): string | null {
  return currentProjectPath;
}

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

/** Depth-first recursive walk of every file under `rootPath`, respecting
 * the same IGNORED_NAMES the Explorer/watcher already use. Stops early
 * once `onFile` returns `false` (used by both callers below to enforce
 * their own result caps without walking a huge tree needlessly). */
async function walkFiles(rootPath: string, onFile: (filePath: string) => boolean): Promise<void> {
  const names = await fs.readdir(rootPath).catch(() => [] as string[]);
  for (const name of names) {
    if (IGNORED_NAMES.has(name)) continue;
    const entryPath = path.join(rootPath, name);
    const type = await statType(entryPath);
    if (type === 'folder') {
      await walkFiles(entryPath, onFile);
    } else if (type === 'file') {
      if (!onFile(entryPath)) return;
    }
  }
}

/** Quick Open (Ctrl+P): every file path under the project root, capped so
 * an unusually large repository can't hang the picker. */
export async function listAllFiles(rootPath: string): Promise<string[]> {
  const results: string[] = [];
  await walkFiles(rootPath, (filePath) => {
    results.push(filePath);
    return results.length < MAX_LIST_ALL_FILES;
  });
  return results;
}

/** Global Search (Ctrl+Shift+F): plain-substring or regex search across
 * every file under the project root. Skips files over the same size guard
 * `readFile()` uses, and any file that fails to read as UTF-8 text
 * (binary files) — both silently skipped, not errors. */
export async function searchInFiles(
  rootPath: string,
  query: string,
  options: SearchOptions = {},
): Promise<SearchMatch[]> {
  if (!query) return [];

  const matcher = options.useRegex ? new RegExp(query, options.caseSensitive ? 'g' : 'gi') : null;
  const plainQuery = options.caseSensitive ? query : query.toLowerCase();

  const results: SearchMatch[] = [];

  async function searchOneFile(filePath: string): Promise<void> {
    try {
      const stats = await fs.stat(filePath);
      if (stats.size > MAX_SEARCHABLE_FILE_BYTES) return;
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        if (results.length >= MAX_SEARCH_RESULTS) return;
        const lineText = lines[lineIndex];
        if (matcher) {
          matcher.lastIndex = 0;
          const match = matcher.exec(lineText);
          if (match) {
            results.push({
              path: filePath,
              line: lineIndex + 1,
              column: match.index + 1,
              lineText,
            });
          }
        } else {
          const haystack = options.caseSensitive ? lineText : lineText.toLowerCase();
          const column = haystack.indexOf(plainQuery);
          if (column !== -1) {
            results.push({ path: filePath, line: lineIndex + 1, column: column + 1, lineText });
          }
        }
      }
    } catch {
      // Binary/unreadable file — skip silently, not an error.
    }
  }

  const filesToSearch: string[] = [];
  await walkFiles(rootPath, (filePath) => {
    filesToSearch.push(filePath);
    return filesToSearch.length < MAX_LIST_ALL_FILES;
  });

  for (const filePath of filesToSearch) {
    if (results.length >= MAX_SEARCH_RESULTS) break;
    await searchOneFile(filePath);
  }

  return results;
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

export async function createDirectory(parentPath: string, name: string): Promise<string> {
  const targetPath = path.join(parentPath, name);
  try {
    await fs.mkdir(targetPath);
  } catch (error) {
    if (isErrnoException(error) && error.code === 'EEXIST') {
      throw new Error(`"${name}" already exists in this location.`);
    }
    throw error;
  }
  postLog('INFO', 'fs.project', `Created new project folder ${targetPath}`);
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
  currentProjectPath = realPath;
  return true;
}

export function closeProject(): void {
  stopWatching();
  currentProjectPath = null;
}

function startWatching(rootPath: string): Promise<void> {
  stopWatching();
  watcher = chokidar.watch(rootPath, {
    ignored: (watchedPath: string) => IGNORED_NAMES.has(path.basename(watchedPath)),
    ignoreInitial: true,
    depth: 20,
  });

  const notify = (changedPath: string) => {
    pendingNotifyPath = changedPath;
    if (notifyDebounceTimer) clearTimeout(notifyDebounceTimer);
    notifyDebounceTimer = setTimeout(() => {
      notifyDebounceTimer = null;
      if (pendingNotifyPath) changeListener?.({ path: pendingNotifyPath });
    }, WATCH_NOTIFY_DEBOUNCE_MS);
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
  if (notifyDebounceTimer) {
    clearTimeout(notifyDebounceTimer);
    notifyDebounceTimer = null;
  }
  pendingNotifyPath = null;
  if (watcher) {
    void watcher.close();
    watcher = null;
  }
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
