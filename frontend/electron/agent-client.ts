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
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export type AgentRoleKey = 'planner' | 'developer' | 'reviewer' | 'tester';
export type AgentTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface AgentInfo {
  id: string;
  name: string;
  role_file: string;
  enabled: boolean;
}

export interface ProposedFile {
  path: string;
  content: string;
}

export interface AgentTask {
  id: string;
  project_id: string | null;
  title: string;
  description: string;
  agent_role: AgentRoleKey;
  status: AgentTaskStatus;
  priority: number;
  depends_on_task_id: string | null;
  provider: string;
  model: string;
  conversation_id: string | null;
  retry_count: number;
  max_retries: number;
  result_summary: string | null;
  proposed_files: ProposedFile[] | null;
  error_message: string | null;
  workflow_id: string | null;
  milestone_id: string | null;
  requires_approval: boolean;
  approved_at: string | null;
  proposed_files_applied: boolean;
  conflict_warning: string | null;
  live_output: string | null;
  rolled_back_at: string | null;
  // Sprint 16: Task Router fields.
  execution_backend: 'api' | 'cli';
  cli_tool_id: string | null;
  files_changed: string[] | null;
  cli_exit_code: number | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface ClaimCliDispatch {
  task: AgentTask;
  cli_tool_id: string;
  prompt: string;
}

export interface FileSnapshotInput {
  path: string;
  previousContent: string | null;
}

export interface RollbackFile {
  path: string;
  previous_content: string | null;
}

export interface RollbackInfo {
  task_id: string;
  files: RollbackFile[];
}

export function listAgents(): Promise<AgentInfo[]> {
  return requestJson('/agents');
}

export function listAgentTasks(projectId: string | null): Promise<AgentTask[]> {
  const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
  return requestJson(`/agents/tasks${query}`);
}

export function getAgentTask(taskId: string): Promise<AgentTask> {
  return requestJson(`/agents/tasks/${encodeURIComponent(taskId)}`);
}

export function createAgentPipeline(input: {
  projectId: string | null;
  title: string;
  description: string;
  provider: string;
  model: string;
  priority?: number;
  stages?: AgentRoleKey[];
  useTaskRouter?: boolean;
}): Promise<AgentTask[]> {
  return requestJson('/agents/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: input.projectId,
      title: input.title,
      description: input.description,
      provider: input.provider,
      model: input.model,
      priority: input.priority ?? 2,
      stages: input.stages,
      use_task_router: input.useTaskRouter ?? false,
    }),
  });
}

export function cancelAgentTask(taskId: string): Promise<void> {
  return requestJson(`/agents/tasks/${encodeURIComponent(taskId)}/cancel`, { method: 'POST' });
}

export function retryAgentTask(taskId: string): Promise<AgentTask> {
  return requestJson(`/agents/tasks/${encodeURIComponent(taskId)}/retry`, { method: 'POST' });
}

export function approveAgentTask(taskId: string): Promise<AgentTask> {
  return requestJson(`/agents/tasks/${encodeURIComponent(taskId)}/approve`, { method: 'POST' });
}

export function markAgentTaskFilesApplied(
  taskId: string,
  snapshots: FileSnapshotInput[] = [],
): Promise<AgentTask> {
  return requestJson(`/agents/tasks/${encodeURIComponent(taskId)}/mark-files-applied`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      snapshots: snapshots.map((s) => ({ path: s.path, previous_content: s.previousContent })),
    }),
  });
}

export function getRollbackInfo(taskId: string): Promise<RollbackInfo> {
  return requestJson(`/agents/tasks/${encodeURIComponent(taskId)}/rollback-info`);
}

export function markAgentTaskRolledBack(taskId: string): Promise<AgentTask> {
  return requestJson(`/agents/tasks/${encodeURIComponent(taskId)}/mark-rolled-back`, {
    method: 'POST',
  });
}

export function runAgentCycle(apiKeys: Record<string, string>): Promise<{ started: number }> {
  return requestJson('/agents/run-cycle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_keys: apiKeys }),
  });
}

// Sprint 16: Task Router's CLI dispatch path — see backend
// app/ai/orchestration/manager.py's claim_cli_dispatch/record_cli_result.

export function listCliRunnableTasks(): Promise<AgentTask[]> {
  return requestJson('/agents/tasks/cli-runnable');
}

export function claimCliDispatch(taskId: string): Promise<ClaimCliDispatch> {
  return requestJson(`/agents/tasks/${encodeURIComponent(taskId)}/claim-cli-dispatch`, {
    method: 'POST',
  });
}

export function recordCliResult(
  taskId: string,
  result: {
    success: boolean;
    exitCode: number | null;
    output: string;
    filesChanged: string[];
    errorMessage: string | null;
  },
): Promise<AgentTask> {
  return requestJson(`/agents/tasks/${encodeURIComponent(taskId)}/record-cli-result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      success: result.success,
      exit_code: result.exitCode,
      output: result.output,
      files_changed: result.filesChanged,
      error_message: result.errorMessage,
    }),
  });
}
