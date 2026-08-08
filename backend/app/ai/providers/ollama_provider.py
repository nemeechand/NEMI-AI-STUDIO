from __future__ import annotations

import json
import os
from collections.abc import AsyncIterator

import httpx

from app.ai.errors import InvalidRequestError, ProviderNetworkError
from app.ai.providers.base import AIProvider
from app.ai.types import ChatMessage, StreamChunk, StreamDone, TokenUsage

DEFAULT_HOST = "http://127.0.0.1:11434"


async def list_local_models() -> list[str]:
    """Real, live list of whatever the user has actually pulled locally —
    unlike the cloud providers, there's no stable catalog to hardcode; the
    whole point of Ollama is running whichever local models the user has."""
    host = os.environ.get("NEMI_OLLAMA_HOST", DEFAULT_HOST)
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
            response = await client.get(f"{host}/api/tags")
            response.raise_for_status()
            data = response.json()
            return [model["name"] for model in data.get("models", [])]
    except httpx.ConnectError as exc:
        raise ProviderNetworkError(
            f"Could not reach Ollama at {host}. Is it running?"
        ) from exc
    except httpx.HTTPStatusError as exc:
        raise InvalidRequestError(f"Ollama returned an error: {exc}") from exc


class OllamaProvider(AIProvider):
    """Ollama runs as a local HTTP server the user already has installed
    and running — no API key, no SDK, just its documented `/api/chat`
    endpoint (newline-delimited JSON, one object per line, `stream: true`).
    """

    id = "ollama"
    display_name = "Ollama (local)"
    requires_api_key = False

    async def stream_chat(
        self, *, messages: list[ChatMessage], model: str, api_key: str | None
    ) -> AsyncIterator[StreamChunk | StreamDone]:
        host = os.environ.get("NEMI_OLLAMA_HOST", DEFAULT_HOST)
        payload = {
            "model": model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "stream": True,
        }
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=5.0)) as client:
                async with client.stream("POST", f"{host}/api/chat", json=payload) as response:
                    if response.status_code == 404:
                        text = await response.aread()
                        raise InvalidRequestError(
                            f"Ollama model '{model}' is not available. "
                            f"Run `ollama pull {model}` first. ({text.decode(errors='replace')})"
                        )
                    response.raise_for_status()
                    usage = TokenUsage()
                    async for line in response.aiter_lines():
                        if not line.strip():
                            continue
                        data = json.loads(line)
                        content = data.get("message", {}).get("content")
                        if content:
                            yield StreamChunk(delta=content)
                        if data.get("done"):
                            usage = TokenUsage(
                                prompt_tokens=data.get("prompt_eval_count"),
                                completion_tokens=data.get("eval_count"),
                            )
                    yield StreamDone(usage=usage)
        except httpx.ConnectError as exc:
            raise ProviderNetworkError(
                f"Could not reach Ollama at {host}. Is it running? "
                "Install from https://ollama.com and run `ollama serve`."
            ) from exc
        except httpx.HTTPStatusError as exc:
            raise InvalidRequestError(f"Ollama returned an error: {exc}") from exc
