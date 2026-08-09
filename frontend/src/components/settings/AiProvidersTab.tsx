import { useCallback, useEffect, useState } from 'react';
import { Check, CheckCircle2, Loader2, Trash2, XCircle } from 'lucide-react';
import { useAi } from '../../ai/useAi';
import { OllamaManagementPanel } from './OllamaManagementPanel';

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  const diffSeconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSeconds < 60) return 'just now';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  return `${Math.floor(diffSeconds / 86400)}d ago`;
}

function ConnectionStatusBadge({ settings }: { settings: ProviderSettings | undefined }) {
  const status = settings?.last_connection_status ?? 'untested';
  if (status === 'ok') {
    return (
      <span
        className="flex items-center gap-1 text-[11px] text-success"
        title={settings?.last_connection_message ?? ''}
      >
        <CheckCircle2 size={11} /> Connected
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span
        className="flex items-center gap-1 text-[11px] text-danger"
        title={settings?.last_connection_message ?? ''}
      >
        <XCircle size={11} /> Failed
      </span>
    );
  }
  return <span className="text-[11px] text-fg-muted">Untested</span>;
}

function ProviderRow({ provider }: { provider: AiProviderInfo }) {
  const { configuredProviders, refreshConfiguredProviders } = useAi();
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [settings, setSettings] = useState<ProviderSettings | undefined>(undefined);
  const [baseUrlInput, setBaseUrlInput] = useState('');
  const [defaultModelInput, setDefaultModelInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const isConfigured = configuredProviders.has(provider.id);

  const loadSettings = useCallback(() => {
    void window.nemi.providers.getSettings(provider.id).then((row) => {
      setSettings(row);
      setBaseUrlInput(row.base_url ?? '');
      setDefaultModelInput(row.default_model ?? '');
    });
  }, [provider.id]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleToggleEnabled = (enabled: boolean) => {
    void window.nemi.providers.updateSettings(provider.id, { enabled }).then(setSettings);
  };

  const handleSaveBaseUrl = () => {
    void window.nemi.providers
      .updateSettings(provider.id, { baseUrl: baseUrlInput.trim() || null })
      .then(setSettings);
  };

  const handleSaveDefaultModel = () => {
    void window.nemi.providers
      .updateSettings(provider.id, { defaultModel: defaultModelInput.trim() || null })
      .then(setSettings);
  };

  const handleTestConnection = () => {
    setTesting(true);
    setTestResult(null);
    void window.nemi.providers
      .testConnection(provider.id, baseUrlInput.trim() || null)
      .then((result) => {
        setTestResult(result);
        loadSettings();
      })
      .finally(() => setTesting(false));
  };

  return (
    <div className="border-b border-border py-3 last:border-b-0">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm font-medium text-fg">
            <input
              type="checkbox"
              checked={settings?.enabled ?? true}
              onChange={(event) => handleToggleEnabled(event.target.checked)}
            />
            {provider.display_name}
          </label>
          {isConfigured && provider.requires_api_key && (
            <span className="flex items-center gap-1 text-[10px] text-success">
              <Check size={10} /> Key saved
            </span>
          )}
        </div>
        <ConnectionStatusBadge settings={settings} />
      </div>

      {provider.requires_api_key && (
        <div className="mb-1.5 flex items-center gap-1.5">
          <input
            type="password"
            value={apiKeyInput}
            onChange={(event) => setApiKeyInput(event.target.value)}
            placeholder={isConfigured ? 'Replace saved key…' : 'Paste API key…'}
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg outline-none focus:border-accent"
          />
          <button
            type="button"
            disabled={!apiKeyInput.trim() || savingKey}
            onClick={() => {
              setSavingKey(true);
              void window.nemi.ai
                .setApiKey(provider.id as AiProviderId, apiKeyInput.trim())
                .then(() => {
                  setApiKeyInput('');
                  return refreshConfiguredProviders();
                })
                .finally(() => setSavingKey(false));
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
      )}

      {provider.supports_base_url && (
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="w-16 shrink-0 text-[11px] text-fg-muted">Base URL</span>
          <input
            value={baseUrlInput}
            onChange={(event) => setBaseUrlInput(event.target.value)}
            onBlur={handleSaveBaseUrl}
            placeholder="default"
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg outline-none focus:border-accent"
          />
        </div>
      )}

      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="w-16 shrink-0 text-[11px] text-fg-muted">Default model</span>
        <input
          value={defaultModelInput}
          onChange={(event) => setDefaultModelInput(event.target.value)}
          onBlur={handleSaveDefaultModel}
          placeholder="model id"
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={testing}
          className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-fg hover:border-accent hover:text-accent disabled:opacity-40"
        >
          {testing && <Loader2 size={11} className="animate-spin" />}
          Test Connection
        </button>
      </div>
      {testResult && (
        <p className={`mb-1 text-[11px] ${testResult.ok ? 'text-success' : 'text-danger'}`}>
          {testResult.message}
        </p>
      )}

      <p className="text-[11px] text-fg-muted">
        Last used: {settings?.last_used_model ? `${settings.last_used_model} · ` : ''}
        {formatRelativeTime(settings?.last_used_at ?? null)}
      </p>

      {provider.id === 'ollama' && <OllamaManagementPanel baseUrl={settings?.base_url ?? null} />}
    </div>
  );
}

export function AiProvidersTab() {
  const { providers, refreshConfiguredProviders } = useAi();

  useEffect(() => {
    void refreshConfiguredProviders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-fg-muted">
        AI Providers
      </h3>
      <p className="mb-2 text-xs text-fg-muted">
        Keys are encrypted with your OS's secure storage (Windows DPAPI / macOS Keychain / Linux
        Secret Service) and never leave this machine.
      </p>
      <div>
        {providers.map((provider) => (
          <ProviderRow key={provider.id} provider={provider} />
        ))}
      </div>
    </div>
  );
}
