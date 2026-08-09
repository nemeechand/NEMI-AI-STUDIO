import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Star } from 'lucide-react';
import { useAi } from '../../ai/useAi';
import { SUGGESTED_MODELS } from '../../ai/providerDefaults';

export function ModelsTab() {
  const { providers, ollamaModels } = useAi();
  const [providerId, setProviderId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [liveModels, setLiveModels] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [settings, setSettings] = useState<ProviderSettings | undefined>(undefined);

  useEffect(() => {
    if (!providerId && providers.length > 0) setProviderId(providers[0].id);
  }, [providers, providerId]);

  const loadFavoritesAndSettings = useCallback(() => {
    if (!providerId) return;
    void window.nemi.providers.listFavorites(providerId).then(setFavorites);
    void window.nemi.providers.getSettings(providerId).then(setSettings);
  }, [providerId]);

  useEffect(() => {
    setLiveModels([]);
    loadFavoritesAndSettings();
  }, [providerId, loadFavoritesAndSettings]);

  const provider = providers.find((p) => p.id === providerId);

  const baseModels = useMemo(() => {
    if (providerId === 'ollama') return ollamaModels;
    return SUGGESTED_MODELS[providerId] ?? [];
  }, [providerId, ollamaModels]);

  const allModels = useMemo(() => {
    const combined = new Set([...liveModels, ...baseModels, ...favorites]);
    return Array.from(combined).sort((a, b) => {
      const aFav = favorites.includes(a) ? 0 : 1;
      const bFav = favorites.includes(b) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      return a.localeCompare(b);
    });
  }, [liveModels, baseModels, favorites]);

  const filtered = allModels.filter((m) => m.toLowerCase().includes(search.toLowerCase()));

  const handleRefresh = () => {
    if (!provider || provider.id === 'ollama') return;
    setRefreshing(true);
    void window.nemi.providers
      .refreshModels(provider.id, settings?.base_url ?? null)
      .then(setLiveModels)
      .finally(() => setRefreshing(false));
  };

  const toggleFavorite = (model: string) => {
    if (!providerId) return;
    const isFav = favorites.includes(model);
    void window.nemi.providers.setFavorite(providerId, model, !isFav).then(setFavorites);
  };

  const setDefault = (model: string) => {
    if (!providerId) return;
    void window.nemi.providers
      .updateSettings(providerId, { defaultModel: model })
      .then(setSettings);
  };

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-muted">
        Model Manager
      </h3>
      <div className="mb-2 flex items-center gap-1.5">
        <select
          value={providerId}
          onChange={(event) => setProviderId(event.target.value)}
          className="rounded border border-border bg-surface px-1.5 py-1 text-xs text-fg outline-none focus:border-accent"
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search models…"
          className="min-w-0 flex-1 rounded border border-border bg-surface px-1.5 py-1 text-xs text-fg outline-none focus:border-accent"
        />
        {providerId !== 'ollama' && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex shrink-0 items-center gap-1 rounded border border-border px-1.5 py-1 text-[11px] text-fg-muted hover:border-accent hover:text-accent disabled:opacity-40"
          >
            <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        )}
      </div>

      {providerId === 'ollama' && (
        <p className="mb-2 text-[11px] text-fg-muted">
          Ollama's list is your locally installed models — manage pulling/deleting from the AI
          Providers tab.
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="text-xs text-fg-muted">
          No models yet — try Refresh, or type a model id directly in AI Providers.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {filtered.map((model) => (
            <li key={model} className="flex items-center justify-between py-1.5 text-xs">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => toggleFavorite(model)}
                  title={favorites.includes(model) ? 'Remove favorite' : 'Mark favorite'}
                  className="text-fg-muted hover:text-warning"
                >
                  <Star
                    size={13}
                    className={favorites.includes(model) ? 'fill-warning text-warning' : ''}
                  />
                </button>
                <span className="text-fg">{model}</span>
                {settings?.default_model === model && (
                  <span className="rounded bg-accent/10 px-1 text-[10px] text-accent">default</span>
                )}
                {settings?.last_used_model === model && (
                  <span className="text-[10px] text-fg-muted">last used</span>
                )}
              </div>
              {settings?.default_model !== model && (
                <button
                  type="button"
                  onClick={() => setDefault(model)}
                  className="rounded border border-border px-1.5 py-0.5 text-[10px] text-fg-muted hover:border-accent hover:text-accent"
                >
                  Set default
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
