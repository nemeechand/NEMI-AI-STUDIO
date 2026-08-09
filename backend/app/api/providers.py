from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from app.ai.providers.ollama_provider import (
    delete_model as ollama_delete_model,
)
from app.ai.providers.ollama_provider import (
    is_ollama_installed,
    is_server_running,
    resolve_host,
)
from app.ai.providers.ollama_provider import (
    list_local_models as ollama_list_models,
)
from app.ai.providers.ollama_provider import (
    pull_model as ollama_pull_model,
)
from app.ai.registry import get_provider, list_providers
from app.api.schemas import (
    AgentProviderDefaultOut,
    AgentProviderDefaultSet,
    ConnectionTestOut,
    ConnectionTestRequest,
    ModelFavoriteToggle,
    OllamaModelOut,
    OllamaPullRequest,
    OllamaStatusOut,
    ProviderDashboardEntry,
    ProviderSettingsOut,
    ProviderSettingsUpdate,
)
from app.core.config import get_settings
from app.db.connection import get_connection
from app.db.repositories.agent_provider_defaults_repository import (
    AGENT_ROLES,
    AgentProviderDefaultsRepository,
)
from app.db.repositories.model_favorites_repository import ModelFavoritesRepository
from app.db.repositories.provider_settings_repository import ProviderSettingsRepository
from app.db.repositories.stats_repository import StatsRepository

router = APIRouter(prefix="/providers")


def _settings_to_out(row: dict[str, Any] | None, provider_id: str) -> ProviderSettingsOut:
    if row is None:
        return ProviderSettingsOut(provider_id=provider_id, enabled=True)
    return ProviderSettingsOut(
        provider_id=row["provider_id"],
        enabled=bool(row["enabled"]),
        base_url=row["base_url"],
        default_model=row["default_model"],
        last_used_model=row["last_used_model"],
        last_used_at=row["last_used_at"],
        last_connection_status=row["last_connection_status"],
        last_connection_message=row["last_connection_message"],
        last_connection_at=row["last_connection_at"],
    )


@router.get("/settings", response_model=list[ProviderSettingsOut])
def list_provider_settings() -> list[ProviderSettingsOut]:
    settings = get_settings()
    with get_connection(settings) as connection:
        repo = ProviderSettingsRepository(connection)
        rows = {row["provider_id"]: row for row in repo.list_all()}
        return [_settings_to_out(rows.get(p.id), p.id) for p in list_providers()]


@router.get("/{provider_id}/settings", response_model=ProviderSettingsOut)
def get_provider_settings(provider_id: str) -> ProviderSettingsOut:
    get_provider(provider_id)  # raises UnknownProviderError (-> 400) if invalid
    settings = get_settings()
    with get_connection(settings) as connection:
        row = ProviderSettingsRepository(connection).get(provider_id)
        return _settings_to_out(row, provider_id)


@router.put("/{provider_id}/settings", response_model=ProviderSettingsOut)
def update_provider_settings(
    provider_id: str, payload: ProviderSettingsUpdate
) -> ProviderSettingsOut:
    get_provider(provider_id)
    settings = get_settings()
    with get_connection(settings) as connection:
        row = ProviderSettingsRepository(connection).upsert(
            provider_id,
            enabled=payload.enabled,
            base_url=payload.base_url,
            default_model=payload.default_model,
        )
        return _settings_to_out(row, provider_id)


@router.post("/{provider_id}/test-connection", response_model=ConnectionTestOut)
async def test_connection(provider_id: str, payload: ConnectionTestRequest) -> ConnectionTestOut:
    provider = get_provider(provider_id)
    result = await provider.test_connection(api_key=payload.api_key, base_url=payload.base_url)
    settings = get_settings()
    with get_connection(settings) as connection:
        ProviderSettingsRepository(connection).record_connection_test(
            provider_id, ok=result.ok, message=result.message
        )
    return ConnectionTestOut(ok=result.ok, message=result.message)


@router.post("/{provider_id}/models", response_model=list[str])
async def refresh_provider_models(provider_id: str, payload: ConnectionTestRequest) -> list[str]:
    """Real live model catalog (see AIProvider.list_models) — empty for a
    provider whose SDK can't enumerate models (e.g. Ollama, which is
    listed separately via /providers/ollama/status) rather than a guess."""
    provider = get_provider(provider_id)
    return await provider.list_models(api_key=payload.api_key, base_url=payload.base_url)


@router.get("/{provider_id}/favorites", response_model=list[str])
def list_favorites(provider_id: str) -> list[str]:
    settings = get_settings()
    with get_connection(settings) as connection:
        return ModelFavoritesRepository(connection).list_for_provider(provider_id)


@router.put("/{provider_id}/favorites")
def set_favorite(provider_id: str, payload: ModelFavoriteToggle) -> dict[str, list[str]]:
    settings = get_settings()
    with get_connection(settings) as connection:
        repo = ModelFavoritesRepository(connection)
        if payload.favorite:
            repo.add(provider_id, payload.model_id)
        else:
            repo.remove(provider_id, payload.model_id)
        return {"favorites": repo.list_for_provider(provider_id)}


