from __future__ import annotations

from collections.abc import AsyncIterator

import anthropic
from anthropic import AsyncAnthropic
from anthropic.types import MessageParam

from app.ai.errors import (
    AuthenticationError,
    InvalidRequestError,
    MissingApiKeyError,
    ProviderNetworkError,
    RateLimitError,
)
from app.ai.providers.base import AIProvider
from app.ai.types import ChatMessage, StreamChunk, StreamDone, TokenUsage

MAX_TOKENS = 4096


def _to_anthropic_messages(messages: list[ChatMessage]) -> list[MessageParam]:
    # Anthropic's Messages API only has "user"/"assistant" roles (system
    # goes through a separate top-level parameter, built below) — built
    # with an explicit branch, not a dict comprehension, for the same
    # discriminated-union-narrowing reason as the OpenAI provider.
    result: list[MessageParam] = []
    for m in messages:
        if m.role == "assistant":
            result.append({"role": "assistant", "content": m.content})
        elif m.role == "user":
            result.append({"role": "user", "content": m.content})
    return result


class AnthropicProvider(AIProvider):
    id = "anthropic"
    display_name = "Claude (Anthropic)"

    async def stream_chat(
        self, *, messages: list[ChatMessage], model: str, api_key: str | None
    ) -> AsyncIterator[StreamChunk | StreamDone]:
        if not api_key:
            raise MissingApiKeyError("No Anthropic API key configured. Add one in Settings.")

        system_parts = [m.content for m in messages if m.role == "system"]
        conversation = _to_anthropic_messages(messages)
        system = "\n\n".join(system_parts) if system_parts else anthropic.omit

        client = AsyncAnthropic(api_key=api_key)
        try:
            async with client.messages.stream(
                model=model,
                max_tokens=MAX_TOKENS,
                system=system,
                messages=conversation,
            ) as stream:
                async for text in stream.text_stream:
                    yield StreamChunk(delta=text)
                final = await stream.get_final_message()
                yield StreamDone(
                    usage=TokenUsage(
                        prompt_tokens=final.usage.input_tokens,
                        completion_tokens=final.usage.output_tokens,
                    )
                )
        except anthropic.AuthenticationError as exc:
            raise AuthenticationError(f"Anthropic rejected the API key: {exc}") from exc
        except anthropic.RateLimitError as exc:
            raise RateLimitError(f"Anthropic rate limit exceeded: {exc}") from exc
        except anthropic.BadRequestError as exc:
            raise InvalidRequestError(f"Anthropic rejected the request: {exc}") from exc
        except anthropic.APIConnectionError as exc:
            raise ProviderNetworkError(f"Could not reach Anthropic: {exc}") from exc
        except anthropic.APIStatusError as exc:
            raise InvalidRequestError(f"Anthropic returned an error: {exc}") from exc
        finally:
            await client.close()
