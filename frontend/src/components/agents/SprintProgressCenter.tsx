import { useEffect, useMemo, useState } from 'react';
import { Check, MessageSquare, Pause, Play, X } from 'lucide-react';
import { useAi } from '../../ai/useAi';
import { useWorkflows } from '../../workflows/useWorkflows';
import {
  APPROVAL_MODE_LABELS,
  MILESTONE_STATUS_LABELS,
  ROLE_ICONS,
  STATUS_LABELS,
  WORKFLOW_STATUS_DOT_CLASS,
  WORKFLOW_STATUS_LABELS,
} from './roleMeta';

const LOG_POLL_INTERVAL_MS = 5000;
const RESOURCE_POLL_INTERVAL_MS = 5000;
const LOG_LIMIT = 30;

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function computeEta(tasks: AgentTask[]): string | null {
  const completed = tasks.filter((t) => t.status === 'completed' && t.started_at && t.completed_at);
  const remaining = tasks.filter((t) => t.status === 'queued' || t.status === 'running').length;
  if (completed.length === 0 || remaining === 0) return null;
  const avgMs =
    completed.reduce(
      (sum, t) =>
        sum +
        (new Date(t.completed_at as string).getTime() - new Date(t.started_at as string).getTime()),
      0,
    ) / completed.length;
  return formatDuration(avgMs * remaining);
}

interface SprintProgressCenterProps {
  workflow: WorkflowDetail;
}