@router.get("/dashboard", response_model=list[ProviderDashboardEntry])
def provider_dashboard() -> list[ProviderDashboardEntry]:
    """Aggregates real, already-persisted data only: provider_settings for
    configuration/last-connection state, and StatsRepository's real
    ai_messages aggregates for requests/tokens/cost/errors/latency.
    Whether a provider's API key is actually configured is a renderer-side
    (Electron safeStorage) fact the backend never sees — `configured` is
    reported by the caller via query, not guessed here (see providers-client.ts).
    """
    settings = get_settings()
    with get_connection(settings) as connection:
        settings_rows = {
            row["provider_id"]: row for row in ProviderSettingsRepository(connection).list_all()
        }
        usage_by_provider = StatsRepository(connection).provider_dashboard()

        entries: list[ProviderDashboardEntry] = []
        for p in list_providers():
            row = settings_rows.get(p.id)
            usage = usage_by_provider.get(
                p.id,
                {
                    "requests": 0,
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "estimated_cost_usd": 0.0,
                    "errors": 0,
                    "avg_latency_ms": None,
                },
            )
            entries.append(
                ProviderDashboardEntry(
                    provider_id=p.id,
                    display_name=p.display_name,
                    enabled=bool(row["enabled"]) if row else True,
                    requires_api_key=p.requires_api_key,
                    configured=not p.requires_api_key,
                    default_model=row["default_model"] if row else None,
                    last_used_model=row["last_used_model"] if row else None,
                    last_used_at=row["last_used_at"] if row else None,
                    last_connection_status=row["last_connection_status"] if row else "untested",
                    last_connection_message=row["last_connection_message"] if row else None,
                    requests=usage["requests"],
                    prompt_tokens=usage["prompt_tokens"],
                    completion_tokens=usage["completion_tokens"],
                    estimated_cost_usd=usage["estimated_cost_usd"],
                    avg_latency_ms=usage["avg_latency_ms"],
                    errors=usage["errors"],
                )
            )
        return entries


# --- Ollama management ---


@router.get("/ollama/status", response_model=OllamaStatusOut)
async def ollama_status(base_url: str | None = None) -> OllamaStatusOut:
    installed = is_ollama_installed()
    running = await is_server_running(base_url)
    models: list[OllamaModelOut] = []
    if running:
        local_models = await ollama_list_models(base_url)
        models = [
            OllamaModelOut(name=m.name, size_bytes=m.size_bytes, modified_at=m.modified_at)
            for m in local_models
        ]
    return OllamaStatusOut(
        installed=installed, server_running=running, host=resolve_host(base_url), models=models
    )


@router.post("/ollama/pull")
async def pull_ollama_model(payload: OllamaPullRequest) -> dict[str, Any]:
    """Non-streaming pull: waits for Ollama's own pull to finish and
    returns its final real status line. (Progress streaming lives on the
    dedicated SSE endpoint below for the UI's live progress bar.)"""
    last_status: dict[str, Any] = {}
    async for event in ollama_pull_model(payload.model, payload.base_url):
        last_status = event
    return last_status


@router.delete("/ollama/models/{model_name}")
async def delete_ollama_model(model_name: str, base_url: str | None = None) -> dict[str, str]:
    await ollama_delete_model(model_name, base_url)
    return {"status": "deleted", "model": model_name}


# --- Agent-role provider defaults ---


@router.get("/agent-defaults", response_model=list[AgentProviderDefaultOut])
def list_agent_defaults() -> list[AgentProviderDefaultOut]:
    settings = get_settings()
    with get_connection(settings) as connection:
        rows = AgentProviderDefaultsRepository(connection).list_all()
        return [
            AgentProviderDefaultOut(
                agent_role=row["agent_role"],
                provider=row["provider"],
                model=row["model"],
                updated_at=row["updated_at"],
            )
            for row in rows.values()
        ]


@router.put("/agent-defaults/{agent_role}", response_model=AgentProviderDefaultOut)
def set_agent_default(agent_role: str, payload: AgentProviderDefaultSet) -> AgentProviderDefaultOut:
    if agent_role not in AGENT_ROLES:
        raise HTTPException(status_code=404, detail=f"Unknown agent role: '{agent_role}'")
    get_provider(payload.provider)
    settings = get_settings()
    with get_connection(settings) as connection:
        row = AgentProviderDefaultsRepository(connection).set(
            agent_role, provider=payload.provider, model=payload.model
        )
        return AgentProviderDefaultOut(
            agent_role=row["agent_role"],
            provider=row["provider"],
            model=row["model"],
            updated_at=row["updated_at"],
        )


@router.delete("/agent-defaults/{agent_role}")
def clear_agent_default(agent_role: str) -> dict[str, str]:
    if agent_role not in AGENT_ROLES:
        raise HTTPException(status_code=404, detail=f"Unknown agent role: '{agent_role}'")
    settings = get_settings()
    with get_connection(settings) as connection:
        AgentProviderDefaultsRepository(connection).clear(agent_role)
        return {"status": "cleared", "agent_role": agent_role}
