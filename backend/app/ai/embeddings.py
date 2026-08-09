from __future__ import annotations

import os
from abc import ABC, abstractmethod
from typing import ClassVar

import httpx

from app.ai.errors import (
    AuthenticationError,
    InvalidRequestError,
    MissingApiKeyError,
    ProviderNetworkError,
    RateLimitError,
    UnknownProviderError,
)

# Sprint 14: a small provider abstraction, parallel to app.ai.providers but
# for embeddings rather than chat — deliberately separate (not folded into
# AIProvider) because not every chat provider has an embeddings endpoint
# (Anthropic/Claude does not publish one as of this writing, so it's simply
# absent from _EMBEDDING_PROVIDERS below) and the request/response shape
# (batch of texts -> batch of float vectors, no streaming) is fundamentally
# different from stream_chat.

DEFAULT_OLLAMA_HOST = "http://127.0.0.1:11434"


class EmbeddingProvider(ABC):
    id: ClassVar[str]
    display_name: ClassVar[str]
    requires_api_key: ClassVar[bool] = True
    default_model: ClassVar[str]

    @abstractmethod
    async def embed(
        self, *, texts: list[str], model: str, api_key: str | None
    ) -> list[list[float]]: ...


class OpenAIEmbeddingProvider(EmbeddingProvider):
    id = "openai"
    display_name = "OpenAI"
    default_model = "text-embedding-3-small"

    async def embed(
        self, *, texts: list[str], model: str, api_key: str | None
    ) -> list[list[float]]:
        if not api_key:
            raise MissingApiKeyError("No OpenAI API key configured. Add one in Settings.")
        import openai
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=api_key)
        try:
            response = await client.embeddings.create(model=model, input=texts)
            return [item.embedding for item in response.data]
        except openai.AuthenticationError as exc:
            raise AuthenticationError(f"OpenAI rejected the API key: {exc}") from exc
        except openai.RateLimitError as exc:
            raise RateLimitError(f"OpenAI rate limit exceeded: {exc}") from exc
        except openai.BadRequestError as exc:
            raise InvalidRequestError(f"OpenAI rejected the request: {exc}") from exc
        except openai.APIConnectionError as exc:
            raise ProviderNetworkError(f"Could not reach OpenAI: {exc}") from exc
        except openai.APIStatusError as exc:
            raise InvalidRequestError(f"OpenAI returned an error: {exc}") from exc
        finally:
            await client.close()


class GeminiEmbeddingProvider(EmbeddingProvider):
    id = "gemini"
    display_name = "Gemini (Google)"
    default_model = "text-embedding-004"

    async def embed(
        self, *, texts: list[str], model: str, api_key: str | None
    ) -> list[list[float]]:
        if not api_key:
            raise MissingApiKeyError("No Gemini API key configured. Add one in Settings.")
        from typing import cast

        from google import genai
        from google.genai import errors as genai_errors
        from google.genai import types as genai_types

        client = genai.Client(api_key=api_key)
        try:
            # mypy sees `embed_content`'s enormous contents union and a
            # plain `list[str]` doesn't structurally match any single arm —
            # same narrow, well-understood cast as gemini_provider.py's
            # stream_chat (every element really is a str).
            contents = cast("genai_types.ContentListUnion", texts)
            result = await client.aio.models.embed_content(model=model, contents=contents)
            return [list(item.values or []) for item in (result.embeddings or [])]
        except genai_errors.ClientError as exc:
            status = getattr(exc, "status", None) or getattr(exc, "code", None)
            if status in (401, 403, "PERMISSION_DENIED", "UNAUTHENTICATED"):
                raise AuthenticationError(f"Gemini rejected the API key: {exc}") from exc
            if status == 429 or status == "RESOURCE_EXHAUSTED":
                raise RateLimitError(f"Gemini rate limit exceeded: {exc}") from exc
            raise InvalidRequestError(f"Gemini rejected the request: {exc}") from exc
        except genai_errors.ServerError as exc:
            raise ProviderNetworkError(f"Gemini server error: {exc}") from exc
        finally:
            # See app/ai/providers/gemini_provider.py's identical note: the
            # google-genai Client's httpx.AsyncClient is only released via
            # this explicit call, never by garbage collection.
            await client.aio.aclose()


class OllamaEmbeddingProvider(EmbeddingProvider):
    """Ollama's local `/api/embed` endpoint (the current, batch-capable
    replacement for the older single-prompt `/api/embeddings`) — no API
    key, same local-server assumption as app.ai.providers.ollama_provider.
    """

    id = "ollama"
    display_name = "Ollama (local)"
    requires_api_key = False
    default_model = "nomic-embed-text"

    async def embed(
        self, *, texts: list[str], model: str, api_key: str | None
    ) -> list[list[float]]:
        host = os.environ.get("NEMI_OLLAMA_HOST", DEFAULT_OLLAMA_HOST)
        try:
            # Matches ollama_provider.py's chat timeout — a batch of texts
            # embedded on a local CPU-bound model genuinely can take a
            # while; this is bulk indexing, not an interactive request.
            async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=5.0)) as client:
                response = await client.post(
                    f"{host}/api/embed", json={"model": model, "input": texts}
                )
                if response.status_code == 404:
                    raise InvalidRequestError(
                        f"Ollama model '{model}' is not available. Run `ollama pull {model}` first."
                    )
                response.raise_for_status()
                data = response.json()
                return list(data.get("embeddings", []))
        except httpx.ConnectError as exc:
            raise ProviderNetworkError(
                f"Could not reach Ollama at {host}. Is it running?"
            ) from exc
        except httpx.HTTPStatusError as exc:
            raise InvalidRequestError(f"Ollama returned an error: {exc}") from exc


_EMBEDDING_PROVIDERS: dict[str, EmbeddingProvider] = {
    p.id: p
    for p in (OpenAIEmbeddingProvider(), GeminiEmbeddingProvider(), OllamaEmbeddingProvider())
}


def get_embedding_provider(provider_id: str) -> EmbeddingProvider:
    try:
        return _EMBEDDING_PROVIDERS[provider_id]
    except KeyError:
        raise UnknownProviderError(
            f"'{provider_id}' has no embedding provider "
            "(Anthropic/Claude does not publish an embeddings API)."
        ) from None


def list_embedding_providers() -> list[EmbeddingProvider]:
    return list(_EMBEDDING_PROVIDERS.values())
