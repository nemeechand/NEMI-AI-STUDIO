import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, MessageSquare, Pause, Play, X } from 'lucide-react';
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

const RISK_LABEL: Record<RiskLevel, string> = {
  low: 'Low risk',
  medium: 'Medium risk',
  high: 'High risk',
  unknown: 'Risk unknown',
};
const RISK_CLASS: Record<RiskLevel, string> = {
  low: 'text-success',
  medium: 'text-warning',
  high: 'text-danger',
  unknown: 'text-fg-muted',
};

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
  const [summary, setSummary] = useState<FeatureSummary | null>(null);
  const [documentationOpen, setDocumentationOpen] = useState(false);

  // Sprint 15's Feature Approval summary — real data assembled server-side
  // from this workflow's own tasks/snapshots/test result (see
  // GET /workflows/{id}/summary), re-fetched whenever the task count
  // changes since that's what the summary is derived from.
  useEffect(() => {
    window.nemi.workflows
      .getSummary(workflow.id)
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [workflow.id, workflow.tasks.length]);

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

      {summary &&
        (summary.files_changed.length > 0 ||
          summary.files_created.length > 0 ||
          summary.test_result ||
          workflow.documentation) && (
          <div className="space-y-1.5 rounded border border-border px-2 py-1.5">
            <div className="flex items-center justify-between">
              <p className="font-medium text-fg">Feature summary</p>
              <span className={`text-[10px] font-medium ${RISK_CLASS[summary.risk_level]}`}>
                {RISK_LABEL[summary.risk_level]}
              </span>
            </div>
            <p className="text-[11px] text-fg-muted">
              {summary.files_created.length} file(s) created, {summary.files_changed.length} changed
              {summary.files_removed.length > 0 ? `, ${summary.files_removed.length} removed` : ''}.
            </p>
            {summary.test_result ? (
              <p
                className={`text-[11px] ${summary.test_result.passed ? 'text-success' : 'text-danger'}`}
              >
                Tests {summary.test_result.passed ? 'passed' : 'failed'}
                {summary.test_result.exit_code !== null
                  ? ` (exit code ${summary.test_result.exit_code})`
                  : ''}
              </p>
            ) : (
              <p className="text-[11px] text-fg-muted">Tests: not run.</p>
            )}
            {workflow.documentation && (
              <div>
                <button
                  type="button"
                  onClick={() => setDocumentationOpen((prev) => !prev)}
                  className="flex items-center gap-1 text-[11px] text-accent hover:underline"
                >
                  {documentationOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  Documentation generated
                </button>
                {documentationOpen && (
                  <pre className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded border border-border bg-surface px-1.5 py-1 text-[10px] text-fg-muted">
                    {workflow.documentation}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}

      <p className="text-[10px] text-fg-muted">
        Resource usage and backend logs live in the Live Dashboard (Ctrl+Shift+I) — Health Center,
        Resources, and Terminal sections.
      </p>
    </div>
  );
}
