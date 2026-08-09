// Curated starting-point model ids per cloud provider. Provider catalogs
// change faster than this app's release cadence, so the model field in the
// UI is always an editable text input with these as suggestions (a
// <datalist>), never a restrictive dropdown — Ollama is the one provider
// with a genuinely live list, fetched from the user's local server instead
// (see useAi's `ollamaModels`).
export const SUGGESTED_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1', 'o4-mini'],
  anthropic: [
    'claude-sonnet-4-5-20250929',
    'claude-opus-4-1-20250805',
    'claude-3-5-haiku-20241022',
  ],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
  ollama: [],
  // Sprint 15.5: DeepSeek/Grok publish a fixed model catalog like the other
  // cloud providers (unlike Ollama's genuinely live local list), so a small
  // suggestions list is honest here too — just real published model ids,
  // not a full/maintained catalog.
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  grok: ['grok-4', 'grok-3-mini'],
  // Custom has no catalog to suggest from — it's whatever the user's own
  // OpenAI-compatible endpoint serves.
  custom: [],
};

export function defaultModelFor(providerId: string): string {
  return SUGGESTED_MODELS[providerId]?.[0] ?? '';
}
