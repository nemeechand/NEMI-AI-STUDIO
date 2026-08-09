import { app } from 'electron';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import {
  BACKEND_HOST,
  BACKEND_PORT,
  checkHealth,
  postLog,
  requestGracefulShutdown,
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
// Sprint 15.6: a mid-session crash (as opposed to a slow-but-eventually-
// healthy cold start, which watchForLateRecovery already covers) now gets
// a bounded number of automatic restart attempts with backoff, instead of
// leaving the app permanently in "Backend Offline" until the user quits
// and relaunches the whole thing.
const MAX_AUTO_RESTART_ATTEMPTS = 3;
const AUTO_RESTART_BACKOFF_MS = 2_000;
// How long stopBackend() waits for a graceful shutdown (POST /shutdown +
// the child actually exiting) before falling back to a forced kill.
const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 3_000;

let child: ChildProcess | null = null;
let state: BackendState = 'stopped';
let lastError: string | undefined;
let lastHealth: HealthResponse | undefined;
let lastElectronDirname: string | null = null;
let autoRestartAttempts = 0;

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
 * A STARTUP_TIMEOUT_MS timeout means the backend didn't answer /health in
 * time — not that it died (a real crash already nulls `child` via the
 * 'exit' handler above, which this loop's `child` check picks up). A cold
 * dev-mode start doing heavy first-import work (AI provider SDKs, Sprint
 * 11's agent-role-file seeding) can legitimately outrun the timeout, so
 * keep watching in the background and let the UI recover from "Backend
 * Offline" once it actually comes up, instead of latching into a false
 * error state for the rest of the session.
 */
async function watchForLateRecovery(): Promise<void> {
  while (child && state === 'error') {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    if (!child || state !== 'error') return;
    try {
      const response = await checkHealth();
      if (response.ok) {
        lastHealth = (await response.json()) as HealthResponse;
        state = 'ready';
        lastError = undefined;
        return;
      }
    } catch {
      // Still not accepting connections — keep watching.
    }
  }
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

  lastElectronDirname = electronDirname;
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
    if (state === 'stopped') return; // a deliberate stopBackend() call — not a crash
    const wasReadyOrStarting = state === 'ready' || state === 'starting';
    state = 'error';
    lastError = `Backend process exited unexpectedly (code ${code ?? 'unknown'})`;
    if (
      wasReadyOrStarting &&
      autoRestartAttempts < MAX_AUTO_RESTART_ATTEMPTS &&
      lastElectronDirname
    ) {
      autoRestartAttempts += 1;
      const attempt = autoRestartAttempts;
      lastError = `Backend crashed — attempting automatic restart (${attempt}/${MAX_AUTO_RESTART_ATTEMPTS})…`;
      const dirname = lastElectronDirname;
      setTimeout(() => {
        if (child) return; // something else already restarted it
        startBackend(dirname);
      }, AUTO_RESTART_BACKOFF_MS);
    } else if (wasReadyOrStarting) {
      lastError =
        `Backend crashed and automatic restart failed ${MAX_AUTO_RESTART_ATTEMPTS} time(s). ` +
        'Restart NEMI AI Studio to recover.';
    }
  });

  void waitForHealthy(STARTUP_TIMEOUT_MS)
    .then(() => {
      if (state === 'starting') {
        state = 'ready';
      }
      // A real recovery — successfully healthy again — resets the crash
      // counter, so a second, later, unrelated crash still gets its own
      // full set of restart attempts rather than inheriting an earlier
      // incident's exhausted budget.
      autoRestartAttempts = 0;
    })
    .catch((error: unknown) => {
      state = 'error';
      lastError = error instanceof Error ? error.message : String(error);
      void watchForLateRecovery();
    });
}

/**
 * Stops the backend, preferring a real graceful shutdown (`POST
 * /shutdown`, which delivers a real SIGINT the backend's own signal
 * handler turns into an orderly uvicorn/FastAPI-lifespan shutdown) over
 * the previous unconditional `child.kill()` — Windows' `ChildProcess.kill()`
 * has no SIGTERM-equivalent grace period; it maps straight to
 * `TerminateProcess`, so every prior quit killed the Python process
 * mid-operation with no chance to close its own database connections,
 * finish an in-flight write, or run any cleanup at all. Bounded by
 * `GRACEFUL_SHUTDOWN_TIMEOUT_MS`: if the process hasn't actually exited by
 * then (hung, or `/shutdown` itself never reached it), the original forced
 * kill is still the fallback — this makes shutdown *more* reliable, never
 * less.
 */
export async function stopBackend(): Promise<void> {
  // Setting 'stopped' before the child actually exits is what makes the
  // 'exit' handler above treat this as deliberate rather than a crash —
  // it checks `state === 'stopped'` first and returns without touching
  // the auto-restart counter.
  state = 'stopped';
  lastHealth = undefined;
  const proc = child;
  if (!proc) return;

  const exited = new Promise<void>((resolve) => {
    proc.once('exit', () => resolve());
  });

  await requestGracefulShutdown();
  const gracefulExit = await Promise.race([
    exited.then(() => true),
    new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(false), GRACEFUL_SHUTDOWN_TIMEOUT_MS),
    ),
  ]);

  if (!gracefulExit && child === proc) {
    proc.kill();
  }
  child = null;
}

