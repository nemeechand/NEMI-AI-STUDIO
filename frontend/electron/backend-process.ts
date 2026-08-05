import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

export type BackendState = 'starting' | 'ready' | 'error' | 'stopped';

export interface BackendHealth {
  state: BackendState;
  port: number;
  message?: string;
}

const BACKEND_HOST = '127.0.0.1';
const BACKEND_PORT = 8756;
const HEALTH_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}/health`;
const STARTUP_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 300;
const HEALTH_CHECK_TIMEOUT_MS = 1_000;

let child: ChildProcess | null = null;
let state: BackendState = 'stopped';
let lastError: string | undefined;

function resolveBackendDir(electronDirname: string): string {
  // electron/main.ts compiles to frontend/dist-electron/main.js, so the
  // backend package lives two levels up and then into backend/.
  return path.join(electronDirname, '..', '..', 'backend');
}

function resolvePythonExecutable(): string {
  return process.env.NEMI_PYTHON_PATH ?? (process.platform === 'win32' ? 'python' : 'python3');
}

async function waitForHealthy(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(HEALTH_URL, {
        signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
      });
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

  proc.on('error', (error) => {
    state = 'error';
    lastError = error.message;
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
