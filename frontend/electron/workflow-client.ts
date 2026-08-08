import { BACKEND_HOST, BACKEND_PORT } from './backend-client';
import type { AgentTask } from './agent-client';

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

export type WorkflowStatus =
  'planning' | 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type ApprovalMode = 'auto' | 'review' | 'manual';
export type MilestoneStatus =
  'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Milestone {
  id: string;
  workflow_id: string;
  title: string;
  description: string;
  order_index: number;
  status: MilestoneStatus;
  created_at: string;
  updated_at: string;
}

export interface Workflow {
  id: string;
  project_id: string | null;
  title: string;
  goal: string;
  status: WorkflowStatus;
  approval_mode: ApprovalMode;
  provider: string;
  model: string;
  conversation_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface WorkflowDetail extends Workflow {
  milestones: Milestone[];
  tasks: AgentTask[];
}

export function listWorkflows(projectId: string | null): Promise<Workflow[]> {
  const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
  return requestJson(`/workflows${query}`);
}

export function getWorkflow(workflowId: string): Promise<WorkflowDetail> {
  return requestJson(`/workflows/${encodeURIComponent(workflowId)}`);
}

export function createWorkflow(input: {
  projectId: string | null;
  title: string;
  goal: string;
  provider: string;
  model: string;
  approvalMode: ApprovalMode;
}): Promise<Workflow> {
  return requestJson('/workflows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: input.projectId,
      title: input.title,
      goal: input.goal,
      provider: input.provider,
      model: input.model,
      approval_mode: input.approvalMode,
    }),
  });
}

export function pauseWorkflow(workflowId: string): Promise<Workflow> {
  return requestJson(`/workflows/${encodeURIComponent(workflowId)}/pause`, { method: 'POST' });
}

export function resumeWorkflow(workflowId: string): Promise<Workflow> {
  return requestJson(`/workflows/${encodeURIComponent(workflowId)}/resume`, { method: 'POST' });
}

export function cancelWorkflow(workflowId: string): Promise<Workflow> {
  return requestJson(`/workflows/${encodeURIComponent(workflowId)}/cancel`, { method: 'POST' });
}
