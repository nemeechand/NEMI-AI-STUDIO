import { ChevronDown } from 'lucide-react';
import { useActiveWorkflow } from './useActiveWorkflow';

type NodeState = 'pending' | 'current' | 'done' | 'not-automated';

interface Node {
  label: string;
  state: NodeState;
}

const STATE_CLASS: Record<NodeState, string> = {
  pending: 'border-border text-fg-muted',
  current: 'border-accent bg-accent/10 text-accent',
  done: 'border-success bg-success/10 text-success',
  'not-automated': 'border-dashed border-border text-fg-muted opacity-60',
};

function buildNodes(workflow: WorkflowDetail | null): Node[] {
  if (!workflow) {
    return [
      { label: 'Goal', state: 'pending' },
      { label: 'Planning', state: 'pending' },
      { label: 'Development', state: 'pending' },
      { label: 'Review', state: 'pending' },
      { label: 'Testing', state: 'pending' },
      { label: 'Documentation', state: 'not-automated' },
      { label: 'Commit', state: 'not-automated' },
      { label: 'Push', state: 'not-automated' },
      { label: 'Completed', state: 'pending' },
    ];
  }

  const roleStatus = (role: AgentRoleKey): NodeState => {
    const roleTasks = workflow.tasks.filter((t) => t.agent_role === role);
    if (roleTasks.some((t) => t.status === 'running')) return 'current';
    if (roleTasks.length > 0 && roleTasks.every((t) => t.status === 'completed')) return 'done';
    if (roleTasks.some((t) => t.status === 'completed')) return 'current';
    return 'pending';
  };

  const goalState: NodeState = 'done'; // the goal always exists once a workflow exists
  const completedState: NodeState = workflow.status === 'completed' ? 'done' : 'pending';

  return [
    { label: 'Goal', state: goalState },
    { label: 'Planning', state: roleStatus('planner') },
    { label: 'Development', state: roleStatus('developer') },
    { label: 'Review', state: roleStatus('reviewer') },
    { label: 'Testing', state: roleStatus('tester') },
    { label: 'Documentation', state: 'not-automated' },
    { label: 'Commit', state: 'not-automated' },
    { label: 'Push', state: 'not-automated' },
    { label: 'Completed', state: completedState },
  ];
}

export function WorkflowViewSection() {
  const workflow = useActiveWorkflow();
  const nodes = buildNodes(workflow);

  return (
    <div className="max-w-md">
      {!workflow && (
        <p className="mb-3 text-xs text-fg-muted">
          No active sprint — showing the pipeline shape only.
        </p>
      )}
      <div className="flex flex-col items-center gap-1">
        {nodes.map((node, index) => (
          <div key={node.label} className="flex flex-col items-center gap-1">
            <div
              className={`w-56 rounded-md border px-3 py-2 text-center text-xs ${STATE_CLASS[node.state]}`}
            >
              {node.label}
              {node.state === 'not-automated' && (
                <span className="block text-[10px]">not yet automated — performed manually</span>
              )}
            </div>
            {index < nodes.length - 1 && <ChevronDown size={14} className="text-fg-muted" />}
          </div>
        ))}
      </div>
    </div>
  );
}
