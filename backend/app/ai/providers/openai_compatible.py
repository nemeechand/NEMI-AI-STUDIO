from __future__ import annotations

from collections.abc import AsyncIterator

import openai
from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionMessageParam

from app.ai.errors import (
    AuthenticationError,
    InvalidRequestError,
    MissingApiKeyError,
    ProviderNetworkError,
    RateLimitError,
)
from app.ai.providers.base import AIProvider
from app.ai.types import ChatMessage, ConnectionTestResult, StreamChunk, StreamDone, TokenUsage


def _to_openai_messages(messages: list[ChatMessage]) -> list[ChatCompletionMessageParam]:
    # Built with an explicit per-role branch (not a generic dict
    # comprehension) so each literal's `role` narrows to the one specific
    # TypedDict variant the SDK's discriminated union expects — a plain
    # `{"role": m.role, ...}` comprehension only infers `dict[str, str]`,
    # which mypy strict correctly refuses to match against the union.
    result: list[ChatCompletionMessageParam] = []
    for m in messages:
        if m.role == "system":
            result.append({"role": "system", "content": m.content})
        elif m.role == "assistant":
            result.append({"role": "assistant", "content": m.content})
        else:
            result.append({"role": "user", "content": m.content})
    return result


class OpenAICompatibleProvider(AIProvider):
    """Sprint 15.5: shared implementation for every provider that speaks
    the OpenAI Chat Completions wire protocol via the `openai` SDK with a
    (possibly overridden) `base_url` — OpenAI itself, DeepSeek, Grok/xAI,
    and a user-defined Custom endpoint are four real, distinct providers
    that happen to share this one real integration path, rather than four
    near-duplicate copies of the same streaming/error-handling logic.

    `default_base_url = None` means "the SDK's own default" (real
    OpenAI) — subclasses set a real published API base URL, or leave it
    `None` and require the user to supply one (see `CustomProvider`).
    """

    supports_base_url = True
    default_base_url: str | None = None
    requires_base_url = False

    def _resolve_base_url(self, base_url: str | None) -> str | None:
        resolved = base_url or self.default_base_url
        if self.requires_base_url and not resolved:
            raise InvalidRequestError(
                f"{self.display_name} has no base URL configured. Set one in Settings → "
                "AI Providers before using this provider."
            )
        return resolved

    async def stream_chat(
        self,
        *,
        messages: list[ChatMessage],
        model: str,
        api_key: str | None,
        base_url: str | None = None,
    ) -> AsyncIterator[StreamChunk | StreamDone]:
        if not api_key:
            raise MissingApiKeyError(
                f"No {self.display_name} API key configured. Add one in Settings."
            )

        client = AsyncOpenAI(api_key=api_key, base_url=self._resolve_base_url(base_url))
        try:
            stream = await client.chat.completions.create(
                model=model,
                messages=_to_openai_messages(messages),
                stream=True,
                stream_options={"include_usage": True},
            )
            usage = TokenUsage()
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield StreamChunk(delta=chunk.choices[0].delta.content)
                if chunk.usage:
                    usage = TokenUsage(
                        prompt_tokens=chunk.usage.prompt_tokens,
                        completion_tokens=chunk.usage.completion_tokens,
                    )
            yield StreamDone(usage=usage)
        except openai.AuthenticationError as exc:
            raise AuthenticationError(f"{self.display_name} rejected the API key: {exc}") from exc
        except openai.RateLimitError as exc:
            raise RateLimitError(f"{self.display_name} rate limit exceeded: {exc}") from exc
        except openai.BadRequestError as exc:
            raise InvalidRequestError(f"{self.display_name} rejected the request: {exc}") from exc
        except openai.APIConnectionError as exc:
            raise ProviderNetworkError(f"Could not reach {self.display_name}: {exc}") from exc
        except openai.APIStatusError as exc:
            raise InvalidRequestError(f"{self.display_name} returned an error: {exc}") from exc
        finally:
            await client.close()

    async def test_connection(
        self, *, api_key: str | None, base_url: str | None = None
    ) -> ConnectionTestResult:
        if not api_key:
            return ConnectionTestResult(ok=False, message="No API key configured.")
        try:
            resolved_base_url = self._resolve_base_url(base_url)
        except InvalidRequestError as exc:
            return ConnectionTestResult(ok=False, message=str(exc))
        client = AsyncOpenAI(api_key=api_key, base_url=resolved_base_url)
        try:
            models = await client.models.list()
            count = len(models.data)
            return ConnectionTestResult(ok=True, message=f"Connected — {count} model(s) available.")
        except openai.AuthenticationError as exc:
            return ConnectionTestResult(ok=False, message=f"Authentication failed: {exc}")
        except openai.APIConnectionError as exc:
            return ConnectionTestResult(ok=False, message=f"Could not reach the server: {exc}")
        except Exception as exc:  # a connection test must never raise
            return ConnectionTestResult(ok=False, message=f"Connection test failed: {exc}")
        finally:
            await client.close()

    async def list_models(
        self, *, api_key: str | None, base_url: str | None = None
    ) -> list[str]:
        if not api_key:
            return []
        try:
            resolved_base_url = self._resolve_base_url(base_url)
        except InvalidRequestError:
            return []
        client = AsyncOpenAI(api_key=api_key, base_url=resolved_base_url)
        try:
            models = await client.models.list()
            return sorted(m.id for m in models.data)
        except Exception:
            return []
        finally:
            await client.close()


class OpenAIProvider(OpenAICompatibleProvider):
    id = "openai"
    display_name = "OpenAI"
    default_base_url = None


class DeepSeekProvider(OpenAICompatibleProvider):
    id = "deepseek"
    display_name = "DeepSeek"
    default_base_url = "https://api.deepseek.com"


class GrokProvider(OpenAICompatibleProvider):
    id = "grok"
    display_name = "Grok (xAI)"
    default_base_url = "https://api.x.ai/v1"


class CustomProvider(OpenAICompatibleProvider):
    """A user-defined OpenAI-compatible endpoint (a self-hosted gateway,
    an Azure OpenAI-compatible proxy, etc.) — real, but only usable once
    the user has configured a real base URL in Settings; there is no
    honest default to fall back to."""

    id = "custom"
    display_name = "Custom (OpenAI-compatible)"
    default_base_url = None
    requires_base_url = True
