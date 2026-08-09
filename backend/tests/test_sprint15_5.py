from __future__ import annotations

import asyncio
import sqlite3
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.ai.providers.openai_compatible import CustomProvider, DeepSeekProvider, GrokProvider
from app.ai.registry import get_provider, list_providers
from app.core.config import Settings
from app.db.connection import get_connection
from app.db.repositories.agent_provider_defaults_repository import (
    AgentProviderDefaultsRepository,
)
from app.db.repositories.model_favorites_repository import ModelFavoritesRepository
from app.db.repositories.provider_settings_repository import ProviderSettingsRepository
from app.db.schema import init_db
from app.server import create_app


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(create_app()) as test_client:
        yield test_client


@pytest.fixture
def connection(isolated_settings: Settings) -> Iterator[sqlite3.Connection]:
    with get_connection(isolated_settings) as conn:
        init_db(conn)
        yield conn


# --- Registry: 7 providers ---------------------------------------------------


def test_registry_has_seven_providers() -> None:
    ids = {p.id for p in list_providers()}
    assert ids == {"openai", "anthropic", "gemini", "ollama", "deepseek", "grok", "custom"}


def test_openai_compatible_subclasses_have_distinct_display_names() -> None:
    assert DeepSeekProvider().display_name != GrokProvider().display_name
    assert get_provider("deepseek").default_base_url == "https://api.deepseek.com"  # type: ignore[attr-defined]
    assert get_provider("grok").default_base_url == "https://api.x.ai/v1"  # type: ignore[attr-defined]


def test_custom_provider_requires_base_url() -> None:
    provider = CustomProvider()
    assert provider.requires_base_url is True
    assert provider.default_base_url is None


def test_custom_provider_test_connection_fails_without_base_url() -> None:
    async def run() -> Any:
        provider = CustomProvider()
        return await provider.test_connection(api_key="sk-test", base_url=None)

    result = asyncio.run(run())
    assert result.ok is False
    assert "base url" in result.message.lower() or "base_url" in result.message.lower()


def test_test_connection_never_raises_without_api_key() -> None:
    async def run() -> None:
        for provider in list_providers():
            if not provider.requires_api_key:
                continue
            result = await provider.test_connection(api_key=None, base_url=None)
            assert result.ok is False

    asyncio.run(run())


# --- provider_settings repository -------------------------------------------


def test_provider_settings_defaults_to_none_until_written(connection: sqlite3.Connection) -> None:
    repo = ProviderSettingsRepository(connection)
    assert repo.get("openai") is None


def test_provider_settings_upsert_and_get(connection: sqlite3.Connection) -> None:
    repo = ProviderSettingsRepository(connection)
    row = repo.upsert(
        "openai", enabled=False, base_url="https://proxy.example.com", default_model="gpt-4o"
    )
    assert row["enabled"] == 0
    assert row["base_url"] == "https://proxy.example.com"
    assert row["default_model"] == "gpt-4o"

    fetched = repo.get("openai")
    assert fetched is not None
    assert fetched["default_model"] == "gpt-4o"


def test_provider_settings_record_connection_test(connection: sqlite3.Connection) -> None:
    repo = ProviderSettingsRepository(connection)
    row = repo.record_connection_test("anthropic", ok=True, message="Connected — 5 model(s).")
    assert row["last_connection_status"] == "ok"
    assert row["last_connection_message"] == "Connected — 5 model(s)."

    row = repo.record_connection_test("anthropic", ok=False, message="Authentication failed.")
    assert row["last_connection_status"] == "error"


def test_provider_settings_record_used(connection: sqlite3.Connection) -> None:
    repo = ProviderSettingsRepository(connection)
    repo.record_used("ollama", model="qwen2.5:0.5b")
    row = repo.get("ollama")
    assert row is not None
    assert row["last_used_model"] == "qwen2.5:0.5b"
    assert row["last_used_at"] is not None


# --- model_favorites repository ----------------------------------------------


def test_model_favorites_add_list_remove(connection: sqlite3.Connection) -> None:
    repo = ModelFavoritesRepository(connection)
    repo.add("openai", "gpt-4o")
    repo.add("openai", "gpt-4o-mini")
    assert repo.list_for_provider("openai") == ["gpt-4o", "gpt-4o-mini"]

    repo.remove("openai", "gpt-4o")
    assert repo.list_for_provider("openai") == ["gpt-4o-mini"]


def test_model_favorites_add_is_idempotent(connection: sqlite3.Connection) -> None:
    repo = ModelFavoritesRepository(connection)
    repo.add("openai", "gpt-4o")
    repo.add("openai", "gpt-4o")
    assert repo.list_for_provider("openai") == ["gpt-4o"]


# --- agent_provider_defaults repository --------------------------------------


