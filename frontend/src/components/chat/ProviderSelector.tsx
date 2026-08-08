import { useAi } from '../../ai/useAi';
import { SUGGESTED_MODELS } from '../../ai/providerDefaults';

export function ProviderSelector() {
  const {
    providers,
    ollamaModels,
    configuredProviders,
    selectedProvider,
    selectedModel,
    setSelectedProvider,
    setSelectedModel,
  } = useAi();

  const suggestions =
    selectedProvider === 'ollama' ? ollamaModels : (SUGGESTED_MODELS[selectedProvider] ?? []);

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5">
      <select
        value={selectedProvider}
        onChange={(event) => setSelectedProvider(event.target.value)}
        className="rounded border border-border bg-surface px-1.5 py-1 text-xs text-fg outline-none focus:border-accent"
      >
        {providers.map((provider) => (
          <option key={provider.id} value={provider.id}>
            {provider.display_name}
            {!configuredProviders.has(provider.id) && provider.requires_api_key ? ' (no key)' : ''}
          </option>
        ))}
      </select>
      <input
        list="ai-model-suggestions"
        value={selectedModel}
        onChange={(event) => setSelectedModel(event.target.value)}
        placeholder="model id"
        className="min-w-0 flex-1 rounded border border-border bg-surface px-1.5 py-1 text-xs text-fg outline-none focus:border-accent"
      />
      <datalist id="ai-model-suggestions">
        {suggestions.map((model) => (
          <option key={model} value={model} />
        ))}
      </datalist>
    </div>
  );
}
