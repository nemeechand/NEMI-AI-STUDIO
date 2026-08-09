from __future__ import annotations

import json
import time
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from app.ai.errors import ProviderError
from app.ai.providers.ollama_provider import list_local_models
from app.ai.registry import get_provider, list_providers
from app.ai.types import ChatMessage, StreamChunk, StreamDone, TokenUsage
from app.api.schemas import (
    AiConversationCreate,
    AiConversationRename,
    AiProviderOut,
    AiSendMessageRequest,
)
from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.connection import get_connection
from app.db.repositories.ai_conversations_repository import ConversationsRepository
from app.db.repositories.ai_messages_repository import MessagesRepository, Status
from app.db.repositories.provider_settings_repository import ProviderSettingsRepository

router = APIRouter(prefix="/ai")
logger = get_logger("api.ai")


@router.get("/providers", response_model=list[AiProviderOut])
def get_providers() -> list[dict[str, Any]]:
    return [
        {
            "id": p.id,
            "display_name": p.display_name,
            "requires_api_key": p.requires_api_key,
            "supports_base_url": p.supports_base_url,
        }
        for p in list_providers()
    ]


@router.get("/ollama/models")
async def get_ollama_models() -> list[str]:
    return [m.name for m in await list_local_models()]


@router.get("/conversations")
def list_conversations(project_id: str | None = Query(default=None)) -> list[dict[str, Any]]:
    settings = get_settings()
    with get_connection(settings) as connection:
        return ConversationsRepository(connection).list_for_project(project_id)


@router.post("/conversations", status_code=201)
def create_conversation(payload: AiConversationCreate) -> dict[str, Any]:
    settings = get_settings()
    with get_connection(settings) as connection:
        return ConversationsRepository(connection).create(
            project_id=payload.project_id,
            title=payload.title,
            provider=payload.provider,
            model=payload.model,
        )


@router.get("/conversations/{conversation_id}/messages")
def list_messages(conversation_id: str) -> list[dict[str, Any]]:
    settings = get_settings()
    with get_connection(settings) as connection:
        if ConversationsRepository(connection).get(conversation_id) is None:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return MessagesRepository(connection).list_for_conversation(conversation_id)


@router.patch("/conversations/{conversation_id}")
def rename_conversation(conversation_id: str, payload: AiConversationRename) -> dict[str, Any]:
    settings = get_settings()
    with get_connection(settings) as connection:
        repo = ConversationsRepository(connection)
        if not repo.rename(conversation_id, payload.title):
            raise HTTPException(status_code=404, detail="Conversation not found")
        return repo.get(conversation_id)  # type: ignore[return-value]


