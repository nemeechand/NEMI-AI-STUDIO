import { app } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { BACKEND_HOST, BACKEND_PORT, checkHealth } from './backend-client';

export type BackendState = 'starting' | 'ready' | 'error' | 'stopped';

export interface BackendHealth {
  state: BackendState;
  port: number;
  message?: string;
}

const STARTUP_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 300;

let child: ChildProcess | null = null;
let state: BackendState = 'stopped';
let lastError: string | undefined;

function resolveBackendDir(electronDirname: string): string {
  if (app.isPackaged) {
    // electron-builder ships backend/ as an extraResource (see
    // frontend/package.json "build" config), unpacked next to the app.
    return path.join(process.resourcesPath, 'backend');
  }
  // Dev mode: electron/main.ts compiles to frontend/dist-electron/main.js,
  // so the backend package lives two levels up and then into backend/.
  return path.join(electronDirname, '..', '..', 'backend');
}

function resolvePythonExecutable(): string {
  return process.env.NEMI_PYTHON_PATH ?? (process.platform === 'win32' ? 'python' : 'python3');
}

async function waitForHealthy(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await checkHealth();
      if (response.ok) return;
    } catch {
      // Backend not accepting connections yet — keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`Backend did not become healthy within ${timeoutMs}ms`);
}

export function startBackend(electronDirname: string): void {
  if (child) return;

  state = 'starting';
  lastError = undefined;

  const cwd = resolveBackendDir(electronDirname);
  const proc = spawn(resolvePythonExecutable(), ['-m', 'app.main'], {
    cwd,
    env: {
      ...process.env,
      NEMI_BACKEND_HOST: BACKEND_HOST,
      NEMI_BACKEND_PORT: String(BACKEND_PORT),
    },
  });
  child = proc;

  proc.stdout?.on('data', (chunk: Buffer) => {
    console.log(`[backend] ${chunk.toString().trim()}`);
  });
  proc.stderr?.on('data', (chunk: Buffer) => {
    console.error(`[backend] ${chunk.toString().trim()}`);
  });

  proc.on('error', (error: NodeJS.ErrnoException) => {
    state = 'error';
    lastError =
      error.code === 'ENOENT'
        ? 'Python was not found on this system. Install Python 3.11+ and the ' +
          'backend dependencies (see backend/requirements.txt) to enable AI Studio.'
        : error.message;
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
  if (child) {
    child.kill();
    child = null;
  }
}

export function getBackendHealth(): BackendHealth {
  return { state, port: BACKEND_PORT, message: lastError };
}