def test_agent_provider_defaults_set_and_get(connection: sqlite3.Connection) -> None:
    repo = AgentProviderDefaultsRepository(connection)
    assert repo.get("planner") is None

    row = repo.set("planner", provider="anthropic", model="claude-sonnet-4-5")
    assert row["provider"] == "anthropic"
    assert row["model"] == "claude-sonnet-4-5"

    row = repo.set("planner", provider="openai", model="gpt-4o")
    assert repo.get("planner")["provider"] == "openai"  # type: ignore[index]


def test_agent_provider_defaults_clear(connection: sqlite3.Connection) -> None:
    repo = AgentProviderDefaultsRepository(connection)
    repo.set("developer", provider="ollama", model="qwen2.5:0.5b")
    repo.clear("developer")
    assert repo.get("developer") is None


# --- API endpoints -------------------------------------------------------------


def test_get_providers_reports_base_url_support(client: TestClient) -> None:
    response = client.get("/ai/providers")
    assert response.status_code == 200
    by_id = {p["id"]: p for p in response.json()}
    assert by_id["openai"]["supports_base_url"] is True
    assert by_id["ollama"]["requires_api_key"] is False


def test_provider_settings_endpoint_roundtrip(client: TestClient) -> None:
    response = client.put(
        "/providers/deepseek/settings",
        json={
            "enabled": True,
            "base_url": "https://api.deepseek.com",
            "default_model": "deepseek-chat",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["default_model"] == "deepseek-chat"

    response = client.get("/providers/deepseek/settings")
    assert response.status_code == 200
    assert response.json()["base_url"] == "https://api.deepseek.com"


def test_provider_settings_list_covers_all_providers(client: TestClient) -> None:
    response = client.get("/providers/settings")
    assert response.status_code == 200
    ids = {row["provider_id"] for row in response.json()}
    assert ids == {"openai", "anthropic", "gemini", "ollama", "deepseek", "grok", "custom"}


def test_test_connection_endpoint_reports_failure_without_key(client: TestClient) -> None:
    response = client.post("/providers/openai/test-connection", json={})
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False


def test_test_connection_unknown_provider_is_400(client: TestClient) -> None:
    response = client.post("/providers/not-a-real-provider/test-connection", json={})
    assert response.status_code == 400


def test_model_favorites_endpoint(client: TestClient) -> None:
    response = client.put(
        "/providers/openai/favorites", json={"model_id": "gpt-4o", "favorite": True}
    )
    assert response.status_code == 200
    assert response.json()["favorites"] == ["gpt-4o"]

    response = client.get("/providers/openai/favorites")
    assert response.json() == ["gpt-4o"]

    response = client.put(
        "/providers/openai/favorites", json={"model_id": "gpt-4o", "favorite": False}
    )
    assert response.json()["favorites"] == []


def test_agent_defaults_endpoint_roundtrip(client: TestClient) -> None:
    response = client.put(
        "/providers/agent-defaults/reviewer",
        json={"provider": "anthropic", "model": "claude-sonnet-4-5"},
    )
    assert response.status_code == 200
    assert response.json()["provider"] == "anthropic"

    response = client.get("/providers/agent-defaults")
    assert response.status_code == 200
    roles = {row["agent_role"] for row in response.json()}
    assert "reviewer" in roles

    response = client.delete("/providers/agent-defaults/reviewer")
    assert response.status_code == 200
    response = client.get("/providers/agent-defaults")
    roles = {row["agent_role"] for row in response.json()}
    assert "reviewer" not in roles


def test_agent_defaults_rejects_unknown_role(client: TestClient) -> None:
    response = client.put(
        "/providers/agent-defaults/not-a-role", json={"provider": "openai", "model": "gpt-4o"}
    )
    assert response.status_code == 404


def test_agent_defaults_rejects_unknown_provider(client: TestClient) -> None:
    response = client.put(
        "/providers/agent-defaults/planner", json={"provider": "not-a-provider", "model": "x"}
    )
    assert response.status_code == 400


def test_provider_dashboard_endpoint_returns_all_providers(client: TestClient) -> None:
    response = client.get("/providers/dashboard")
    assert response.status_code == 200
    body = response.json()
    ids = {row["provider_id"] for row in body}
    assert ids == {"openai", "anthropic", "gemini", "ollama", "deepseek", "grok", "custom"}
    for row in body:
        assert row["requests"] == 0
        assert row["errors"] == 0


def test_ollama_status_endpoint_never_raises(client: TestClient) -> None:
    # No real Ollama server is guaranteed to be running in CI/offline test
    # environments — the endpoint must degrade gracefully, not 500.
    response = client.get("/providers/ollama/status", params={"base_url": "http://127.0.0.1:1"})
    assert response.status_code == 200
    body = response.json()
    assert body["server_running"] is False
    assert body["models"] == []


def test_ollama_delete_missing_server_is_reported_as_error(client: TestClient) -> None:
    response = client.delete(
        "/providers/ollama/models/not-a-model", params={"base_url": "http://127.0.0.1:1"}
    )
    assert response.status_code == 400