export function SprintProgressCenter({ workflow }: SprintProgressCenterProps) {
  const { pauseWorkflow, resumeWorkflow, cancelWorkflow, approveTask } = useWorkflows();
  const { openConversation } = useAi();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [resourceUsage, setResourceUsage] = useState<ResourceUsage | null>(null);

  useEffect(() => {
    // The backend's Python `logging` module output (which is where the
    // orchestrator's own log lines go — see docs/ARCHITECTURE.md's Sprint 4
    // decision that centralized logging is console/file, separate from
    // this structured `logs` table) is forwarded here only via the
    // backend.stdout/backend.stderr rows the Logger Panel already reads.
    // Individual log lines aren't tagged with a workflow id, so this is
    // honestly "recent backend activity", not activity scoped to this one
    // workflow exclusively.
    async function fetchLogs() {
      const result = await window.nemi.backend.logs(LOG_LIMIT).catch(() => []);
      setLogs(result.filter((entry) => entry.source.startsWith('backend.')));
    }
    void fetchLogs();
    const interval = setInterval(() => void fetchLogs(), LOG_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [workflow.id]);

  useEffect(() => {
    async function fetchUsage() {
      const usage = await window.nemi.system.getResourceUsage().catch(() => null);
      setResourceUsage(usage);
    }
    void fetchUsage();
    const interval = setInterval(() => void fetchUsage(), RESOURCE_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const counters = useMemo(() => {
    const base = { queued: 0, running: 0, completed: 0, failed: 0, cancelled: 0 };
    for (const task of workflow.tasks) base[task.status]++;
    return base;
  }, [workflow.tasks]);

  const percentage =
    workflow.tasks.length === 0
      ? 0
      : Math.round((counters.completed / workflow.tasks.length) * 100);

  const currentTask = workflow.tasks.find((t) => t.status === 'running') ?? null;
  const eta = computeEta(workflow.tasks);

  return (
    <div className="space-y-3 border-t border-border px-2.5 py-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-fg-muted">
          <span
            className={`h-1.5 w-1.5 rounded-full ${WORKFLOW_STATUS_DOT_CLASS[workflow.status]}`}
          />
          {WORKFLOW_STATUS_LABELS[workflow.status]}
        </span>
        <span className="text-[11px] text-fg-muted">
          {APPROVAL_MODE_LABELS[workflow.approval_mode]}
        </span>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-[11px] text-fg-muted">
          <span>Sprint progress</span>
          <span>{percentage}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
          <div className="h-full bg-accent transition-all" style={{ width: `${percentage}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5 text-center">
        <div className="rounded border border-border px-1.5 py-1">
          <div className="text-sm font-semibold text-fg">{counters.completed}</div>
          <div className="text-[10px] text-fg-muted">Completed</div>
        </div>
        <div className="rounded border border-border px-1.5 py-1">
          <div className="text-sm font-semibold text-accent">{counters.running}</div>
          <div className="text-[10px] text-fg-muted">Running</div>
        </div>
        <div className="rounded border border-border px-1.5 py-1">
          <div className="text-sm font-semibold text-fg-muted">{counters.queued}</div>
          <div className="text-[10px] text-fg-muted">Queued</div>
        </div>
        <div className="rounded border border-border px-1.5 py-1">
          <div className="text-sm font-semibold text-danger">{counters.failed}</div>
          <div className="text-[10px] text-fg-muted">Failed</div>
        </div>
      </div>

      <div className="space-y-0.5 text-[11px] text-fg-muted">
        <p>
          Current agent:{' '}
          <span className="text-fg">
            {currentTask ? `${currentTask.agent_role} — ${currentTask.title}` : 'Idle'}
          </span>
        </p>
        <p>
          ETA: <span className="text-fg">{eta ?? 'Calculating…'}</span>
        </p>
        {resourceUsage && (
          <p>
            Backend resource usage:{' '}
            <span className="text-fg">
              {resourceUsage.memoryMb.toFixed(0)} MB
              {resourceUsage.cpuPercent !== null
                ? ` · ${resourceUsage.cpuPercent.toFixed(0)}% CPU`
                : ''}
            </span>
          </p>
        )}
        {workflow.error_message && <p className="text-danger">{workflow.error_message}</p>}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(workflow.status === 'planning' ||
          workflow.status === 'queued' ||
          workflow.status === 'running') && (
          <button
            type="button"
            onClick={() => void pauseWorkflow(workflow.id)}
            className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-fg hover:border-accent hover:text-accent"
          >
            <Pause size={11} /> Pause
          </button>
        )}
        {workflow.status === 'paused' && (
          <button
            type="button"
            onClick={() => void resumeWorkflow(workflow.id)}
            className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-fg hover:border-accent hover:text-accent"
          >
            <Play size={11} /> Resume
          </button>
        )}
        {!['completed', 'failed', 'cancelled'].includes(workflow.status) && (
          <button
            type="button"
            onClick={() => void cancelWorkflow(workflow.id)}
            className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-fg hover:border-danger hover:text-danger"
          >
            <X size={11} /> Cancel
          </button>
        )}
      </div>

      {workflow.milestones.length > 0 && (
        <div className="space-y-1.5">
          <p className="font-medium text-fg">Milestones</p>
          {workflow.milestones.map((milestone) => {
            const milestoneTasks = workflow.tasks.filter((t) => t.milestone_id === milestone.id);
            return (
              <div key={milestone.id} className="rounded border border-border px-2 py-1.5">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-medium text-fg">{milestone.title}</span>
                  <span className="text-[10px] text-fg-muted">
                    {MILESTONE_STATUS_LABELS[milestone.status]}
                  </span>
                </div>
                <div className="space-y-1">
                  {milestoneTasks.map((task) => {
                    const RoleIcon = ROLE_ICONS[task.agent_role];
                    return (
                      <div key={task.id} className="flex items-center gap-1.5">
                        <RoleIcon size={11} className="shrink-0 text-fg-muted" />
                        <span className="min-w-0 flex-1 truncate text-[11px] text-fg-muted">
                          {STATUS_LABELS[task.status]}
                          {task.conflict_warning ? ' · conflict' : ''}
                        </span>
                        {task.requires_approval && !task.approved_at && (
                          <button
                            type="button"
                            onClick={() => void approveTask(task.id)}
                            className="flex shrink-0 items-center gap-1 rounded border border-accent px-1.5 py-0.5 text-[10px] text-accent"
                          >
                            <Check size={10} /> Approve
                          </button>
                        )}
                        {task.conversation_id && (
                          <button
                            type="button"
                            onClick={() => openConversation(task.conversation_id as string)}
                            className="shrink-0 text-fg-muted hover:text-accent"
                            aria-label="View conversation"
                          >
                            <MessageSquare size={11} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {logs.length > 0 && (
        <div>
          <p className="mb-1 font-medium text-fg">Recent backend activity</p>
          <div className="max-h-32 space-y-0.5 overflow-y-auto rounded border border-border bg-surface px-1.5 py-1 font-mono text-[10px] text-fg-muted">
            {logs.map((entry) => (
              <div key={entry.id} className="truncate">
                {entry.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