/**
 * Sprint 15.6's Health Center "Restart Backend" action — a manual
 * escape hatch for when automatic restart has exhausted its attempts
 * (or the user just wants to force one), reusing the exact same
 * stop/start functions the crash-recovery path already calls.
 */
export async function restartBackend(): Promise<void> {
  if (!lastElectronDirname) return;
  await stopBackend();
  autoRestartAttempts = 0;
  startBackend(lastElectronDirname);
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

export interface ResourceUsage {
  memoryMb: number;
  /** Approximate — sampled as (Δcpu-seconds / Δwall-seconds) between two
   * calls to this function, not read from a true OS scheduler counter.
   * `null` on the very first call of a session (no prior sample to diff
   * against) and whenever the process can't be inspected. */
  cpuPercent: number | null;
}

const execFileAsync = promisify(execFile);

let lastCpuSample: { atMs: number; cpuSeconds: number } | null = null;

/**
 * The Python backend is a plain `child_process.spawn()`, not one of
 * Electron's own tracked subprocesses — `app.getAppMetrics()` only covers
 * the renderer/GPU/utility processes Electron itself launched, so it can't
 * report on this one. `Get-Process` is the pragmatic, honest way to get
 * real numbers for an arbitrary PID on Windows (this app's only packaged
 * target — see package.json's `build.win`) without a native addon. CPU is
 * `Get-Process`'s cumulative processor time, turned into a percentage by
 * diffing against the previous sample; memory is a direct, un-approximated
 * working-set read.
 */
export async function getBackendResourceUsage(): Promise<ResourceUsage | null> {
  if (!child?.pid || process.platform !== 'win32') return null;
  try {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Get-Process -Id ${child.pid} | ForEach-Object { "$($_.WorkingSet64)"; "$($_.TotalProcessorTime)" }`,
    ]);
    // WorkingSet64 (bytes) and TotalProcessorTime (a TimeSpan, printed as
    // "d.hh:mm:ss.fffffff" or "hh:mm:ss.fffffff") come back as two lines.
    const lines = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const workingSetBytes = Number(lines[0]);
    const cpuSeconds = _parseDotNetTimeSpanSeconds(lines[1] ?? '');
    if (!Number.isFinite(workingSetBytes) || cpuSeconds === null) return null;

    const now = Date.now();
    let cpuPercent: number | null = null;
    if (lastCpuSample) {
      const deltaWallSeconds = (now - lastCpuSample.atMs) / 1000;
      const deltaCpuSeconds = cpuSeconds - lastCpuSample.cpuSeconds;
      if (deltaWallSeconds > 0) {
        cpuPercent = Math.max(0, (deltaCpuSeconds / deltaWallSeconds) * 100);
      }
    }
    lastCpuSample = { atMs: now, cpuSeconds };

    return { memoryMb: workingSetBytes / (1024 * 1024), cpuPercent };
  } catch {
    return null;
  }
}

function _parseDotNetTimeSpanSeconds(raw: string): number | null {
  const match = /^(?:(\d+)\.)?(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)$/.exec(raw.trim());
  if (!match) return null;
  const [, days, hours, minutes, seconds] = match;
  return Number(days ?? 0) * 86400 + Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}
