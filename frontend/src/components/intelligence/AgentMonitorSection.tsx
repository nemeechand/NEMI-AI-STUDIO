import { useMemo } from 'react';
import { useAgents } from '../../agents/useAgents';
import { STATUS_DOT } from './sections';

type MonitorStatus = 'idle' | 'running' | 'waiting' | 'completed' | 'failed' | 'retrying';

const STATUS_LABEL: Record<MonitorStatus, string> = {
  idle: 'Idle',
  running: 'Running',
  waiting: 'Waiting',
  completed: 'Completed',
  failed: 'Failed',
  retrying: 'Retrying',
};

function deriveStatus(tasksForRole: AgentTask[]): { status: MonitorStatus; detail: string } {
  if (tasksForRole.length === 0) return { status: 'idle', detail: 'No tasks yet' };
  const running = tasksForRole.find((t) => t.status === 'running');
  if (running) return { status: 'running', detail: running.title };

  const mostRecent = [...tasksForRole].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  if (mostRecent.status === 'queued' && mostRecent.retry_count > 0) {
    return {
      status: 'retrying',
      detail: `${mostRecent.title} (attempt ${mostRecent.retry_count + 1})`,
    };
  }
  if (mostRecent.status === 'queued' && mostRecent.requires_approval && !mostRecent.approved_at) {
    return { status: 'waiting', detail: `${mostRecent.title} — awaiting approval` };
  }
  if (mostRecent.status === 'queued') return { status: 'waiting', detail: mostRecent.title };
  if (mostRecent.status === 'completed') return { status: 'completed', detail: mostRecent.title };
  if (mostRecent.status === 'failed') return { status: 'failed', detail: mostRecent.title };
  return { status: 'idle', detail: mostRecent.title };
}

export function AgentMonitorSection() {
  const { tasks } = useAgents();

  const cards = useMemo(() => {
    const byRole = (role: AgentRoleKey, projectManagerOnly = false) =>
      tasks.filter(
        (t) =>
          t.agent_role === role &&
          (projectManagerOnly ? t.milestone_id === null && t.workflow_id !== null : true),
      );

    const anyRunning = tasks.some((t) => t.status === 'running');

    return [
      { name: 'Planner', ...deriveStatus(byRole('planner')) },
      { name: 'Developer', ...deriveStatus(byRole('developer')) },
      { name: 'Reviewer', ...deriveStatus(byRole('reviewer')) },
      { name: 'Tester', ...deriveStatus(byRole('tester')) },
      { name: 'Project Manager', ...deriveStatus(byRole('planner', true)) },
      {
        name: 'Workflow Engine',
        status: (anyRunning ? 'running' : 'idle') as MonitorStatus,
        detail: anyRunning ? 'Executing scheduled tasks' : 'Idle — no tasks currently running',
      },
    ];
  }, [tasks]);

  return (
    <div className="grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <div key={card.name} className="rounded-md border border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-fg">{card.name}</span>
            <span className="flex items-center gap-1.5 text-[11px] text-fg-muted">
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[card.status]}`} />
              {STATUS_LABEL[card.status]}
            </span>
          </div>
          <p className="mt-1.5 truncate text-[11px] text-fg-muted">{card.detail}</p>
        </div>
      ))}
    </div>
  );
}
