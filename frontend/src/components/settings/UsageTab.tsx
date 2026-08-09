import { useCallback, useEffect, useState } from 'react';
import { useAi } from '../../ai/useAi';

const AGENT_DEFAULT_ROLES: AgentDefaultRoleKey[] = [
  'planner',
  'developer',
  'reviewer',
  'tester',
  'documentation',
];

const AGENT_DEFAULT_ROLE_LABELS: Record<AgentDefaultRoleKey, string> = {
  planner: 'Planner',
  developer: 'Developer',
  reviewer: 'Reviewer',
  tester: 'Tester',
  documentation: 'Documentation',
};

function formatCost(cost: number | null): string {
  if (cost === null) return 'unknown';
  if (cost === 0) return '$0.00';
  return `$${cost < 0.01 ? cost.toFixed(4) : cost.toFixed(2)}`;
}

function formatLatency(ms: number | null): string {
  if (ms === null) return '—';
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

function ProviderDashboardTable() {
  const { selectedProvider, selectedModel } = useAi();
  const [rows, setRows] = useState<ProviderDashboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    void window.nemi.providers
      .getDashboard()
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
          Provider Dashboard
        </h3>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="rounded border border-border px-1.5 py-0.5 text-[11px] text-fg-muted hover:border-accent hover:text-accent disabled:opacity-40"
        >
          Refresh
        </button>
      </div>
      <p className="mb-2 text-[11px] text-fg-muted">
        Current: {selectedProvider} / {selectedModel || '(no model selected)'}
      </p>
      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full text-left text-[11px]">
          <thead className="bg-surface text-fg-muted">
            <tr>
              <th className="px-2 py-1 font-medium">Provider</th>
              <th className="px-2 py-1 font-medium">Status</th>
              <th className="px-2 py-1 font-medium">Requests</th>
              <th className="px-2 py-1 font-medium">Tokens</th>
              <th className="px-2 py-1 font-medium">Est. Cost</th>
              <th className="px-2 py-1 font-medium">Avg Latency</th>
              <th className="px-2 py-1 font-medium">Errors</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr
                key={row.provider_id}
                className={row.provider_id === selectedProvider ? 'bg-accent/5' : ''}
              >
                <td className="px-2 py-1 text-fg">{row.display_name}</td>
                <td className="px-2 py-1 text-fg-muted">
                  {row.last_connection_status === 'ok'
                    ? 'Connected'
                    : row.last_connection_status === 'error'
                      ? 'Failed'
                      : 'Untested'}
                </td>
                <td className="px-2 py-1 text-fg-muted">{row.requests}</td>
                <td className="px-2 py-1 text-fg-muted">
                  {(row.prompt_tokens + row.completion_tokens).toLocaleString()}
                </td>
                <td className="px-2 py-1 text-fg-muted">{formatCost(row.estimated_cost_usd)}</td>
                <td className="px-2 py-1 text-fg-muted">{formatLatency(row.avg_latency_ms)}</td>
                <td className="px-2 py-1 text-fg-muted">{row.errors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AgentProviderSwitching() {
  const { providers } = useAi();
  const [defaults, setDefaults] = useState<Record<string, AgentProviderDefault>>({});
  const [drafts, setDrafts] = useState<Record<string, { provider: string; model: string }>>({});

  const refresh = useCallback(() => {
    void window.nemi.providers.listAgentDefaults().then((list) => {
      setDefaults(Object.fromEntries(list.map((row) => [row.agent_role, row])));
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const draftFor = (role: AgentDefaultRoleKey) =>
    drafts[role] ?? {
      provider: defaults[role]?.provider ?? providers[0]?.id ?? '',
      model: defaults[role]?.model ?? '',
    };

  const setDraft = (
    role: AgentDefaultRoleKey,
    patch: Partial<{ provider: string; model: string }>,
  ) => {
    setDrafts((prev) => ({ ...prev, [role]: { ...draftFor(role), ...patch } }));
  };

  const save = (role: AgentDefaultRoleKey) => {
    const draft = draftFor(role);
    if (!draft.provider || !draft.model.trim()) return;
    void window.nemi.providers
      .setAgentDefault(role, draft.provider, draft.model.trim())
      .then(() => {
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[role];
          return next;
        });
        refresh();
      });
  };

  const clear = (role: AgentDefaultRoleKey) => {
    void window.nemi.providers.clearAgentDefault(role).then(refresh);
  };

  return (
    <div className="mt-4">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-fg-muted">
        Provider Switching
      </h3>
      <p className="mb-2 text-[11px] text-fg-muted">
        Each agent can use a different provider and model. Roles left unset inherit the workflow's
        own provider/model.
      </p>
      <div className="space-y-1.5">
        {AGENT_DEFAULT_ROLES.map((role) => {
          const current = defaults[role];
          const draft = draftFor(role);
          return (
            <div key={role} className="flex items-center gap-1.5 text-xs">
              <span className="w-24 shrink-0 text-fg">{AGENT_DEFAULT_ROLE_LABELS[role]}</span>
              <select
                value={draft.provider}
                onChange={(event) => setDraft(role, { provider: event.target.value })}
                className="rounded border border-border bg-surface px-1.5 py-1 text-xs text-fg outline-none focus:border-accent"
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name}
                  </option>
                ))}
              </select>
              <input
                value={draft.model}
                onChange={(event) => setDraft(role, { model: event.target.value })}
                placeholder="model id"
                className="min-w-0 flex-1 rounded border border-border bg-surface px-1.5 py-1 text-xs text-fg outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={() => save(role)}
                className="rounded border border-border px-1.5 py-1 text-[11px] text-fg-muted hover:border-accent hover:text-accent"
              >
                Save
              </button>
              {current && (
                <button
                  type="button"
                  onClick={() => clear(role)}
                  className="rounded border border-border px-1.5 py-1 text-[11px] text-fg-muted hover:border-danger hover:text-danger"
                >
                  Reset
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function UsageTab() {
  return (
    <div>
      <ProviderDashboardTable />
      <AgentProviderSwitching />
    </div>
  );
}
