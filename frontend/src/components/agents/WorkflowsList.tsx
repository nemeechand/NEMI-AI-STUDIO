import { useWorkflows } from '../../workflows/useWorkflows';
import { WORKFLOW_STATUS_DOT_CLASS, WORKFLOW_STATUS_LABELS } from './roleMeta';
import { SprintProgressCenter } from './SprintProgressCenter';

export function WorkflowsList() {
  const { workflows, selectedWorkflow, selectWorkflow } = useWorkflows();
  const sortedWorkflows = [...workflows].sort((a, b) => b.created_at.localeCompare(a.created_at));

  if (sortedWorkflows.length === 0) {
    return (
      <p className="px-1 text-xs text-fg-muted">
        No goals yet. Give the AI Project Manager a high-level goal and it will break it into
        milestones, each run through its own Planner/Developer/Reviewer/Tester pipeline.
      </p>
    );
  }

  return (
    <div>
      {sortedWorkflows.map((workflow) => {
        const expanded = selectedWorkflow?.id === workflow.id;
        return (
          <div key={workflow.id} className="mb-1.5 rounded-md border border-border bg-surface">
            <button
              type="button"
              onClick={() => selectWorkflow(expanded ? null : workflow.id)}
              className="flex w-full items-start gap-2 px-2.5 py-2 text-left"
            >
              <div className="min-w-0 flex-1">
                <span className="truncate text-xs font-medium text-fg">{workflow.title}</span>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-fg-muted">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${WORKFLOW_STATUS_DOT_CLASS[workflow.status]}`}
                  />
                  {WORKFLOW_STATUS_LABELS[workflow.status]}
                </div>
              </div>
            </button>
            {expanded && selectedWorkflow && <SprintProgressCenter workflow={selectedWorkflow} />}
          </div>
        );
      })}
    </div>
  );
}
