from __future__ import annotations

import asyncio

import httpx
import pytest

from app.ai.embeddings import get_embedding_provider, list_embedding_providers
from app.ai.errors import MissingApiKeyError, UnknownProviderError

OLLAMA_HOST = "http://127.0.0.1:11434"
OLLAMA_EMBED_MODEL = "nomic-embed-text"


def _ollama_embed_model_available() -> bool:
    try:
        response = httpx.get(f"{OLLAMA_HOST}/api/tags", timeout=2.0)
        response.raise_for_status()
        names = {m["name"] for m in response.json().get("models", [])}
        return any(name.startswith(OLLAMA_EMBED_MODEL) for name in names)
    except httpx.HTTPError:
        return False


def test_list_embedding_providers_excludes_anthropic() -> None:
    ids = {p.id for p in list_embedding_providers()}
    # Anthropic/Claude publishes no embeddings API — deliberately absent,
    # not silently mapped to something else.
    assert ids == {"openai", "gemini", "ollama"}


def test_get_embedding_provider_unknown_raises() -> None:
    with pytest.raises(UnknownProviderError):
        get_embedding_provider("anthropic")


def test_openai_embed_without_key_raises_missing_api_key() -> None:
    provider = get_embedding_provider("openai")

    async def run() -> None:
        await provider.embed(texts=["hello"], model="text-embedding-3-small", api_key=None)

    with pytest.raises(MissingApiKeyError):
        asyncio.run(run())


def test_gemini_embed_without_key_raises_missing_api_key() -> None:
    provider = get_embedding_provider("gemini")

    async def run() -> None:
        await provider.embed(texts=["hello"], model="text-embedding-004", api_key=None)

    with pytest.raises(MissingApiKeyError):
        asyncio.run(run())


@pytest.mark.skipif(
    not _ollama_embed_model_available(), reason="Ollama embedding model not pulled locally"
)
def test_ollama_embed_real_round_trip() -> None:
    """A genuine, non-mocked embedding call against a real local model —
    mirrors test_ai_api.py's live-Ollama chat test."""
    provider = get_embedding_provider("ollama")

    vectors = asyncio.run(
        provider.embed(texts=["hello world"], model=OLLAMA_EMBED_MODEL, api_key=None)
    )

    assert len(vectors) == 1
    assert len(vectors[0]) > 0
    assert all(isinstance(v, float) for v in vectors[0])
