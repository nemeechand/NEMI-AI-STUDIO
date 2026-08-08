import { BACKEND_HOST, BACKEND_PORT } from './backend-client';

const REQUEST_TIMEOUT_MS = 10_000;

function baseUrl(): string {
  return `http://${BACKEND_HOST}:${BACKEND_PORT}`;
}

async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Backend returned ${response.status} for ${path}: ${body}`);
  }
  return (await response.json()) as T;
}

export interface PerformanceStats {
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  success_rate: number | null;
  failure_rate: number | null;
  retry_rate: number | null;
  avg_task_seconds: number | null;
  avg_agent_seconds: Record<string, number | null>;
  tasks_completed_last_hour: number;
}

export interface TokenWindowStats {
  by_provider: Record<
    string,
    { prompt_tokens: number; completion_tokens: number; estimated_cost_usd: number | null }
  >;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_estimated_cost_usd: number | null;
}

export interface TokenStats {
  session: TokenWindowStats;
  day: TokenWindowStats;
  month: TokenWindowStats;
}

export interface HistoryEntry {
  id: string;
  project_id: string | null;
  entity_type: string;
  entity_id: string;
  action: 'created' | 'updated' | 'deleted';
  snapshot: Record<string, unknown>;
  created_at: string;
}

export function getPerformanceStats(projectId: string | null): Promise<PerformanceStats> {
  const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
  return requestJson(`/stats/performance${query}`);
}

export function getTokenStats(): Promise<TokenStats> {
  return requestJson('/stats/tokens');
}

export function getHistory(projectId: string | null, limit = 100): Promise<HistoryEntry[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (projectId) params.set('project_id', projectId);
  return requestJson(`/history?${params.toString()}`);
}
