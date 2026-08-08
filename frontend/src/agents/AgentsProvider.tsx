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

  const applyProposedFile = useCallback(async (rootPath: string, file: ProposedFile) => {
    await window.nemi.fs.writeFile(joinPath(rootPath, file.path), file.content);
  }, []);

  const value = useMemo<AgentsContextValue>(
    () => ({ agents, tasks, createPipeline, cancelTask, retryTask, applyProposedFile, refresh }),
    [agents, tasks, createPipeline, cancelTask, retryTask, applyProposedFile, refresh],
  );

  return <AgentsContext.Provider value={value}>{children}</AgentsContext.Provider>;
}
