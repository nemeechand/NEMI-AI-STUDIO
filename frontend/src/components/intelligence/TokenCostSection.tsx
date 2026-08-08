import { useIntelligence } from '../../intelligence/useIntelligence';
import { formatCost } from './sections';

const WINDOW_LABELS: { key: 'session' | 'day' | 'month'; label: string }[] = [
  { key: 'session', label: 'Session' },
  { key: 'day', label: 'Today' },
  { key: 'month', label: 'This Month' },
];

export function TokenCostSection() {
  const { tokenStats } = useIntelligence();

  if (!tokenStats) {
    return <p className="text-xs text-fg-muted">Loading token usage…</p>;
  }

  return (
    <div className="max-w-3xl space-y-5">
      {WINDOW_LABELS.map(({ key, label }) => {
        const window = tokenStats[key];
        const providers = Object.entries(window.by_provider);
        return (
          <div key={key}>
            <div className="mb-1.5 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-fg">{label}</h3>
              <span className="text-xs text-fg-muted">
                {window.total_prompt_tokens + window.total_completion_tokens} tokens ·{' '}
                {formatCost(window.total_estimated_cost_usd)}
              </span>
            </div>
            {providers.length === 0 ? (
              <p className="text-[11px] text-fg-muted">No AI activity in this window yet.</p>
            ) : (
              <div className="space-y-1">
                {providers.map(([provider, usage]) => (
                  <div
                    key={provider}
                    className="flex items-center justify-between rounded border border-border px-2.5 py-1.5 text-xs"
                  >
                    <span className="capitalize text-fg">{provider}</span>
                    <span className="text-fg-muted">
                      {usage.prompt_tokens} in / {usage.completion_tokens} out ·{' '}
                      {formatCost(usage.estimated_cost_usd)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <p className="text-[10px] text-fg-muted">
        Costs are estimates from published list pricing for models this app suggests by default —
        not a live-billed figure. Ollama is always $0 (local). A model outside the pricing table
        shows "unknown" rather than a guess.
      </p>
    </div>
  );
}
