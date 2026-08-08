import { useEffect, useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { useAi } from '../../ai/useAi';

function ProviderKeyRow({ provider }: { provider: AiProviderInfo }) {
  const { configuredProviders, refreshConfiguredProviders } = useAi();
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const isConfigured = configuredProviders.has(provider.id);

  if (!provider.requires_api_key) {
    return (
      <div className="flex items-center justify-between py-1.5 text-sm">
        <span className="text-fg">{provider.display_name}</span>
        <span className="text-xs text-fg-muted">No API key required (local server)</span>
      </div>
    );
  }

  return (
    <div className="py-1.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm text-fg">{provider.display_name}</span>
        {isConfigured && (
          <span className="flex items-center gap-1 text-[10px] text-success">
            <Check size={11} /> Configured
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={isConfigured ? 'Replace saved key…' : 'Paste API key…'}
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg outline-none focus:border-accent"
        />
        <button
          type="button"
          disabled={!value.trim() || saving}
          onClick={() => {
            setSaving(true);
            void window.nemi.ai
              .setApiKey(provider.id as AiProviderId, value.trim())
              .then(() => {
                setValue('');
                return refreshConfiguredProviders();
              })
              .finally(() => setSaving(false));
          }}
          className="rounded-md border border-border px-2 py-1 text-xs text-fg hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save
        </button>
        {isConfigured && (
          <button
            type="button"
            title="Remove saved key"
            onClick={() => {
              void window.nemi.ai
                .clearApiKey(provider.id as AiProviderId)
                .then(() => refreshConfiguredProviders());
            }}
            className="rounded-md border border-border p-1 text-fg-muted hover:border-danger hover:text-danger"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

export function AiProviderSettings() {
  const { providers, refreshConfiguredProviders } = useAi();

  useEffect(() => {
    void refreshConfiguredProviders();
    // Only on mount — refreshConfiguredProviders itself changes identity
    // whenever `providers` loads, which would otherwise re-run this
    // needlessly on every provider-list fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-muted">
        AI Providers
      </h3>
      <p className="mb-2 text-xs text-fg-muted">
        Keys are encrypted with your OS's secure storage and never leave this machine.
      </p>
      <div className="divide-y divide-border">
        {providers.map((provider) => (
          <ProviderKeyRow key={provider.id} provider={provider} />
        ))}
      </div>
    </div>
  );
}
