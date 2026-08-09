import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, Loader2, RefreshCw } from 'lucide-react';
import { useProject } from '../../project/useProject';
import { useAgents } from '../../agents/useAgents';
import { useActiveWorkflow } from './useActiveWorkflow';

const CLI_TOOL_LABELS: Record<CliToolId, string> = {
  'codex-cli': 'ChatGPT / Codex',
  'claude-code-cli': 'Claude Code',
  'gemini-cli': 'Gemini CLI',
};

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const diffSeconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSeconds < 60) return 'just now';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  return `${Math.floor(diffSeconds / 86400)}d ago`;
}

function lastRunFor(toolId: CliToolId, tasks: AgentTask[]): string {
  const runs = tasks
    .filter((t) => t.cli_tool_id === toolId && t.completed_at)
    .sort((a, b) => (b.completed_at as string).localeCompare(a.completed_at as string));
  return formatRelativeTime(runs[0]?.completed_at ?? null);
}

function ToolCard({ status, tasks }: { status: CliToolStatus; tasks: AgentTask[] }) {
  const badge = status.available
    ? { label: 'READY', className: 'bg-success/15 text-success' }
    : status.installed
      ? { label: 'NOT AUTHENTICATED', className: 'bg-warning/15 text-warning' }
      : { label: 'NOT INSTALLED', className: 'bg-fg-muted/15 text-fg-muted' };

  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-semibold text-fg">{status.display_name}</span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${badge.className}`}>
          {badge.label}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
        <dt className="text-fg-muted">Authentication</dt>
        <dd className="text-fg">
          {!status.installed
            ? 'Not installed'
            : status.authenticated === true
              ? 'Authenticated'
              : status.authenticated === false
                ? 'Not authenticated'
                : 'Unknown'}
        </dd>
        <dt className="text-fg-muted">Role</dt>
        <dd className="text-fg">{status.role_note}</dd>
        <dt className="text-fg-muted">Last Run</dt>
        <dd className="text-fg">{lastRunFor(status.id, tasks)}</dd>
      </dl>
    </div>
  );
}

export function AiCodingControlSection() {
  const { projectId } = useProject();
  const { tasks } = useAgents();
  const workflow = useActiveWorkflow();
  const [statuses, setStatuses] = useState<CliToolStatus[]>([]);
  const [policy, setPolicy] = useState<ExecutionPolicy | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    void Promise.all([
      window.nemi.cliTools.getStatus().then(setStatuses),
      window.nemi.cliTools.getExecutionPolicy().then(setPolicy),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const currentTask = useMemo(
    () => workflow?.tasks.find((t) => t.status === 'running') ?? null,
    [workflow],
  );
  const currentAgentLabel = currentTask
    ? currentTask.execution_backend === 'cli' && currentTask.cli_tool_id
      ? `${CLI_TOOL_LABELS[currentTask.cli_tool_id]} (${currentTask.agent_role})`
      : `${currentTask.provider} (${currentTask.agent_role})`
    : '—';
  const executionModeLabel = currentTask
    ? currentTask.execution_backend === 'cli'
      ? 'Subscription CLI'
      : 'API provider'
    : '—';

  const runAction = (label: string, action: () => Promise<unknown>) => {
    setBusyAction(label);
    void action().finally(() => {
      setBusyAction(null);
      refresh();
    });
  };

  // "Plan with ChatGPT" / "Code with Claude" / "Code with Gemini": sets that
  // tool as the preferred agent for the role it's best suited to (reusing
  // the existing Sprint 15.5 agent_provider_defaults infra — see
  // AiCodingControlTab.tsx) so the NEXT pipeline/workflow created routes to
  // it. "Auto Mode" clears every CLI override and sets the Task Router back
  // to 'auto'. None of these dispatch a task by themselves — task creation
  // (the Agents Dashboard's Goals tab) is the existing, un-duplicated entry
  // point for that.
  const planWithChatGpt = () =>
    runAction('plan', () => window.nemi.providers.setAgentDefault('planner', 'codex-cli', 'local'));
  const codeWithClaude = () =>
    runAction('claude', () =>
      window.nemi.providers.setAgentDefault('developer', 'claude-code-cli', 'local'),
    );
  const codeWithGemini = () =>
    runAction('gemini', () =>
      window.nemi.providers.setAgentDefault('developer', 'gemini-cli', 'local'),
    );
  const enableAutoMode = () =>
    runAction('auto', async () => {
      await window.nemi.cliTools.updateExecutionPolicy({ mode: 'auto' });
      await Promise.all(
        (['planner', 'developer', 'reviewer', 'tester'] as const).map((role) =>
          window.nemi.providers.clearAgentDefault(role),
        ),
      );
    });

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-fg">
          <Bot size={15} /> AI Coding Control
        </h2>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-fg hover:border-accent hover:text-accent disabled:opacity-40"
        >
          {loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {statuses.map((status) => (
          <ToolCard key={status.id} status={status} tasks={tasks} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <Stat label="Current Task" value={currentTask?.title ?? 'Idle'} />
        <Stat label="Current Agent" value={currentAgentLabel} />
        <Stat label="Execution Mode" value={executionModeLabel} />
        <Stat label="Router Mode" value={policy ? MODE_LABELS[policy.mode] : '—'} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={planWithChatGpt}
          disabled={busyAction !== null}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-fg hover:border-accent hover:text-accent disabled:opacity-40"
        >
          {busyAction === 'plan' && <Loader2 size={11} className="mr-1 inline animate-spin" />}
          Plan with ChatGPT
        </button>
        <button
          type="button"
          onClick={codeWithClaude}
          disabled={busyAction !== null}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-fg hover:border-accent hover:text-accent disabled:opacity-40"
        >
          {busyAction === 'claude' && <Loader2 size={11} className="mr-1 inline animate-spin" />}
          Code with Claude
        </button>
        <button
          type="button"
          onClick={codeWithGemini}
          disabled={busyAction !== null}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-fg hover:border-accent hover:text-accent disabled:opacity-40"
        >
          {busyAction === 'gemini' && <Loader2 size={11} className="mr-1 inline animate-spin" />}
          Code with Gemini
        </button>
        <button
          type="button"
          onClick={enableAutoMode}
          disabled={busyAction !== null}
          className="rounded-md border border-accent bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 disabled:opacity-40"
        >
          {busyAction === 'auto' && <Loader2 size={11} className="mr-1 inline animate-spin" />}
          Auto Mode
        </button>
      </div>
      <p className="text-[11px] text-fg-muted">
        These set which agent the next pipeline routes to (Settings → AI Coding Control has the full
        per-role configuration) — start or continue work from the Agents panel's Goals tab as usual.
      </p>
      {!projectId && (
        <p className="text-[11px] text-warning">
          No project is open — CLI coding agents require an open git-backed project to dispatch
          into.
        </p>
      )}
    </div>
  );
}

const MODE_LABELS: Record<ExecutionMode, string> = {
  auto: 'Auto',
  'codex-cli': 'ChatGPT / Codex only',
  'claude-code-cli': 'Claude Code only',
  'gemini-cli': 'Gemini CLI only',
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-fg-muted">{label}</div>
      <div className="truncate text-xs text-fg">{value}</div>
    </div>
  );
}
