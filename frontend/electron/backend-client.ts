export const BACKEND_HOST = '127.0.0.1';
export const BACKEND_PORT = 8756;

const REQUEST_TIMEOUT_MS = 5_000;
const HEALTH_TIMEOUT_MS = 1_000;

export interface LogEntry {
  id: string;
  project_id: string | null;
  level: string;
  source: string;
  message: string;
  created_at: string;
}

export interface HealthResponse {
  status: string;
  version: string;
  env: string;
  uptime_seconds: number;
}

/** Sprint 15.6's Health Center backend aggregation (`GET /health/full`) —
 * every real, backend-owned health signal in one response. See
 * backend/app/api/health.py::health_full() for what backs each field. */
export interface FullHealthResponse {
  status: string;
  version: string;
  env: string;
  uptime_seconds: number;
  python: { version: string; implementation: string };
  database: { ok: boolean; path: string; size_bytes: number | null; message: string | null };
  providers: {
    total: number;
    connected: number;
    errors_total: number;
    requests_total: number;
  };
  ollama: { installed: boolean; server_running: boolean; host: string };
  internet: { ok: boolean; message: string | null };
}

export interface ProjectRecord {
  id: string;
  name: string;
  path: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
}

function baseUrl(): string {
  return `http://${BACKEND_HOST}:${BACKEND_PORT}`;
}

export function checkHealth(): Promise<Response> {
  return fetch(`${baseUrl()}/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
}

/** Sprint 15.6: requests a real graceful shutdown (`POST /shutdown`) —
 * see backend-process.ts::stopBackend() for why this replaced an
 * unconditional forced kill. Never throws: the caller treats "the
 * request itself failed" the same as "no response in time," both
 * meaning graceful shutdown isn't available right now and a forced
 * kill is the only option left. */
export async function requestGracefulShutdown(): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl()}/shutdown`, {
      method: 'POST',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function fetchFullHealth(): Promise<FullHealthResponse> {
  const response = await fetch(`${baseUrl()}/health/full`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Backend returned ${response.status} for /health/full`);
  }
  return (await response.json()) as FullHealthResponse;
}

export async function fetchRecentLogs(limit = 50): Promise<LogEntry[]> {
  const response = await fetch(`${baseUrl()}/logs?limit=${limit}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Backend returned ${response.status} for GET /logs`);
  }
  return (await response.json()) as LogEntry[];
}

/**
 * Fire-and-forget audit logging for actions taken by Electron main
 * (e.g. file operations). Never throws — a backend hiccup must not
 * break the filesystem operation that triggered it.
 */
export function postLog(level: string, source: string, message: string): void {
  void fetch(`${baseUrl()}/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level, source, message }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
    .then((response) => {
      if (!response.ok) {
        console.error(`[backend-client] Failed to post log: HTTP ${response.status}`);
      }
    })
    .catch((error: unknown) => {
      console.error('[backend-client] Failed to post log', error);
    });
}

export async function fetchRecentProjects(limit = 20): Promise<ProjectRecord[]> {
  const response = await fetch(`${baseUrl()}/projects/recent?limit=${limit}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Backend returned ${response.status} for GET /projects/recent`);
  }
  return (await response.json()) as ProjectRecord[];
}

export async function recordProjectOpened(
  path: string,
  name: string,
  description?: string,
): Promise<ProjectRecord> {
  const response = await fetch(`${baseUrl()}/projects/opened`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, name, description }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Backend returned ${response.status} for POST /projects/opened`);
  }
  return (await response.json()) as ProjectRecord;
}

export async function removeRecentProject(id: string): Promise<void> {
  const response = await fetch(`${baseUrl()}/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Backend returned ${response.status} for DELETE /projects/${id}`);
  }
}
