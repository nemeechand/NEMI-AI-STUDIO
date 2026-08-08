import { useState } from 'react';
import { Check, MessageSquare, Plus, RotateCcw, X } from 'lucide-react';
import { useAgents } from '../../agents/useAgents';
import { useAi } from '../../ai/useAi';
import { useProject } from '../../project/useProject';
import { ROLE_ICONS, ROLE_LABELS, STATUS_DOT_CLASS, STATUS_LABELS } from './roleMeta';
import { WorkflowsList } from './WorkflowsList';

type DashboardTab = 'tasks' | 'workflows';

interface AgentsDashboardProps {
  onNewTask: () => void;
  onNewWorkflow: () => void;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

export function AgentsDashboard({ onNewTask, onNewWorkflow }: AgentsDashboardProps) {
  const { tasks, cancelTask, retryTask, applyProposedFile } = useAgents();
  const { openConversation } = useAi();
  const { projectPath } = useProject();
  const [activeTab, setActiveTab] = useState<DashboardTab>('tasks');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [appliedPaths, setAppliedPaths] = useState<Record<string, true>>({});

  const sortedTasks = [...tasks].sort((a, b) => b.created_at.localeCompare(a.created_at));

  async function handleApply(taskId: string, file: ProposedFile) {
    if (!projectPath) return;
    await applyProposedFile(projectPath, file);
    setAppliedPaths((prev) => ({ ...prev, [`${taskId}:${file.path}`]: true }));
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-r border-border bg-surface-elevated">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Agents</span>
        <button
          type="button"
          onClick={activeTab === 'tasks' ? onNewTask : onNewWorkflow}
          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-fg hover:border-accent hover:text-accent"
        >
          <Plus size={12} /> {activeTab === 'tasks' ? 'New Task' : 'New Goal'}
        </button>
      </div>
      <div className="flex gap-1 px-2 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('tasks')}
          className={`flex-1 rounded-md px-2 py-1 text-xs ${
            activeTab === 'tasks' ? 'bg-surface text-fg' : 'text-fg-muted hover:text-fg'
          }`}
        >
          Tasks
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('workflows')}
          className={`flex-1 rounded-md px-2 py-1 text-xs ${
            activeTab === 'workflows' ? 'bg-surface text-fg' : 'text-fg-muted hover:text-fg'
          }`}
        >
          Goals
        </button>
      </div>
      {activeTab === 'workflows' ? (
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          <WorkflowsList />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {sortedTasks.length === 0 && (
            <p className="px-1 text-xs text-fg-muted">
              No agent tasks yet. Start a pipeline to have the Planner, Developer, Reviewer, and
              Tester agents work through a goal together.
            </p>
          )}
          {sortedTasks.map((task) => {
            const RoleIcon = ROLE_ICONS[task.agent_role];
            const expanded = expandedId === task.id;
            const conversationId = task.conversation_id;
            return (
              <div key={task.id} className="mb-1.5 rounded-md border border-border bg-surface">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : task.id)}
                  className="flex w-full items-start gap-2 px-2.5 py-2 text-left"
                >
                  <RoleIcon size={14} className="mt-0.5 shrink-0 text-fg-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-medium text-fg">{task.title}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-fg-muted">
                      <span>{ROLE_LABELS[task.agent_role]}</span>
                      <span>&middot;</span>
                      <span className="flex items-center gap-1">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_CLASS[task.status]}`}
                        />
                        {STATUS_LABELS[task.status]}
                        {task.status === 'failed' && task.retry_count > 0
                          ? ` (retry ${task.retry_count}/${task.max_retries})`
                          : ''}
                      </span>
                    </div>
                  </div>
                </button>
                {expanded && (
                  <div className="space-y-2 border-t border-border px-2.5 py-2 text-xs">
                    <p className="whitespace-pre-wrap text-fg-muted">{task.description}</p>
                    <p className="text-[11px] text-fg-muted">
                      {task.provider} / {task.model} &middot; created{' '}
                      {formatTimestamp(task.created_at)}
                    </p>
                    {task.result_summary && (
                      <div>
                        <p className="mb-0.5 font-medium text-fg">Result</p>
                        <p className="whitespace-pre-wrap text-fg-muted">{task.result_summary}</p>
                      </div>
                    )}
                    {task.error_message && (
                      <div>
                        <p className="mb-0.5 font-medium text-danger">Error</p>
                        <p className="whitespace-pre-wrap text-danger">{task.error_message}</p>
                      </div>
                    )}
                    {task.proposed_files && task.proposed_files.length > 0 && (
                      <div className="space-y-1">
                        <p className="font-medium text-fg">Proposed files</p>
                        {task.proposed_files.map((file) => {
                          const applied = appliedPaths[`${task.id}:${file.path}`];
                          return (
                            <div
                              key={file.path}
                              className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1"
                            >
                              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-fg">
                                {file.path}
                              </span>
                              <button
                                type="button"
                                disabled={!projectPath || applied}
                                onClick={() => void handleApply(task.id, file)}
                                className="flex shrink-0 items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[11px] text-fg hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Check size={11} /> {applied ? 'Applied' : 'Apply'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {conversationId && (
                        <button
                          type="button"
                          onClick={() => openConversation(conversationId)}
                          className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-fg hover:border-accent hover:text-accent"
                        >
                          <MessageSquare size={11} /> View Conversation
                        </button>
                      )}
                      {(task.status === 'queued' || task.status === 'running') && (
                        <button
                          type="button"
                          onClick={() => void cancelTask(task.id)}
                          className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-fg hover:border-danger hover:text-danger"
                        >
                          <X size={11} /> Cancel
                        </button>
                      )}
                      {(task.status === 'failed' || task.status === 'cancelled') && (
                        <button
                          type="button"
                          onClick={() => void retryTask(task.id)}
                          className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-fg hover:border-accent hover:text-accent"
                        >
                          <RotateCcw size={11} /> Retry
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
