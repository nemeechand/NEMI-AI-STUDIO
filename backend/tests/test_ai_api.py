from __future__ import annotations

import json
from collections.abc import Iterator
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from app.server import create_app

OLLAMA_HOST = "http://127.0.0.1:11434"
OLLAMA_MODEL = "qwen2.5:0.5b"


def _ollama_available() -> bool:
    try:
        response = httpx.get(f"{OLLAMA_HOST}/api/tags", timeout=2.0)
        return response.status_code == 200
    except httpx.HTTPError:
        return False


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(create_app()) as test_client:
        yield test_client


def _create_conversation(client: TestClient, **overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "title": "Test conversation",
        "provider": "ollama",
        "model": OLLAMA_MODEL,
    }
    payload.update(overrides)
    response = client.post("/ai/conversations", json=payload)
    assert response.status_code == 201
    return response.json()  # type: ignore[no-any-return]


def test_list_providers_returns_all_seven(client: TestClient) -> None:
    response = client.get("/ai/providers")

    assert response.status_code == 200
    ids = {p["id"] for p in response.json()}
    # Sprint 15.5: openai/anthropic/gemini/ollama plus deepseek/grok/custom
    # (the latter three share the OpenAI-compatible wire protocol).
    assert ids == {"openai", "anthropic", "gemini", "ollama", "deepseek", "grok", "custom"}
    by_id = {p["id"]: p for p in response.json()}
    assert by_id["ollama"]["requires_api_key"] is False
    assert by_id["openai"]["requires_api_key"] is True


def test_create_and_list_conversation(client: TestClient) -> None:
    created = _create_conversation(client)

    listed = client.get("/ai/conversations").json()
    assert any(c["id"] == created["id"] for c in listed)


def test_conversations_scoped_by_project(client: TestClient) -> None:
    # project_id is a real FK into `projects` — create genuine projects
    # rather than arbitrary strings, matching how the app always supplies
    # the currently-open project's real id.
    project_a = client.post(
        "/projects/opened", json={"path": "/tmp/proj-a", "name": "proj-a"}
    ).json()
    project_b = client.post(
        "/projects/opened", json={"path": "/tmp/proj-b", "name": "proj-b"}
    ).json()
    _create_conversation(client, project_id=project_a["id"])
    _create_conversation(client, project_id=project_b["id"])
    _create_conversation(client)  # global (project_id=None)

    scoped_a = client.get("/ai/conversations", params={"project_id": project_a["id"]}).json()
    assert len(scoped_a) == 1
    global_only = client.get("/ai/conversations").json()
    assert len(global_only) == 1


def test_rename_conversation(client: TestClient) -> None:
    created = _create_conversation(client)

    response = client.patch(f"/ai/conversations/{created['id']}", json={"title": "Renamed"})

    assert response.status_code == 200
    assert response.json()["title"] == "Renamed"


def test_rename_unknown_conversation_returns_404(client: TestClient) -> None:
    response = client.patch("/ai/conversations/does-not-exist", json={"title": "x"})

    assert response.status_code == 404


def test_delete_conversation_removes_it_and_its_messages(client: TestClient) -> None:
    created = _create_conversation(client)

    delete_response = client.delete(f"/ai/conversations/{created['id']}")
    assert delete_response.status_code == 204

    messages_response = client.get(f"/ai/conversations/{created['id']}/messages")
    assert messages_response.status_code == 404


def test_messages_for_unknown_conversation_returns_404(client: TestClient) -> None:
    response = client.get("/ai/conversations/does-not-exist/messages")

    assert response.status_code == 404


def test_stream_unknown_conversation_returns_404(client: TestClient) -> None:
    response = client.post(
        "/ai/conversations/does-not-exist/messages/stream",
        json={"content": "hi", "provider": "ollama", "model": OLLAMA_MODEL},
    )

    assert response.status_code == 404


