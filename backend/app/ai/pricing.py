from __future__ import annotations

# Sprint 13's Token & Cost Center: published list pricing (USD per 1M
# tokens, input/output) for the models this app suggests by default (see
# frontend/src/ai/providerDefaults.ts's SUGGESTED_MODELS) — a real,
# labeled *estimate* based on public rate cards, not a fabricated number
# and not a live-fetched one (no provider exposes a per-call billing API
# this app could query). A model not in this table (a user can type any
# model id) simply has no cost estimate rather than a guessed one.
# Ollama is entirely absent: it's local and free, always $0.
_PRICING_USD_PER_MILLION_TOKENS: dict[str, dict[str, tuple[float, float]]] = {
    "openai": {
        "gpt-4o-mini": (0.15, 0.60),
        "gpt-4o": (2.50, 10.00),
        "gpt-4.1": (2.00, 8.00),
        "o4-mini": (1.10, 4.40),
    },
    "anthropic": {
        "claude-sonnet-4-5-20250929": (3.00, 15.00),
        "claude-opus-4-1-20250805": (15.00, 75.00),
        "claude-3-5-haiku-20241022": (0.80, 4.00),
    },
    "gemini": {
        "gemini-2.5-flash": (0.30, 2.50),
        "gemini-2.5-pro": (1.25, 10.00),
        "gemini-2.0-flash": (0.10, 0.40),
    },
}


def estimate_cost_usd(
    provider: str, model: str, prompt_tokens: int, completion_tokens: int
) -> float | None:
    """Returns `None` (never a guessed 0 or invented rate) when the
    provider/model isn't in the table — the caller must render that as
    "unknown", not silently as free or as a real number."""
    if provider == "ollama":
        return 0.0
    rates = _PRICING_USD_PER_MILLION_TOKENS.get(provider, {}).get(model)
    if rates is None:
        return None
    input_rate, output_rate = rates
    return (
        (prompt_tokens / 1_000_000) * input_rate + (completion_tokens / 1_000_000) * output_rate
    )
