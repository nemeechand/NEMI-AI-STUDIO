from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Role = Literal["user", "assistant", "system"]


@dataclass(frozen=True)
class ChatMessage:
    role: Role
    content: str


@dataclass(frozen=True)
class TokenUsage:
    prompt_tokens: int | None = None
    completion_tokens: int | None = None


@dataclass(frozen=True)
class StreamChunk:
    """One incremental piece of assistant output."""

    delta: str


@dataclass(frozen=True)
class StreamDone:
    """Terminal event: exactly one is yielded, after the last StreamChunk,
    before the provider's async generator ends."""

    usage: TokenUsage


@dataclass(frozen=True)
class ConnectionTestResult:
    """Sprint 15.5's real "Test Connection" action — `ok`/`message` from
    an actual network call to the provider (a cheap real signal like a
    models-list call, never a fabricated ping), never guessed."""

    ok: bool
    message: str
