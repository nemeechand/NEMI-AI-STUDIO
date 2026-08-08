import { useMemo } from 'react';
import { useAgents } from '../../agents/useAgents';
import { useActiveWorkflow } from './useActiveWorkflow';

export function AiThinkingSection() {
  const { tasks } = useAgents();
  const workflow = useActiveWorkflow();

  const runningTask = useMemo(
    () =>
      [...tasks]
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .find((t) => t.status === 'running'),
    [tasks],
  );

  const milestone = runningTask
    ? workflow?.milestones.find((m) => m.id === runningTask.milestone_id)
    : undefined;
  const dependency = runningTask?.depends_on_task_id
    ? tasks.find((t) => t.id === runningTask.depends_on_task_id)
    : undefined;

  if (!runningTask) {
    return (
      <p className="text-xs text-fg-muted">
        No agent is currently running — nothing to show reasoning for.
      </p>
    );
  }

  return (
    <div className="max-w-2xl space-y-3">
      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
        <Field label="Current Action" value={`${runningTask.agent_role} is working`} />
        <Field label="Current Objective" value={runningTask.title} />
        <Field label="Current Milestone" value={milestone?.title ?? 'None (standalone task)'} />
        <Field label="Current Dependency" value={dependency ? dependency.title : 'None'} />
        <Field
          label="Current File"
          value={
            runningTask.agent_role === 'developer'
              ? 'Not tracked at file-level granularity'
              : 'N/A for this role'
          }
        />
        <Field label="Provider / Model" value={`${runningTask.provider} / ${runningTask.model}`} />
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-fg">Current Reasoning (live model output)</p>
        <div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded border border-border bg-surface-elevated p-3 font-mono text-[11px] text-fg-muted">
          {runningTask.live_output ??
            'Waiting for the first streamed tokens (updates every ~1.5s while running)…'}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-fg-muted">{label}</div>
      <div className="truncate text-xs text-fg">{value}</div>
    </div>
  );
}