@router.delete("/conversations/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: str) -> None:
    settings = get_settings()
    with get_connection(settings) as connection:
        if not ConversationsRepository(connection).delete(conversation_id):
            raise HTTPException(status_code=404, detail="Conversation not found")


def _format_context_block(refs: list[Any]) -> str:
    parts = ["Context — the user has attached the following file(s)/selection(s):"]
    for ref in refs:
        location = ref.path
        if ref.start_line is not None and ref.end_line is not None:
            location += f" (lines {ref.start_line}-{ref.end_line})"
        parts.append(f"--- {location} ---\n{ref.content}\n--- end ---")
    return "\n\n".join(parts)


def _sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def _stream_and_persist(
    *,
    request: Request,
    conversation_id: str,
    provider_id: str,
    model: str,
    api_key: str | None,
    base_url: str | None,
    chat_messages: list[ChatMessage],
) -> AsyncIterator[str]:
    settings = get_settings()
    accumulated: list[str] = []
    usage = TokenUsage()
    status: Status = "complete"
    error_payload: dict[str, str] | None = None
    persisted_message: dict[str, Any] | None = None
    started_at = time.monotonic()

    # Persistence lives in `finally`, not after the try block, because a
    # client disconnect doesn't always surface as our own is_disconnected()
    # check between chunks — if the ASGI server tears the generator down
    # while it's suspended mid-await (e.g. blocked waiting on the next
    # provider token), Python delivers GeneratorExit at that suspension
    # point instead. GeneratorExit is a BaseException, not an Exception, so
    # it deliberately isn't caught above — but code after the try block
    # would never run in that case, silently losing the partial response.
    # `finally` runs regardless, so the partial content is never lost.
    try:
        try:
            provider = get_provider(provider_id)
            async for event in provider.stream_chat(
                messages=chat_messages, model=model, api_key=api_key, base_url=base_url
            ):
                if await request.is_disconnected():
                    status = "cancelled"
                    break
                if isinstance(event, StreamChunk):
                    accumulated.append(event.delta)
                    yield _sse("chunk", {"delta": event.delta})
                elif isinstance(event, StreamDone):
                    usage = event.usage
        except ProviderError as exc:
            status = "error"
            error_payload = {"code": exc.code, "message": str(exc)}
            logger.warning("AI provider error (%s/%s): %s", provider_id, model, exc)
        except Exception:
            status = "error"
            error_payload = {
                "code": "internal_error",
                "message": "An unexpected error occurred.",
            }
            logger.exception("Unhandled error streaming from %s/%s", provider_id, model)
    finally:
        # The in-loop is_disconnected() check above only ever runs between
        # two already-yielded provider chunks. A cancel that lands before
        # the *first* chunk arrives — confirmed live against a fast local
        # Ollama model, which can get cancelled while still awaiting its
        # very first token — never reaches that check at all: GeneratorExit
        # unwinds straight past it, `status` is still stuck at its initial
        # "complete" default, and an empty response would be persisted as
        # if it had succeeded. One more disconnect check here, unconditional
        # on where the loop got to, catches that gap.
        if status == "complete" and await request.is_disconnected():
            status = "cancelled"
        content = "".join(accumulated)
        latency_ms = round((time.monotonic() - started_at) * 1000)
        with get_connection(settings) as connection:
            persisted_message = MessagesRepository(connection).add_assistant_message(
                conversation_id=conversation_id,
                content=content,
                provider=provider_id,
                model=model,
                status=status,
                error_message=error_payload["message"] if error_payload else None,
                prompt_tokens=usage.prompt_tokens,
                completion_tokens=usage.completion_tokens,
                latency_ms=latency_ms,
            )
            ConversationsRepository(connection).touch(
                conversation_id, provider=provider_id, model=model
            )
            if status == "complete":
                ProviderSettingsRepository(connection).record_used(provider_id, model=model)

    # Only reachable when the client is still connected (GeneratorExit
    # skips straight past these — there is no one left to send SSE frames
    # to, which is fine: the `finally` above already made sure the DB
    # write happened either way).
    if error_payload:
        yield _sse("error", error_payload)
    else:
        yield _sse(
            "usage",
            {
                "promptTokens": usage.prompt_tokens,
                "completionTokens": usage.completion_tokens,
                "latencyMs": latency_ms,
            },
        )
    yield _sse("done", {"messageId": persisted_message["id"], "status": status})


@router.post("/conversations/{conversation_id}/messages/stream")
def send_message_stream(
    conversation_id: str, payload: AiSendMessageRequest, request: Request
) -> StreamingResponse:
    settings = get_settings()
    with get_connection(settings) as connection:
        conversations_repo = ConversationsRepository(connection)
        if conversations_repo.get(conversation_id) is None:
            raise HTTPException(status_code=404, detail="Conversation not found")

        messages_repo = MessagesRepository(connection)
        context_refs = (
            [
                {"path": r.path, "start_line": r.start_line, "end_line": r.end_line}
                for r in payload.context_refs
            ]
            if payload.context_refs
            else None
        )
        messages_repo.add_user_message(
            conversation_id=conversation_id, content=payload.content, context_refs=context_refs
        )

        prior = messages_repo.list_for_conversation(conversation_id)
        user_content_for_provider = payload.content
        if payload.context_refs:
            user_content_for_provider = (
                f"{_format_context_block(payload.context_refs)}\n\n{payload.content}"
            )

        chat_messages: list[ChatMessage] = []
        for index, row in enumerate(prior):
            content = row["content"]
            if index == len(prior) - 1 and row["role"] == "user":
                content = user_content_for_provider
            chat_messages.append(ChatMessage(role=row["role"], content=content))

    return StreamingResponse(
        _stream_and_persist(
            request=request,
            conversation_id=conversation_id,
            provider_id=payload.provider,
            model=payload.model,
            api_key=payload.api_key,
            base_url=payload.base_url,
            chat_messages=chat_messages,
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
