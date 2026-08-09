from __future__ import annotations

from collections.abc import AsyncIterator
from typing import cast

from google import genai
from google.genai import errors as genai_errors
from google.genai import types as genai_types

from app.ai.errors import (
    AuthenticationError,
    InvalidRequestError,
    MissingApiKeyError,
    ProviderNetworkError,
    RateLimitError,
)
from app.ai.providers.base import AIProvider
from app.ai.types import ChatMessage, ConnectionTestResult, StreamChunk, StreamDone, TokenUsage


def _client(api_key: str, base_url: str | None) -> genai.Client:
    http_options = genai_types.HttpOptions(base_url=base_url) if base_url else None
    return genai.Client(api_key=api_key, http_options=http_options)


class GeminiProvider(AIProvider):
    id = "gemini"
    display_name = "Gemini (Google)"
    # Sprint 15.5: the google-genai SDK accepts a base_url override via
    # HttpOptions (e.g. for a Vertex AI-compatible proxy) — honestly
    # supported, not accepted-and-ignored.
    supports_base_url = True

    async def stream_chat(
        self,
        *,
        messages: list[ChatMessage],
        model: str,
        api_key: str | None,
        base_url: str | None = None,
    ) -> AsyncIterator[StreamChunk | StreamDone]:
        if not api_key:
            raise MissingApiKeyError("No Gemini API key configured. Add one in Settings.")

        # Gemini uses "model" (not "assistant") for the AI's own turns, and
        # a separate top-level system_instruction rather than a message role.
        system_parts = [m.content for m in messages if m.role == "system"]
        content_list = [
            genai_types.Content(
                role="model" if m.role == "assistant" else "user",
                parts=[genai_types.Part(text=m.content)],
            )
            for m in messages
            if m.role != "system"
        ]
        # mypy's list invariance means a `list[Content]` doesn't structurally
        # satisfy `generate_content_stream`'s `list[Content | str | ...]`
        # parameter type even though every element trivially matches one
        # arm of that union — a narrow, well-understood cast, not a runtime
        # concern (every element really is a Content).
        contents = cast("genai_types.ContentListUnion", content_list)
        config = genai_types.GenerateContentConfig(
            system_instruction="\n\n".join(system_parts) if system_parts else None,
        )

        client = _client(api_key, base_url)
        try:
            usage = TokenUsage()
            async for chunk in await client.aio.models.generate_content_stream(
                model=model, contents=contents, config=config
            ):
                if chunk.text:
                    yield StreamChunk(delta=chunk.text)
                if chunk.usage_metadata:
                    usage = TokenUsage(
                        prompt_tokens=chunk.usage_metadata.prompt_token_count,
                        completion_tokens=chunk.usage_metadata.candidates_token_count,
                    )
            yield StreamDone(usage=usage)
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
            # google-genai's Client lazily owns an httpx.AsyncClient that is
            # only released via this explicit call — never closed by garbage
            # collection, so every code path (including exceptions) must
            # reach here or the connection leaks.
            await client.aio.aclose()

    async def test_connection(
        self, *, api_key: str | None, base_url: str | None = None
    ) -> ConnectionTestResult:
        if not api_key:
            return ConnectionTestResult(ok=False, message="No API key configured.")
        client = _client(api_key, base_url)
        try:
            count = 0
            async for _ in await client.aio.models.list():
                count += 1
            return ConnectionTestResult(ok=True, message=f"Connected — {count} model(s) available.")
        except genai_errors.ClientError as exc:
            status = getattr(exc, "status", None) or getattr(exc, "code", None)
            if status in (401, 403, "PERMISSION_DENIED", "UNAUTHENTICATED"):
                return ConnectionTestResult(ok=False, message=f"Authentication failed: {exc}")
            return ConnectionTestResult(ok=False, message=f"Connection test failed: {exc}")
        except Exception as exc:  # a connection test must never raise
            return ConnectionTestResult(ok=False, message=f"Connection test failed: {exc}")
        finally:
            await client.aio.aclose()

    async def list_models(
        self, *, api_key: str | None, base_url: str | None = None
    ) -> list[str]:
        if not api_key:
            return []
        client = _client(api_key, base_url)
        try:
            return sorted([m.name async for m in await client.aio.models.list() if m.name])
        except Exception:
            return []
        finally:
            await client.aio.aclose()
