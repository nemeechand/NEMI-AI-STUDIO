from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from typing import ClassVar

from app.ai.types import ChatMessage, StreamChunk, StreamDone


class AIProvider(ABC):
    """One implementation per backend (OpenAI, Anthropic, Gemini, Ollama).

    `stream_chat` normalizes every provider's own streaming shape into the
    same two event types (`StreamChunk` then, at the end, exactly one
    `StreamDone` carrying whatever usage the provider reported) so
    `api/ai.py` never needs to know which provider it's talking to. Provider
    SDK errors are caught and re-raised as `app.ai.errors.ProviderError`
    subclasses by each implementation — never leaked as raw SDK exceptions.
    """

    id: ClassVar[str]
    display_name: ClassVar[str]
    requires_api_key: ClassVar[bool] = True

    @abstractmethod
    def stream_chat(
        self, *, messages: list[ChatMessage], model: str, api_key: str | None
    ) -> AsyncIterator[StreamChunk | StreamDone]: ...
