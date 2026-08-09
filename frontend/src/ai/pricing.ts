// Mirrors backend/app/ai/pricing.py's table exactly (update both together)
// — published list pricing (USD per 1M tokens, input/output) for the
// models this app suggests by default. A real, labeled *estimate* based
// on public rate cards, never a fabricated number. A model not in this
// table simply has no cost estimate (`null`) rather than a guessed one.
// Ollama is entirely absent: it's local and free, always $0.
const PRICING_USD_PER_MILLION_TOKENS: Record<string, Record<string, [number, number]>> = {
  openai: {
    'gpt-4o-mini': [0.15, 0.6],
    'gpt-4o': [2.5, 10.0],
    'gpt-4.1': [2.0, 8.0],
    'o4-mini': [1.1, 4.4],
  },
  anthropic: {
    'claude-sonnet-4-5-20250929': [3.0, 15.0],
    'claude-opus-4-1-20250805': [15.0, 75.0],
    'claude-3-5-haiku-20241022': [0.8, 4.0],
  },
  gemini: {
    'gemini-2.5-flash': [0.3, 2.5],
    'gemini-2.5-pro': [1.25, 10.0],
    'gemini-2.0-flash': [0.1, 0.4],
  },
};

export function estimateCostUsd(
  provider: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
): number | null {
  if (provider === 'ollama') return 0;
  const rates = PRICING_USD_PER_MILLION_TOKENS[provider]?.[model];
  if (!rates) return null;
  const [inputRate, outputRate] = rates;
  return (promptTokens / 1_000_000) * inputRate + (completionTokens / 1_000_000) * outputRate;
}
