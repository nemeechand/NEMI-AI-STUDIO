import { app } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import {
  BACKEND_HOST,
  BACKEND_PORT,
  checkHealth,
  postLog,
  type HealthResponse,
} from './backend-client';

export type BackendState = 'starting' | 'ready' | 'error' | 'stopped';

export interface BackendHealth {
  state: BackendState;
  port: number;
  message?: string;
  version?: string;
  uptimeSeconds?: number;
}

const STARTUP_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 300;

let child: ChildProcess | null = null;
let state: BackendState = 'stopped';
let lastError: string | undefined;
let lastHealth: HealthResponse | undefined;

function resolveBackendDir(electronDirname: string): string {
  if (app.isPackaged) {
    // electron-builder ships backend/ as an extraResource (see
    // frontend/package.json "build" config), unpacked next to the app.
    // As of Sprint 8 this holds the PyInstaller onedir bundle
    // (nemi-backend(.exe) + _internal/), not raw Python source.
    return path.join(process.resourcesPath, 'backend');
  }
  // Dev mode: electron/main.ts compiles to frontend/dist-electron/main.js,
  // so the backend package lives two levels up and then into backend/.
  return path.join(electronDirname, '..', '..', 'backend');
}

function resolvePythonExecutable(): string {
  return process.env.NEMI_PYTHON_PATH ?? (process.platform === 'win32' ? 'python' : 'python3');
}

interface BackendCommand {
  command: string;
  args: string[];
}

/**
 * Packaged builds spawn the PyInstaller-bundled executable directly — no
 * reliance on a system Python being installed (Sprint 8). Dev mode is
 * unchanged: `python -m app.main` from PATH, since the whole point of
 * bundling is only relevant to the distributed artifact.
 */
function resolveBackendCommand(backendDir: string): BackendCommand {
  if (app.isPackaged) {
    const executableName = process.platform === 'win32' ? 'nemi-backend.exe' : 'nemi-backend';
    return { command: path.join(backendDir, executableName), args: [] };
  }
  return { command: resolvePythonExecutable(), args: ['-m', 'app.main'] };
}

/**
 * Where the bundled backend should read/write its database and log file.
 * Packaged builds point these at Electron's conventional per-user app-data
 * directory (never inside the installed resources, which may not be
 * writable and shouldn't hold mutable user data) — config.py already
 * supports both env vars as overrides, so no backend code change was
 * needed, only always-populating what was previously optional. Dev mode
 * leaves them unset, preserving config.py's existing repo-relative
 * defaults (database/nemi.db, logs/backend.log) exactly as before.
 */
function resolveDataPaths(): { dbPath?: string; logFilePath?: string } {
  if (!app.isPackaged) return {};
  const userDataDir = app.getPath('userData');
  return {
    dbPath: path.join(userDataDir, 'database', 'nemi.db'),
    logFilePath: path.join(userDataDir, 'logs', 'backend.log'),
  };
}

async function waitForHealthy(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await checkHealth();
      if (response.ok) {
        lastHealth = (await response.json()) as HealthResponse;
        return;
      }
    } catch {
      // Backend not accepting connections yet — keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`Backend did not become healthy within ${timeoutMs}ms`);
}

/**
 * Refreshes the cached health snapshot in the background so uptime/version
 * shown to the renderer don't go stale between startup and the next call —
 * fire-and-forget, never throws (getBackendHealth() always returns the last
 * known-good snapshot regardless of this refresh's outcome).
 */
function refreshHealthSnapshot(): void {
  void checkHealth()
    .then(async (response) => {
      if (response.ok) {
        lastHealth = (await response.json()) as HealthResponse;
      }
    })
    .catch(() => {
      // Ignore — StatusBar surfaces real backend loss via `state`, not this.
    });
}

/**
 * Surfaces raw backend process output in the Logger Panel (which polls the
 * `logs` table `postLog()` already writes to) — previously this only went
 * to Electron's console. Split multi-line chunks so each line becomes its
 * own log row instead of one run-on message.
 */
function forwardToLogger(level: 'DEBUG' | 'WARNING', source: string, chunk: Buffer): void {
  for (const line of chunk.toString().split('\n')) {
    const trimmed = line.trim();
    if (trimmed) postLog(level, source, trimmed);
  }
}

export function startBackend(electronDirname: string): void {
  if (child) return;

  state = 'starting';
  lastError = undefined;

  const cwd = resolveBackendDir(electronDirname);
  const { command, args } = resolveBackendCommand(cwd);
  const { dbPath, logFilePath } = resolveDataPaths();
  const proc = spawn(command, args, {
    cwd,
    env: {
      ...process.env,
      NEMI_BACKEND_HOST: BACKEND_HOST,
      NEMI_BACKEND_PORT: String(BACKEND_PORT),
      ...(dbPath ? { NEMI_DB_PATH: dbPath } : {}),
      ...(logFilePath ? { NEMI_LOG_FILE: logFilePath } : {}),
    },
  });
  child = proc;

  proc.stdout?.on('data', (chunk: Buffer) => {
    console.log(`[backend] ${chunk.toString().trim()}`);
    forwardToLogger('DEBUG', 'backend.stdout', chunk);
  });
  proc.stderr?.on('data', (chunk: Buffer) => {
    console.error(`[backend] ${chunk.toString().trim()}`);
    forwardToLogger('WARNING', 'backend.stderr', chunk);
  });

  proc.on('error', (error: NodeJS.ErrnoException) => {
    state = 'error';
    if (error.code !== 'ENOENT') {
      lastError = error.message;
    } else if (app.isPackaged) {
      // The bundled executable should always be present (Sprint 8) — ENOENT
      // here means a packaging defect, not a missing user prerequisite.
      lastError =
        'The bundled backend was not found. This installation may be corrupted; ' +
        'try reinstalling NEMI AI STUDIO.';
    } else {
      lastError =
        'Python was not found on this system. Install Python 3.11+ and the ' +
        'backend dependencies (see backend/requirements.txt) to enable AI Studio.';
    }
  });

  proc.on('exit', (code) => {
    child = null;
    if (state !== 'stopped') {
      state = 'error';
      lastError = `Backend process exited unexpectedly (code ${code ?? 'unknown'})`;
    }
  });

  void waitForHealthy(STARTUP_TIMEOUT_MS)
    .then(() => {
      if (state === 'starting') {
        state = 'ready';
      }
    })
    .catch((error: unknown) => {
      state = 'error';
      lastError = error instanceof Error ? error.message : String(error);
    });
}

export function stopBackend(): void {
  state = 'stopped';
  lastHealth = undefined;
  if (child) {
    child.kill();
    child = null;
  }
}

export function getBackendHealth(): BackendHealth {
  if (state === 'ready') refreshHealthSnapshot();
  return {
    state,
    port: BACKEND_PORT,
    message: lastError,
    version: lastHealth?.version,
    uptimeSeconds: lastHealth?.uptime_seconds,
  };
}
