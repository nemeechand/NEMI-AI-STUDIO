from __future__ import annotations

from app.ai.errors import UnknownProviderError
from app.ai.providers.anthropic_provider import AnthropicProvider
from app.ai.providers.base import AIProvider
from app.ai.providers.gemini_provider import GeminiProvider
from app.ai.providers.ollama_provider import OllamaProvider
from app.ai.providers.openai_provider import OpenAIProvider

_PROVIDERS: dict[str, AIProvider] = {
    p.id: p
    for p in (OpenAIProvider(), AnthropicProvider(), GeminiProvider(), OllamaProvider())
}


def get_provider(provider_id: str) -> AIProvider:
    try:
        return _PROVIDERS[provider_id]
    except KeyError:
        raise UnknownProviderError(f"Unknown AI provider: '{provider_id}'") from None


def list_providers() -> list[AIProvider]:
    return list(_PROVIDERS.values())
