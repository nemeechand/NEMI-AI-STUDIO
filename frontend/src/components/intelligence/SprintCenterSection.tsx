import { useMemo } from 'react';
import {
  MILESTONE_STATUS_LABELS,
  WORKFLOW_STATUS_DOT_CLASS,
  WORKFLOW_STATUS_LABELS,
} from '../agents/roleMeta';
import { formatDuration } from './sections';
import { useActiveWorkflow } from './useActiveWorkflow';

function computeEta(tasks: AgentTask[]): number | null {
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
  return (avgMs * remaining) / 1000;
}

export function SprintCenterSection() {
  const workflow = useActiveWorkflow();

  const stats = useMemo(() => {
    if (!workflow) return null;
    const counters = { queued: 0, running: 0, completed: 0, failed: 0, cancelled: 0 };
    for (const task of workflow.tasks) counters[task.status]++;
    const percentage =
      workflow.tasks.length === 0
        ? 0
        : Math.round((counters.completed / workflow.tasks.length) * 100);
    const currentTask = workflow.tasks.find((t) => t.status === 'running') ?? null;
    const currentMilestone = currentTask
      ? workflow.milestones.find((m) => m.id === currentTask.milestone_id)
      : (workflow.milestones.find((m) => m.status === 'running') ?? null);
    const remainingTasks = workflow.tasks.filter(
      (t) => t.status === 'queued' || t.status === 'running',
    );
    const elapsedSeconds = workflow.started_at
      ? (Date.now() - new Date(workflow.started_at).getTime()) / 1000
      : null;
    return { counters, percentage, currentTask, currentMilestone, remainingTasks, elapsedSeconds };
  }, [workflow]);

  if (!workflow || !stats) {
    return (
      <p className="text-xs text-fg-muted">
        No active sprint. Start a goal from the Agents panel's Goals tab to see it here.
      </p>
    );
  }

  const eta = computeEta(workflow.tasks);

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-fg">{workflow.title}</h2>
          <span className="flex items-center gap-1.5 text-xs text-fg-muted">
            <span
              className={`h-1.5 w-1.5 rounded-full ${WORKFLOW_STATUS_DOT_CLASS[workflow.status]}`}
            />
            {WORKFLOW_STATUS_LABELS[workflow.status]}
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${stats.percentage}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-fg-muted">{stats.percentage}% complete</p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
        <Stat label="Current Phase" value={stats.currentMilestone?.title ?? '—'} />
        <Stat label="Current Task" value={stats.currentTask?.title ?? 'Idle'} />
        <Stat
          label="Current Agent"
          value={stats.currentTask ? stats.currentTask.agent_role : '—'}
        />
        <Stat label="ETA" value={eta !== null ? formatDuration(eta) : 'Calculating…'} />
        <Stat
          label="Elapsed Time"
          value={stats.elapsedSeconds !== null ? formatDuration(stats.elapsedSeconds) : '—'}
        />
        <Stat label="Remaining Tasks" value={String(stats.remainingTasks.length)} />
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-fg">Sprint Timeline</p>
        <div className="space-y-1.5">
          {workflow.milestones.length === 0 && (
            <p className="text-xs text-fg-muted">No milestones yet — still planning.</p>
          )}
          {workflow.milestones.map((milestone) => (
            <div
              key={milestone.id}
              className="flex items-center justify-between rounded border border-border px-2.5 py-1.5 text-xs"
            >
              <span className="text-fg">{milestone.title}</span>
              <span className="text-fg-muted">{MILESTONE_STATUS_LABELS[milestone.status]}</span>
            </div>
          ))}
        </div>
      </div>

      {stats.remainingTasks.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-fg">Remaining Tasks</p>
          <div className="space-y-1">
            {stats.remainingTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between text-xs">
                <span className="text-fg-muted">{task.title}</span>
                <span className="text-fg-muted">{task.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-fg-muted">{label}</div>
      <div className="truncate text-xs text-fg">{value}</div>
    </div>
  );
}
