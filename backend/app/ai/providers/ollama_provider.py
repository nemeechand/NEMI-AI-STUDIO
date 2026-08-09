from __future__ import annotations

import json
import os
import shutil
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

import httpx

from app.ai.errors import InvalidRequestError, ProviderNetworkError
from app.ai.providers.base import AIProvider
from app.ai.types import ChatMessage, ConnectionTestResult, StreamChunk, StreamDone, TokenUsage

DEFAULT_HOST = "http://127.0.0.1:11434"


def resolve_host(base_url: str | None) -> str:
    return base_url or os.environ.get("NEMI_OLLAMA_HOST", DEFAULT_HOST)


@dataclass(frozen=True)
class OllamaModel:
    """One locally-pulled Ollama model, with its real reported size —
    Sprint 15.5's "Display model size" requirement, sourced directly from
    `/api/tags` rather than estimated."""

    name: str
    size_bytes: int
    modified_at: str | None = None


def is_ollama_installed() -> bool:
    """Whether the `ollama` CLI is on PATH — a real filesystem check, not a
    guess. The server can still be reachable over HTTP without the CLI
    being installed (e.g. Docker), so this is reported separately from
    server-reachability."""
    return shutil.which("ollama") is not None


async def is_server_running(base_url: str | None = None) -> bool:
    host = resolve_host(base_url)
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(3.0)) as client:
            response = await client.get(f"{host}/api/tags")
            return response.status_code == 200
    except httpx.HTTPError:
        return False


async def list_local_models(base_url: str | None = None) -> list[OllamaModel]:
    """Real, live list of whatever the user has actually pulled locally —
    unlike the cloud providers, there's no stable catalog to hardcode; the
    whole point of Ollama is running whichever local models the user has."""
    host = resolve_host(base_url)
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
            response = await client.get(f"{host}/api/tags")
            response.raise_for_status()
            data = response.json()
            return [
                OllamaModel(
                    name=model["name"],
                    size_bytes=model.get("size", 0),
                    modified_at=model.get("modified_at"),
                )
                for model in data.get("models", [])
            ]
    except httpx.ConnectError as exc:
        raise ProviderNetworkError(
            f"Could not reach Ollama at {host}. Is it running?"
        ) from exc
    except httpx.HTTPStatusError as exc:
        raise InvalidRequestError(f"Ollama returned an error: {exc}") from exc


async def pull_model(model_name: str, base_url: str | None = None) -> AsyncIterator[dict[str, Any]]:
    """Streams Ollama's own real pull-progress events (newline-delimited
    JSON — `status`, and once download starts, `completed`/`total` byte
    counts) straight through, never synthesized."""
    host = resolve_host(base_url)
    payload = {"name": model_name, "stream": True}
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(None, connect=5.0)) as client:
            async with client.stream("POST", f"{host}/api/pull", json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    yield json.loads(line)
    except httpx.ConnectError as exc:
        raise ProviderNetworkError(f"Could not reach Ollama at {host}. Is it running?") from exc
    except httpx.HTTPStatusError as exc:
        raise InvalidRequestError(f"Ollama returned an error: {exc}") from exc


async def delete_model(model_name: str, base_url: str | None = None) -> None:
    host = resolve_host(base_url)
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
            response = await client.request(
                "DELETE", f"{host}/api/delete", json={"name": model_name}
            )
            if response.status_code == 404:
                raise InvalidRequestError(f"Ollama model '{model_name}' was not found.")
            response.raise_for_status()
    except httpx.ConnectError as exc:
        raise ProviderNetworkError(f"Could not reach Ollama at {host}. Is it running?") from exc
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
    supports_base_url = True

    async def stream_chat(
        self,
        *,
        messages: list[ChatMessage],
        model: str,
        api_key: str | None,
        base_url: str | None = None,
    ) -> AsyncIterator[StreamChunk | StreamDone]:
        host = resolve_host(base_url)
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

    async def test_connection(
        self, *, api_key: str | None, base_url: str | None = None
    ) -> ConnectionTestResult:
        host = resolve_host(base_url)
        try:
            models = await list_local_models(base_url)
            return ConnectionTestResult(
                ok=True, message=f"Connected to {host} — {len(models)} model(s) installed."
            )
        except (ProviderNetworkError, InvalidRequestError) as exc:
            return ConnectionTestResult(ok=False, message=str(exc))
        except Exception as exc:  # a connection test must never raise
            return ConnectionTestResult(ok=False, message=f"Connection test failed: {exc}")
