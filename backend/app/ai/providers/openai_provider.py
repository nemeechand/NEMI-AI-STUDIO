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
from app.ai.types import ChatMessage, StreamChunk, StreamDone, TokenUsage


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


class OpenAIProvider(AIProvider):
    id = "openai"
    display_name = "OpenAI"

    async def stream_chat(
        self, *, messages: list[ChatMessage], model: str, api_key: str | None
    ) -> AsyncIterator[StreamChunk | StreamDone]:
        if not api_key:
            raise MissingApiKeyError("No OpenAI API key configured. Add one in Settings.")

        client = AsyncOpenAI(api_key=api_key)
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
