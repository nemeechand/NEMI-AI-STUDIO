from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.ai.cli_tools import detect_all, is_available
from app.ai.orchestration.task_router import resolve_execution
from app.api.schemas import (
    CliToolStatusOut,
    ExecutionDecisionOut,
    ExecutionPolicyOut,
    ExecutionPolicyUpdate,
    ResolveExecutionRequest,
)
from app.core.config import get_settings
from app.db.connection import get_connection
from app.db.repositories.execution_policy_repository import ExecutionPolicyRepository

router = APIRouter(prefix="/cli-tools")


@router.get("/status", response_model=list[CliToolStatusOut])
async def get_status() -> list[dict[str, Any]]:
    """Live detection every call — installed/authenticated state can
    change between polls (the user runs `claude login` in a terminal
    while NEMI is open), and this is cheap (a PATH lookup, a `--version`
    call, a file-existence check; never a network call, never anything
    that could consume paid API credits)."""
    statuses = await detect_all()
    return [
        {
            "id": s.id,
            "display_name": s.display_name,
            "installed": s.installed,
            "binary_path": s.binary_path,
            "version": s.version,
            "authenticated": s.authenticated,
            "available": is_available(s),
            "roles": list(s.roles),
            "role_note": s.role_note,
        }
        for s in statuses
    ]


@router.get("/execution-policy", response_model=ExecutionPolicyOut)
def get_execution_policy() -> dict[str, Any]:
    settings = get_settings()
    with get_connection(settings) as connection:
        return ExecutionPolicyRepository(connection).get()


@router.put("/execution-policy", response_model=ExecutionPolicyOut)
def update_execution_policy(payload: ExecutionPolicyUpdate) -> dict[str, Any]:
    settings = get_settings()
    with get_connection(settings) as connection:
        return ExecutionPolicyRepository(connection).upsert(
            mode=payload.mode, subscription_first=payload.subscription_first
        )


@router.post("/resolve", response_model=ExecutionDecisionOut)
async def resolve(payload: ResolveExecutionRequest) -> dict[str, Any]:
    """What the Task Router would actually pick right now for this role —
    used both by Electron before dispatching a real task, and by the "AI
    Coding Control" UI to preview what Auto mode will do."""
    settings = get_settings()
    statuses = await detect_all()
    cli_statuses = {s.id: s for s in statuses}
    with get_connection(settings) as connection:
        policy = ExecutionPolicyRepository(connection).get()
    decision = resolve_execution(
        role=payload.role,
        mode=policy["mode"],
        subscription_first=policy["subscription_first"],
        cli_statuses=cli_statuses,
        api_provider_configured=payload.api_provider_configured,
        api_provider_id=payload.api_provider_id,
        api_provider_display_name=payload.api_provider_display_name,
    )
    return {
        "available": decision.available,
        "backend": decision.backend,
        "execution_id": decision.execution_id,
        "display_name": decision.display_name,
        "fallback_used": decision.fallback_used,
        "reason": decision.reason,
    }
