from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from typing import ClassVar

from app.ai.types import ChatMessage, ConnectionTestResult, StreamChunk, StreamDone


class AIProvider(ABC):
    """One implementation per backend (OpenAI, Anthropic, Gemini, Ollama,
    DeepSeek, Grok/xAI, and a user-defined Custom OpenAI-compatible
    endpoint as of Sprint 15.5).

    `stream_chat` normalizes every provider's own streaming shape into the
    same two event types (`StreamChunk` then, at the end, exactly one
    `StreamDone` carrying whatever usage the provider reported) so
    `api/ai.py` never needs to know which provider it's talking to. Provider
    SDK errors are caught and re-raised as `app.ai.errors.ProviderError`
    subclasses by each implementation — never leaked as raw SDK exceptions.

    `base_url` (Sprint 15.5) is accepted by every provider for a uniform
    Settings UI, but only meaningfully acted on by providers whose SDK
    supports overriding it (`supports_base_url = True`) — passing one to a
    provider that doesn't support it is simply ignored, not an error.
    """

    id: ClassVar[str]
    display_name: ClassVar[str]
    requires_api_key: ClassVar[bool] = True
    supports_base_url: ClassVar[bool] = False

    @abstractmethod
    def stream_chat(
        self,
        *,
        messages: list[ChatMessage],
        model: str,
        api_key: str | None,
        base_url: str | None = None,
    ) -> AsyncIterator[StreamChunk | StreamDone]: ...

    @abstractmethod
    async def test_connection(
        self, *, api_key: str | None, base_url: str | None = None
    ) -> ConnectionTestResult:
        """A real, cheap network call to the provider (never fabricated) —
        used by Settings' "Test Connection" action. Never raises; any
        failure is reported as `ConnectionTestResult(ok=False, message=...)`."""
        ...

    async def list_models(
        self, *, api_key: str | None, base_url: str | None = None
    ) -> list[str]:
        """Real live model catalog for Settings' Model Manager "Refresh
        Models" action. Default: empty (no such capability) rather than a
        guessed static list — providers whose SDK can genuinely enumerate
        models override this; the UI falls back to its own curated
        suggestions list when this returns empty."""
        return []
