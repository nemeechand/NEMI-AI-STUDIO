import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useProject } from '../project/useProject';
import { joinPath } from '../project/pathUtils';
import { fetchWithStartupRetry } from '../lib/fetchWithStartupRetry';
import { WorkflowsContext, type WorkflowsContextValue } from './workflows-context';

// Matches AgentsProvider's own poll cadence — a light backup alongside
// whatever push events exist (agents:tasks-changed, reused here since a
// workflow's tasks are agent_tasks too), self-healing if one is ever missed.
const POLL_INTERVAL_MS = 5000;

export function WorkflowsProvider({ children }: { children: ReactNode }) {
  const { projectId, projectPath } = useProject();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDetail | null>(null);
  // Tracks task ids already auto-applied THIS session so a fresh 'auto'
  // workflow's proposed files are only ever written once, even if a poll
  // races the mark-files-applied round trip.
  const autoAppliedRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const list = await window.nemi.workflows.list(projectId);
    setWorkflows(list);

    if (selectedId) {
      const detail = await window.nemi.workflows.get(selectedId).catch(() => null);
      setSelectedWorkflow(detail);
    }

    // Human Approval Mode = Fully Automatic: apply a completed Developer
    // stage's proposed files without waiting for a click, then record
    // that it happened server-side (the same mark-files-applied the
    // manual Apply button uses) so a later poll doesn't repeat it.
    const autoWorkflows = list.filter(
      (w) => w.approval_mode === 'auto' && (w.status === 'queued' || w.status === 'running'),
    );
    for (const workflow of autoWorkflows) {
      if (!projectPath) continue;
      const detail =
        workflow.id === selectedId && selectedWorkflow
          ? selectedWorkflow
          : await window.nemi.workflows.get(workflow.id).catch(() => null);
      if (!detail) continue;
      for (const task of detail.tasks) {
        if (
          task.status !== 'completed' ||
          task.proposed_files_applied ||
          !task.proposed_files?.length ||
          autoAppliedRef.current.has(task.id)
        ) {
          continue;
        }
        autoAppliedRef.current.add(task.id);
        for (const file of task.proposed_files) {
          await window.nemi.fs.writeFile(joinPath(projectPath, file.path), file.content);
        }
        await window.nemi.agents.markFilesApplied(task.id);
      }
    }
  }, [projectId, projectPath, selectedId, selectedWorkflow]);

  useEffect(() => {
    void fetchWithStartupRetry(() => window.nemi.workflows.list(projectId)).then(setWorkflows);
  }, [projectId]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, selectedId]);

  useEffect(() => window.nemi.agents.onTasksChanged(() => void refresh()), [refresh]);

  useEffect(() => {
    const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const selectWorkflow = useCallback((id: string | null) => {
    setSelectedId(id);
    if (!id) setSelectedWorkflow(null);
  }, []);

  const createWorkflow = useCallback(
    async (input: {
      title: string;
      goal: string;
      provider: string;
      model: string;
      approvalMode: ApprovalMode;
    }) => {
      const created = await window.nemi.workflows.create({ projectId, ...input });
      await refresh();
      return created;
    },
    [projectId, refresh],
  );

  const pauseWorkflow = useCallback(
    async (id: string) => {
      await window.nemi.workflows.pause(id);
      await refresh();
    },
    [refresh],
  );

  const resumeWorkflow = useCallback(
    async (id: string) => {
      await window.nemi.workflows.resume(id);
      await refresh();
    },
    [refresh],
  );

  const cancelWorkflow = useCallback(
    async (id: string) => {
      await window.nemi.workflows.cancel(id);
      await refresh();
    },
    [refresh],
  );

  const approveTask = useCallback(
    async (taskId: string) => {
      await window.nemi.agents.approveTask(taskId);
      await refresh();
    },
    [refresh],
  );

  const value = useMemo<WorkflowsContextValue>(
    () => ({
      workflows,
      selectedWorkflow,
      selectWorkflow,
      createWorkflow,
      pauseWorkflow,
      resumeWorkflow,
      cancelWorkflow,
      approveTask,
      refresh,
    }),
    [
      workflows,
      selectedWorkflow,
      selectWorkflow,
      createWorkflow,
      pauseWorkflow,
      resumeWorkflow,
      cancelWorkflow,
      approveTask,
      refresh,
    ],
  );

  return <WorkflowsContext.Provider value={value}>{children}</WorkflowsContext.Provider>;
}
