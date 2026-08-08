import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useProject } from '../project/useProject';
import { joinPath } from '../project/pathUtils';
import { fetchWithStartupRetry } from '../lib/fetchWithStartupRetry';
import { AgentsContext, type AgentsContextValue } from './agents-context';

// A light backup poll alongside the push-driven refresh (main.ts's
// run-cycle timer sends 'agents:tasks-changed' whenever a cycle actually
// starts something) — cheap, self-healing if a push event is ever missed,
// matching the same polling-as-safety-net precedent StatusBar already
// established for backend health.
const TASK_POLL_INTERVAL_MS = 5000;

export function AgentsProvider({ children }: { children: ReactNode }) {
  const { projectId } = useProject();
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);

  useEffect(() => {
    void fetchWithStartupRetry(() => window.nemi.agents.list()).then(setAgents);
  }, []);

  const refresh = useCallback(async () => {
    const list = await window.nemi.agents.listTasks(projectId);
    setTasks(list);
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => window.nemi.agents.onTasksChanged(() => void refresh()), [refresh]);

  useEffect(() => {
    const interval = setInterval(() => void refresh(), TASK_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const createPipeline = useCallback(
    async (input: {
      title: string;
      description: string;
      provider: string;
      model: string;
      priority?: number;
      stages?: AgentRoleKey[];
    }) => {
      const created = await window.nemi.agents.createPipeline({ projectId, ...input });
      await refresh();
      return created;
    },
    [projectId, refresh],
  );

  const cancelTask = useCallback(
    async (taskId: string) => {
      await window.nemi.agents.cancelTask(taskId);
      await refresh();
    },
    [refresh],
  );

  const retryTask = useCallback(
    async (taskId: string) => {
      await window.nemi.agents.retryTask(taskId);
      await refresh();
    },
    [refresh],
  );

  // Sprint 15's Safe Change Engine: captures the file's real current
  // content (or null if it doesn't exist yet) BEFORE overwriting it, and
  // reports that to the backend as this task's rollback baseline for
  // this file — the same real snapshot the Fully-Automatic apply path
  // (WorkflowsProvider) records, now also for the manual per-file Apply
  // button every approval mode's Dashboard uses.
  const applyProposedFile = useCallback(
    async (rootPath: string, taskId: string, file: ProposedFile) => {
      const fullPath = joinPath(rootPath, file.path);
      const previousContent = await window.nemi.fs.readFile(fullPath).catch(() => null);
      await window.nemi.fs.writeFile(fullPath, file.content);
      await window.nemi.agents.markFilesApplied(taskId, [{ path: file.path, previousContent }]);
    },
    [],
  );

  const rollbackTask = useCallback(
    async (rootPath: string, taskId: string) => {
      const info = await window.nemi.agents.getRollbackInfo(taskId);
      for (const file of info.files) {
        const fullPath = joinPath(rootPath, file.path);
        if (file.previous_content === null) {
          await window.nemi.fs.deleteEntry(fullPath).catch(() => {});
        } else {
          await window.nemi.fs.writeFile(fullPath, file.previous_content);
        }
      }
      await window.nemi.agents.markRolledBack(taskId);
      await refresh();
    },
    [refresh],
  );

  const value = useMemo<AgentsContextValue>(
    () => ({
      agents,
      tasks,
      createPipeline,
      cancelTask,
      retryTask,
      applyProposedFile,
      rollbackTask,
      refresh,
    }),
    [
      agents,
      tasks,
      createPipeline,
      cancelTask,
      retryTask,
      applyProposedFile,
      rollbackTask,
      refresh,
    ],
  );

  return <AgentsContext.Provider value={value}>{children}</AgentsContext.Provider>;
}
