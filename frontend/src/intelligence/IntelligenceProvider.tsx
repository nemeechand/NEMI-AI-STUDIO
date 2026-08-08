import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useProject } from '../project/useProject';
import { useAgents } from '../agents/useAgents';
import { useWorkflows } from '../workflows/useWorkflows';
import {
  IntelligenceContext,
  type AppNotification,
  type IntelligenceContextValue,
  type RunnerViewState,
} from './intelligence-context';

const STATS_POLL_INTERVAL_MS = 8000;
const SYSTEM_POLL_INTERVAL_MS = 5000;
const GIT_POLL_INTERVAL_MS = 15000;
const HEALTH_POLL_INTERVAL_MS = 5000;
const MAX_NOTIFICATIONS = 50;
const MAX_RUNNER_OUTPUT_LINES = 2000;

const EMPTY_RUNNER: RunnerViewState = { state: 'idle', output: [], exitCode: null };

function newNotification(kind: AppNotification['kind'], message: string): AppNotification {
  return { id: crypto.randomUUID(), kind, message, createdAt: new Date().toISOString() };
}

export function IntelligenceProvider({ children }: { children: ReactNode }) {
  const { projectId, projectPath } = useProject();
  const { tasks } = useAgents();
  const { workflows } = useWorkflows();

  const [performanceStats, setPerformanceStats] = useState<PerformanceStats | null>(null);
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [availableRunners, setAvailableRunners] = useState<AvailableRunners>({
    build: false,
    test: false,
  });
  const [runners, setRunners] = useState<Record<RunnerId, RunnerViewState>>({
    build: EMPTY_RUNNER,
    test: EMPTY_RUNNER,
    verify: EMPTY_RUNNER,
  });
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const pushNotification = useCallback((kind: AppNotification['kind'], message: string) => {
    setNotifications((prev) =>
      [newNotification(kind, message), ...prev].slice(0, MAX_NOTIFICATIONS),
    );
  }, []);

  // --- stats/history polling -------------------------------------------------
  const refresh = useCallback(async () => {
    const [performance, tokens, historyEntries] = await Promise.all([
      window.nemi.stats.getPerformance(projectId).catch(() => null),
      window.nemi.stats.getTokens().catch(() => null),
      window.nemi.stats.getHistory(projectId).catch(() => []),
    ]);
    if (performance) setPerformanceStats(performance);
    if (tokens) setTokenStats(tokens);
    setHistory(historyEntries);
  }, [projectId]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), STATS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  // --- system metrics ----------------------------------------------------------
  useEffect(() => {
    if (!projectPath) {
      setSystemMetrics(null);
      return;
    }
    let cancelled = false;
    async function poll() {
      const metrics = await window.nemi.system.getMetrics(projectPath as string).catch(() => null);
      if (!cancelled && metrics) setSystemMetrics(metrics);
    }
    void poll();
    const interval = setInterval(() => void poll(), SYSTEM_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [projectPath]);

  // --- git status ----------------------------------------------------------------
  useEffect(() => {
    if (!projectPath) {
      setGitStatus(null);
      return;
    }
    let cancelled = false;
    async function poll() {
      const status = await window.nemi.git.getStatus(projectPath as string).catch(() => null);
      if (!cancelled && status) setGitStatus(status);
    }
    void poll();
    const interval = setInterval(() => void poll(), GIT_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [projectPath]);

  // --- available build/test runners ------------------------------------------
  useEffect(() => {
    if (!projectPath) {
      setAvailableRunners({ build: false, test: false });
      return;
    }
    window.nemi.build
      .detectRunners(projectPath)
      .then(setAvailableRunners)
      .catch(() => setAvailableRunners({ build: false, test: false }));
  }, [projectPath]);

  // --- build/test/verify runner output stream ---------------------------------
  useEffect(
    () =>
      window.nemi.build.onOutput((event) => {
        setRunners((prev) => {
          const current = prev[event.runnerId] ?? EMPTY_RUNNER;
          const output = [...current.output, event.chunk].slice(-MAX_RUNNER_OUTPUT_LINES);
          return { ...prev, [event.runnerId]: { ...current, state: 'running', output } };
        });
      }),
    [],
  );

  const startRunner = useCallback(
    async (
      runnerId: RunnerId,
      invoke: (projectPath: string) => Promise<RunnerStatusEvent>,
      failureNotificationKind: 'build-failed' | 'test-failed' | null,
    ) => {
      if (!projectPath) return;
      setRunners((prev) => ({
        ...prev,
        [runnerId]: { state: 'running', output: [], exitCode: null },
      }));
      const result = await invoke(projectPath).catch((): RunnerStatusEvent => ({
        runnerId,
        state: 'failed',
        exitCode: null,
      }));
      setRunners((prev) => ({
        ...prev,
        [runnerId]: { ...prev[runnerId], state: result.state, exitCode: result.exitCode },
      }));
      if (result.state === 'failed' && failureNotificationKind) {
        pushNotification(
          failureNotificationKind,
          `${runnerId === 'build' ? 'Build' : 'Tests'} failed (exit code ${result.exitCode ?? 'unknown'}).`,
        );
      }
    },
    [projectPath, pushNotification],
  );

  const runBuild = useCallback(
    () => startRunner('build', window.nemi.build.runBuild, 'build-failed'),
    [startRunner],
  );
  const runTests = useCallback(
    () => startRunner('test', window.nemi.build.runTests, 'test-failed'),
    [startRunner],
  );
  const runVerification = useCallback(
    () => startRunner('verify', window.nemi.build.runVerification, null),
    [startRunner],
  );
  const cancelRunner = useCallback(async (runnerId: RunnerId) => {
    await window.nemi.build.cancelRunner(runnerId);
  }, []);

  // --- notifications: derived from real state transitions ---------------------
  // Keyed per-item (by workflow/task id) rather than a single "have we
  // loaded yet" flag: a workflow or task already sitting at a terminal
  // status when this session's first poll observes it gets its baseline
  // recorded silently (prevStatus undefined → defined is not a
  // "transition"), so only a status change genuinely witnessed during
  // this session notifies. Confirmed live this distinction matters: an
  // earlier version notified for old "Smoke test: forced failure" tasks
  // left over from a previous test session the instant the dashboard
  // mounted, which is misleading — that failure didn't just happen.
  const previousWorkflowStatuses = useRef<Map<string, WorkflowStatus>>(new Map());
  const previousTaskStatuses = useRef<Map<string, AgentTaskStatus>>(new Map());
  const previousWaitingTaskIds = useRef<Set<string>>(new Set());
  const previousBackendState = useRef<BackendState | null>(null);

  useEffect(() => {
    for (const workflow of workflows) {
      const prevStatus = previousWorkflowStatuses.current.get(workflow.id);
      if (prevStatus !== undefined && prevStatus !== workflow.status) {
        if (workflow.status === 'completed') {
          pushNotification('sprint-completed', `Sprint completed: ${workflow.title}`);
        } else if (workflow.status === 'failed') {
          pushNotification('sprint-failed', `Sprint failed: ${workflow.title}`);
        }
      }
      previousWorkflowStatuses.current.set(workflow.id, workflow.status);
    }
  }, [workflows, pushNotification]);

  useEffect(() => {
    const waitingNow = new Set(
      tasks.filter((t) => t.requires_approval && !t.approved_at).map((t) => t.id),
    );
    for (const taskId of waitingNow) {
      // Only a task already known (present in the status map from a prior
      // poll) counts as "just started waiting" — see the effect above.
      if (!previousWaitingTaskIds.current.has(taskId) && previousTaskStatuses.current.has(taskId)) {
        const task = tasks.find((t) => t.id === taskId);
        if (task) pushNotification('agent-waiting', `Agent waiting for approval: ${task.title}`);
      }
    }
    previousWaitingTaskIds.current = waitingNow;

    for (const task of tasks) {
      const prevStatus = previousTaskStatuses.current.get(task.id);
      if (prevStatus !== undefined && prevStatus !== 'failed' && task.status === 'failed') {
        pushNotification(
          'task-failed',
          `Task failed: ${task.title}${task.error_message ? ` — ${task.error_message}` : ''}`,
        );
      }
      previousTaskStatuses.current.set(task.id, task.status);
    }
  }, [tasks, pushNotification]);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const health = await window.nemi.backend.health().catch(() => null);
      if (cancelled || !health) return;
      if (previousBackendState.current === 'ready' && health.state === 'error') {
        pushNotification('network-error', 'Network error: the backend became unreachable.');
      }
      previousBackendState.current = health.state;
    }
    void poll();
    const interval = setInterval(() => void poll(), HEALTH_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pushNotification]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);
  const clearNotifications = useCallback(() => setNotifications([]), []);

  const value = useMemo<IntelligenceContextValue>(
    () => ({
      performanceStats,
      tokenStats,
      history,
      gitStatus,
      systemMetrics,
      availableRunners,
      runners,
      runBuild,
      runTests,
      runVerification,
      cancelRunner,
      notifications,
      dismissNotification,
      clearNotifications,
      refresh,
    }),
    [
      performanceStats,
      tokenStats,
      history,
      gitStatus,
      systemMetrics,
      availableRunners,
      runners,
      runBuild,
      runTests,
      runVerification,
      cancelRunner,
      notifications,
      dismissNotification,
      clearNotifications,
      refresh,
    ],
  );

  return <IntelligenceContext.Provider value={value}>{children}</IntelligenceContext.Provider>;
}
