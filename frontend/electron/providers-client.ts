import { BACKEND_HOST, BACKEND_PORT } from './backend-client';

const REQUEST_TIMEOUT_MS = 10_000;
const OLLAMA_PULL_TIMEOUT_MS = 10 * 60_000; // model downloads can genuinely take minutes

function baseUrl(): string {
  return `http://${BACKEND_HOST}:${BACKEND_PORT}`;
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Backend returned ${response.status} for ${path}: ${body}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface ProviderSettings {
  provider_id: string;
  enabled: boolean;
  base_url: string | null;
  default_model: string | null;
  last_used_model: string | null;
  last_used_at: string | null;
  last_connection_status: 'untested' | 'ok' | 'error';
  last_connection_message: string | null;
  last_connection_at: string | null;
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
}

export interface OllamaModelInfo {
  name: string;
  size_bytes: number;
  modified_at: string | null;
}

export interface OllamaStatus {
  installed: boolean;
  server_running: boolean;
  host: string;
  models: OllamaModelInfo[];
}

export interface AgentProviderDefault {
  agent_role: 'planner' | 'developer' | 'reviewer' | 'tester' | 'documentation';
  provider: string;
  model: string;
  updated_at: string;
}

export interface ProviderDashboardEntry {
  provider_id: string;
  display_name: string;
  enabled: boolean;
  requires_api_key: boolean;
  configured: boolean;
  default_model: string | null;
  last_used_model: string | null;
  last_used_at: string | null;
  last_connection_status: 'untested' | 'ok' | 'error';
  last_connection_message: string | null;
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  estimated_cost_usd: number | null;
  avg_latency_ms: number | null;
  errors: number;
}

export function listProviderSettings(): Promise<ProviderSettings[]> {
  return requestJson('/providers/settings');
}

export function getProviderSettings(providerId: string): Promise<ProviderSettings> {
  return requestJson(`/providers/${encodeURIComponent(providerId)}/settings`);
}

export function updateProviderSettings(
  providerId: string,
  update: { enabled?: boolean; baseUrl?: string | null; defaultModel?: string | null },
): Promise<ProviderSettings> {
  return requestJson(`/providers/${encodeURIComponent(providerId)}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      enabled: update.enabled,
      base_url: update.baseUrl,
      default_model: update.defaultModel,
    }),
  });
}

export function refreshProviderModels(
  providerId: string,
  input: { apiKey: string | null; baseUrl: string | null },
): Promise<string[]> {
  return requestJson(
    `/providers/${encodeURIComponent(providerId)}/models`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: input.apiKey, base_url: input.baseUrl }),
    },
    20_000,
  );
}

export function testProviderConnection(
  providerId: string,
  input: { apiKey: string | null; baseUrl: string | null },
): Promise<ConnectionTestResult> {
  return requestJson(
    `/providers/${encodeURIComponent(providerId)}/test-connection`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: input.apiKey, base_url: input.baseUrl }),
    },
    20_000,
  );
}

export function listFavoriteModels(providerId: string): Promise<string[]> {
  return requestJson(`/providers/${encodeURIComponent(providerId)}/favorites`);
}

export async function setFavoriteModel(
  providerId: string,
  modelId: string,
  favorite: boolean,
): Promise<string[]> {
  const result = await requestJson<{ favorites: string[] }>(
    `/providers/${encodeURIComponent(providerId)}/favorites`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_id: modelId, favorite }),
    },
  );
  return result.favorites;
}

export function getProviderDashboard(): Promise<ProviderDashboardEntry[]> {
  return requestJson('/providers/dashboard');
}

export function getOllamaStatus(baseUrl?: string | null): Promise<OllamaStatus> {
  const query = baseUrl ? `?base_url=${encodeURIComponent(baseUrl)}` : '';
  return requestJson(`/providers/ollama/status${query}`, undefined, 8_000);
}

export function pullOllamaModel(
  model: string,
  baseUrl?: string | null,
): Promise<Record<string, unknown>> {
  return requestJson(
    '/providers/ollama/pull',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, base_url: baseUrl ?? null }),
    },
    OLLAMA_PULL_TIMEOUT_MS,
  );
}

export function deleteOllamaModel(model: string, baseUrl?: string | null): Promise<void> {
  const query = baseUrl ? `?base_url=${encodeURIComponent(baseUrl)}` : '';
  return requestJson(`/providers/ollama/models/${encodeURIComponent(model)}${query}`, {
    method: 'DELETE',
  });
}

export function listAgentProviderDefaults(): Promise<AgentProviderDefault[]> {
  return requestJson('/providers/agent-defaults');
}

export function setAgentProviderDefault(
  agentRole: string,
  provider: string,
  model: string,
): Promise<AgentProviderDefault> {
  return requestJson(`/providers/agent-defaults/${encodeURIComponent(agentRole)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, model }),
  });
}

export function clearAgentProviderDefault(agentRole: string): Promise<void> {
  return requestJson(`/providers/agent-defaults/${encodeURIComponent(agentRole)}`, {
    method: 'DELETE',
  });
}
