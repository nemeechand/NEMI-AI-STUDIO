import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, HelpCircle, Loader2, RefreshCw, XCircle } from 'lucide-react';

const MODE_OPTIONS: { id: ExecutionMode; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'codex-cli', label: 'ChatGPT / Codex' },
  { id: 'claude-code-cli', label: 'Claude Code' },
  { id: 'gemini-cli', label: 'Gemini CLI' },
];

const ROLE_OPTIONS: { id: AgentRoleKey; label: string }[] = [
  { id: 'planner', label: 'Planner' },
  { id: 'developer', label: 'Developer' },
  { id: 'reviewer', label: 'Reviewer' },
  { id: 'tester', label: 'Tester' },
];

function AuthBadge({ status }: { status: CliToolStatus }) {
  if (!status.installed) {
    return <span className="text-[11px] text-fg-muted">Not installed</span>;
  }
  if (status.authenticated === true) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-success">
        <CheckCircle2 size={11} /> Authenticated
      </span>
    );
  }
  if (status.authenticated === false) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-danger">
        <XCircle size={11} /> Not authenticated
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[11px] text-fg-muted" title="Auth state unknown">
      <HelpCircle size={11} /> Unknown
    </span>
  );
}

function CliToolCard({ status }: { status: CliToolStatus }) {
  return (
    <div className="rounded-md border border-border p-2.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium text-fg">{status.display_name}</span>
        <AuthBadge status={status} />
      </div>
      <p className="mb-1 text-[11px] text-fg-muted">{status.role_note}</p>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-fg-muted">
        <span>{status.installed ? 'Installed' : 'Not installed'}</span>
        {status.version && <span>v{status.version}</span>}
        <span className={status.available ? 'text-success' : ''}>
          {status.available ? 'Ready to dispatch' : 'Not available for dispatch'}
        </span>
      </div>
    </div>
  );
}

export function AiCodingControlTab() {
  const [statuses, setStatuses] = useState<CliToolStatus[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [policy, setPolicy] = useState<ExecutionPolicy | null>(null);
  const [agentDefaults, setAgentDefaults] = useState<
    { agent_role: string; provider: string; model: string }[]
  >([]);

  const refreshStatuses = useCallback(() => {
    setLoadingStatuses(true);
    void window.nemi.cliTools
      .getStatus()
      .then(setStatuses)
      .finally(() => setLoadingStatuses(false));
  }, []);

  const refreshAgentDefaults = useCallback(() => {
    void window.nemi.providers.listAgentDefaults().then(setAgentDefaults);
  }, []);

  useEffect(() => {
    refreshStatuses();
    void window.nemi.cliTools.getExecutionPolicy().then(setPolicy);
    refreshAgentDefaults();
  }, [refreshStatuses, refreshAgentDefaults]);

  const handleModeChange = (mode: ExecutionMode) => {
    void window.nemi.cliTools.updateExecutionPolicy({ mode }).then(setPolicy);
  };

  const handleSubscriptionFirstChange = (subscriptionFirst: boolean) => {
    void window.nemi.cliTools.updateExecutionPolicy({ subscriptionFirst }).then(setPolicy);
  };

  const roleDefault = (role: AgentRoleKey) =>
    agentDefaults.find((d) => d.agent_role === role)?.provider ?? '';

  const handleRoleDefaultChange = (role: AgentRoleKey, provider: string) => {
    if (!provider) {
      void window.nemi.providers.clearAgentDefault(role).then(refreshAgentDefaults);
      return;
    }
    // A CLI tool has no per-call "model" the way an API provider does —
    // 'local' documents that plainly (mirrors backend api/agents.py's
    // create_pipeline, which stores the same sentinel for CLI-backend tasks).
    const model = provider.endsWith('-cli') ? 'local' : 'default';
    void window.nemi.providers.setAgentDefault(role, provider, model).then(refreshAgentDefaults);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
          AI Coding Control
        </h3>
        <button
          type="button"
          onClick={refreshStatuses}
          disabled={loadingStatuses}
          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-fg hover:border-accent hover:text-accent disabled:opacity-40"
        >
          {loadingStatuses ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <RefreshCw size={11} />
          )}
          Refresh
        </button>
      </div>
      <p className="mb-3 text-[11px] text-fg-muted">
        NEMI detects your existing ChatGPT/Codex, Claude Code, and Gemini CLI subscriptions via
        their own official login — no API key is requested or stored for these. Detection reads only
        whether each tool is installed and its own credential file exists; NEMI never reads, stores,
        or transmits its contents.
      </p>

      <div className="mb-3 space-y-2">
        {statuses.map((status) => (
          <CliToolCard key={status.id} status={status} />
        ))}
      </div>

      <div className="mb-3 rounded-md border border-border p-2.5">
        <p className="mb-1.5 text-xs font-medium text-fg">Task Router</p>
        <div className="mb-2 flex items-center gap-1.5">
          <span className="w-28 shrink-0 text-[11px] text-fg-muted">Mode</span>
          <select
            value={policy?.mode ?? 'auto'}
            onChange={(event) => handleModeChange(event.target.value as ExecutionMode)}
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg outline-none focus:border-accent"
          >
            {MODE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-1.5 text-[11px] text-fg-muted">
          <input
            type="checkbox"
            checked={policy?.subscription_first ?? true}
            onChange={(event) => handleSubscriptionFirstChange(event.target.checked)}
          />
          Subscription-first: prefer an authenticated CLI tool over a paid API provider
        </label>
        {policy && !policy.subscription_first && (
          <p className="mt-1 text-[11px] text-warning">
            Subscription-first is off — Auto mode will prefer your configured API provider, which
            uses paid API usage, over subscription CLI tools.
          </p>
        )}
      </div>

      <div className="rounded-md border border-border p-2.5">
        <p className="mb-1.5 text-xs font-medium text-fg">Preferred agent per role</p>
        <p className="mb-2 text-[11px] text-fg-muted">
          Only used when a pipeline is created with Task Router routing enabled; leave unset to let
          Auto mode decide at dispatch time.
        </p>
        {ROLE_OPTIONS.map((role) => (
          <div key={role.id} className="mb-1.5 flex items-center gap-1.5 last:mb-0">
            <span className="w-20 shrink-0 text-[11px] text-fg-muted">{role.label}</span>
            <select
              value={roleDefault(role.id)}
              onChange={(event) => handleRoleDefaultChange(role.id, event.target.value)}
              className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg outline-none focus:border-accent"
            >
              <option value="">Auto (Task Router decides)</option>
              {statuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.display_name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
