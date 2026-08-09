import { BACKEND_HOST, BACKEND_PORT } from './backend-client';

const REQUEST_TIMEOUT_MS = 10_000;

function baseUrl(): string {
  return `http://${BACKEND_HOST}:${BACKEND_PORT}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Backend returned ${response.status} for ${path}: ${body}`);
  }
  return (await response.json()) as T;
}

export type CliToolId = 'codex-cli' | 'claude-code-cli' | 'gemini-cli';
export type AgentRoleKey = 'planner' | 'developer' | 'reviewer' | 'tester';
export type ExecutionMode = 'auto' | CliToolId;

export interface CliToolStatus {
  id: CliToolId;
  display_name: string;
  installed: boolean;
  binary_path: string | null;
  version: string | null;
  authenticated: boolean | null;
  available: boolean;
  roles: AgentRoleKey[];
  role_note: string;
}

export interface ExecutionPolicy {
  mode: ExecutionMode;
  subscription_first: boolean;
  updated_at: string | null;
}

export interface ExecutionDecision {
  available: boolean;
  backend: 'api' | 'cli' | null;
  execution_id: string | null;
  display_name: string | null;
  fallback_used: boolean;
  reason: string;
}

/** Sprint 16: real live detection every call — see backend
 * app/ai/cli_tools.py's detect_all(). Never fabricated. */
export function getCliToolStatus(): Promise<CliToolStatus[]> {
  return requestJson('/cli-tools/status');
}

export function getExecutionPolicy(): Promise<ExecutionPolicy> {
  return requestJson('/cli-tools/execution-policy');
}

export function updateExecutionPolicy(update: {
  mode?: ExecutionMode;
  subscriptionFirst?: boolean;
}): Promise<ExecutionPolicy> {
  return requestJson('/cli-tools/execution-policy', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: update.mode, subscription_first: update.subscriptionFirst }),
  });
}

export function resolveExecution(input: {
  role: AgentRoleKey;
  apiProviderId?: string | null;
  apiProviderDisplayName?: string | null;
  apiProviderConfigured?: boolean;
}): Promise<ExecutionDecision> {
  return requestJson('/cli-tools/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role: input.role,
      api_provider_id: input.apiProviderId ?? null,
      api_provider_display_name: input.apiProviderDisplayName ?? null,
      api_provider_configured: input.apiProviderConfigured ?? false,
    }),
  });
}
