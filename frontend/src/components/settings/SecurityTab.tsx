import { useEffect } from 'react';
import { Check, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { useAi } from '../../ai/useAi';

export function SecurityTab() {
  const { providers, configuredProviders, refreshConfiguredProviders } = useAi();

  useEffect(() => {
    void refreshConfiguredProviders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keyedProviders = providers.filter((p) => p.requires_api_key);

  return (
    <div>
      <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-fg-muted">
        <ShieldCheck size={13} /> Credential Storage
      </h3>
      <p className="mb-3 text-xs text-fg-muted">
        API keys are encrypted with Electron's <code>safeStorage</code> — backed by your operating
        system's own secure storage (Windows DPAPI, macOS Keychain, or Linux Secret Service). Keys
        are never stored in plain text, never written to the app's SQLite database, and never sent
        anywhere except attached to the one request that needs them. The backend never persists a
        key it receives.
      </p>
      <ul className="divide-y divide-border">
        {keyedProviders.map((provider) => {
          const configured = configuredProviders.has(provider.id);
          return (
            <li key={provider.id} className="flex items-center justify-between py-1.5 text-sm">
              <span className="flex items-center gap-1.5 text-fg">
                {configured ? (
                  <Check size={12} className="text-success" />
                ) : (
                  <XCircle size={12} className="text-fg-muted" />
                )}
                {provider.display_name}
              </span>
              {configured ? (
                <button
                  type="button"
                  onClick={() => {
                    void window.nemi.ai
                      .clearApiKey(provider.id as AiProviderId)
                      .then(() => refreshConfiguredProviders());
                  }}
                  className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[11px] text-fg-muted hover:border-danger hover:text-danger"
                >
                  <Trash2 size={11} /> Remove key
                </button>
              ) : (
                <span className="text-[11px] text-fg-muted">not configured</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
