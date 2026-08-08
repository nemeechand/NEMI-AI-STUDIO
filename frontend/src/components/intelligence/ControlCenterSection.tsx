import { Pause, Play, RotateCcw, X } from 'lucide-react';
import { useWorkflows } from '../../workflows/useWorkflows';
import { WORKFLOW_STATUS_DOT_CLASS, WORKFLOW_STATUS_LABELS } from '../agents/roleMeta';

export function ControlCenterSection() {
  const { workflows, pauseWorkflow, resumeWorkflow, cancelWorkflow } = useWorkflows();

  async function restart(workflowId: string) {
    await window.nemi.workflows.restart(workflowId);
  }

  const sorted = [...workflows].sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  return (
    <div className="max-w-2xl space-y-3">
      <p className="text-[11px] text-fg-muted">
        "Resume After Restart" needs no button — any task still marked running when the backend last
        shut down is automatically requeued the moment it starts back up (see the Notifications
        section for a record of when that happens).
      </p>
      {sorted.length === 0 && (
        <p className="text-xs text-fg-muted">No sprints yet — start a goal to see it here.</p>
      )}
      {sorted.map((workflow) => (
        <div
          key={workflow.id}
          className="flex items-center justify-between rounded border border-border px-3 py-2"
        >
          <div>
            <p className="text-xs text-fg">{workflow.title}</p>
            <span className="flex items-center gap-1.5 text-[11px] text-fg-muted">
              <span
                className={`h-1.5 w-1.5 rounded-full ${WORKFLOW_STATUS_DOT_CLASS[workflow.status]}`}
              />
              {WORKFLOW_STATUS_LABELS[workflow.status]}
            </span>
          </div>
          <div className="flex gap-1.5">
            {(workflow.status === 'planning' ||
              workflow.status === 'queued' ||
              workflow.status === 'running') && (
              <IconAction
                icon={Pause}
                label="Pause"
                onClick={() => void pauseWorkflow(workflow.id)}
              />
            )}
            {workflow.status === 'paused' && (
              <IconAction
                icon={Play}
                label="Resume"
                onClick={() => void resumeWorkflow(workflow.id)}
              />
            )}
            {(workflow.status === 'failed' || workflow.status === 'cancelled') && (
              <IconAction
                icon={RotateCcw}
                label="Restart Workflow"
                onClick={() => void restart(workflow.id)}
              />
            )}
            {!['completed', 'failed', 'cancelled'].includes(workflow.status) && (
              <IconAction
                icon={X}
                label="Cancel"
                onClick={() => void cancelWorkflow(workflow.id)}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function IconAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Pause;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-fg hover:border-accent hover:text-accent"
    >
      <Icon size={11} />
    </button>
  );
}
