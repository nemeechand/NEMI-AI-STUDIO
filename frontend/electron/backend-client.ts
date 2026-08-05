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

function baseUrl(): string {
  return `http://${BACKEND_HOST}:${BACKEND_PORT}`;
}

export function checkHealth(): Promise<Response> {
  return fetch(`${baseUrl()}/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
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