def test_stream_missing_api_key_reports_error_event(client: TestClient) -> None:
    """Exercises the real MissingApiKeyError path (no network call — the
    provider raises before ever contacting OpenAI) rather than a mock."""
    created = _create_conversation(client, provider="openai", model="gpt-4o-mini")

    with client.stream(
        "POST",
        f"/ai/conversations/{created['id']}/messages/stream",
        json={"content": "hi", "provider": "openai", "model": "gpt-4o-mini"},
    ) as response:
        assert response.status_code == 200
        body = "".join(response.iter_text())

    assert "event: error" in body
    assert "missing_api_key" in body

    messages = client.get(f"/ai/conversations/{created['id']}/messages").json()
    assistant_message = next(m for m in messages if m["role"] == "assistant")
    assert assistant_message["status"] == "error"
    assert assistant_message["error_message"] is not None


def test_stream_unknown_provider_reports_error_event(client: TestClient) -> None:
    created = _create_conversation(client, provider="not-a-real-provider", model="x")

    with client.stream(
        "POST",
        f"/ai/conversations/{created['id']}/messages/stream",
        json={"content": "hi", "provider": "not-a-real-provider", "model": "x"},
    ) as response:
        body = "".join(response.iter_text())

    assert "event: error" in body
    assert "unknown_provider" in body


@pytest.mark.skipif(not _ollama_available(), reason="Ollama is not running locally")
def test_stream_real_ollama_end_to_end(client: TestClient) -> None:
    """A genuine, non-mocked round trip against a real local model — the
    only provider that needs no API key, so it's the one exercised live."""
    created = _create_conversation(client)

    with client.stream(
        "POST",
        f"/ai/conversations/{created['id']}/messages/stream",
        json={
            "content": "Reply with the single word: pong",
            "provider": "ollama",
            "model": OLLAMA_MODEL,
        },
    ) as response:
        assert response.status_code == 200
        events = [line for line in response.iter_lines() if line.startswith("event:")]

    assert "event: chunk" in events
    assert "event: usage" in events
    assert "event: done" in events

    messages = client.get(f"/ai/conversations/{created['id']}/messages").json()
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[0]["content"] == "Reply with the single word: pong"
    assert messages[1]["role"] == "assistant"
    assert messages[1]["status"] == "complete"
    assert messages[1]["provider"] == "ollama"
    assert len(messages[1]["content"]) > 0


@pytest.mark.skipif(not _ollama_available(), reason="Ollama is not running locally")
def test_stream_persists_context_refs_on_user_message(client: TestClient) -> None:
    created = _create_conversation(client)

    with client.stream(
        "POST",
        f"/ai/conversations/{created['id']}/messages/stream",
        json={
            "content": "What does this function do?",
            "provider": "ollama",
            "model": OLLAMA_MODEL,
            "context_refs": [
                {
                    "path": "src/example.ts",
                    "content": "function add(a: number, b: number) { return a + b; }",
                    "start_line": 1,
                    "end_line": 1,
                }
            ],
        },
    ) as response:
        for _ in response.iter_lines():
            pass  # drain the stream

    messages = client.get(f"/ai/conversations/{created['id']}/messages").json()
    user_message = messages[0]
    assert user_message["context_refs"] == [
        {"path": "src/example.ts", "start_line": 1, "end_line": 1}
    ]
    # The provider-facing content is not what's persisted for the user
    # message — only the original text is, so history renders naturally.
    assert user_message["content"] == "What does this function do?"


def test_json_roundtrip_sanity(client: TestClient) -> None:
    # Guards against `_sse` ever producing invalid JSON payloads.
    created = _create_conversation(client, provider="openai", model="gpt-4o-mini")
    with client.stream(
        "POST",
        f"/ai/conversations/{created['id']}/messages/stream",
        json={"content": "hi", "provider": "openai", "model": "gpt-4o-mini"},
    ) as response:
        for line in response.iter_lines():
            if line.startswith("data:"):
                json.loads(line[len("data:") :])
