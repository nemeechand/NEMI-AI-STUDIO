from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.ai.embeddings import list_embedding_providers
from app.ai.errors import ProviderError
from app.api.schemas import (
    DiagramOut,
    EmbeddingProviderOut,
    FileContextOut,
    ImpactOut,
    KnowledgeEmbedRequest,
    KnowledgeEmbedResult,
    KnowledgeGraphOut,
    KnowledgeIndexRequest,
    KnowledgeIndexResult,
    KnowledgeSearchRequest,
    KnowledgeSearchResult,
    KnowledgeStatsOut,
    MemoryEntryOut,
)
from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.connection import get_connection
from app.db.repositories.embeddings_repository import EmbeddingsRepository
from app.db.repositories.files_repository import FilesRepository
from app.db.repositories.knowledge_repository import KnowledgeRepository
from app.db.repositories.memory_repository import MemoryRepository
from app.knowledge.analysis import (
    analyze_impact,
    gather_file_context,
    generate_architecture_diagram,
    generate_dependency_diagram,
)
from app.knowledge.indexer import index_project
from app.knowledge.semantic import keyword_search, run_embedding_pass, semantic_search

router = APIRouter(prefix="/knowledge")
logger = get_logger("api.knowledge")


@router.post("/index", response_model=KnowledgeIndexResult)
def trigger_index(payload: KnowledgeIndexRequest) -> dict[str, Any]:
    settings = get_settings()
    with get_connection(settings) as connection:
        summary = index_project(
            connection,
            project_id=payload.project_id,
            project_path=payload.project_path,
            commits=[c.model_dump() for c in payload.commits],
        )
    return {
        "files_indexed": summary.files_indexed,
        "files_removed": summary.files_removed,
        "functions_found": summary.functions_found,
        "classes_found": summary.classes_found,
        "edges_created": summary.edges_created,
        "commits_indexed": summary.commits_indexed,
        "truncated": summary.truncated,
        "duration_ms": summary.duration_ms,
        "errors": summary.errors,
    }


@router.get("/graph", response_model=KnowledgeGraphOut)
def get_graph(project_id: str = Query(...)) -> dict[str, Any]:
    settings = get_settings()
    with get_connection(settings) as connection:
        graph_repo = KnowledgeRepository(connection)
        return {
            "nodes": graph_repo.list_nodes(project_id=project_id, limit=1000),
            "edges": graph_repo.list_edges(project_id=project_id, limit=2000),
        }


@router.get("/stats", response_model=KnowledgeStatsOut)
def get_stats(project_id: str = Query(...)) -> dict[str, Any]:
    settings = get_settings()
    with get_connection(settings) as connection:
        graph_stats = KnowledgeRepository(connection).stats(project_id)
        files_indexed = len(FilesRepository(connection).list_for_project(project_id))
        embeddings_count = EmbeddingsRepository(connection).count_for_project(project_id)
    return {**graph_stats, "files_indexed": files_indexed, "embeddings_count": embeddings_count}


@router.get("/embedding-providers", response_model=list[EmbeddingProviderOut])
def get_embedding_providers() -> list[dict[str, Any]]:
    return [
        {
            "id": p.id,
            "display_name": p.display_name,
            "requires_api_key": p.requires_api_key,
            "default_model": p.default_model,
        }
        for p in list_embedding_providers()
    ]


@router.post("/embed", response_model=KnowledgeEmbedResult)
async def trigger_embed(payload: KnowledgeEmbedRequest) -> dict[str, Any]:
    settings = get_settings()
    with get_connection(settings) as connection:
        try:
            result = await run_embedding_pass(
                connection,
                project_id=payload.project_id,
                project_path=payload.project_path,
                provider_id=payload.provider,
                model=payload.model,
                api_key=payload.api_key,
            )
        except ProviderError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "embedded": result.embedded,
        "skipped_unchanged": result.skipped_unchanged,
        "failed": result.failed,
        "provider": result.provider,
        "model": result.model,
    }


@router.post("/search", response_model=KnowledgeSearchResult)
async def search(payload: KnowledgeSearchRequest) -> dict[str, Any]:
    """Real semantic search when a provider/model/key is supplied AND the
    project has embeddings for that exact provider+model combo; an honest
    keyword fallback otherwise — see app/knowledge/semantic.py. Never
    silently returns semantic-looking results it didn't actually compute.
    """
    settings = get_settings()
    fallback_reason: str | None = None
    if not payload.provider or not payload.model:
        fallback_reason = "No embedding provider selected."
    with get_connection(settings) as connection:
        if fallback_reason is None:
            try:
                hits = await semantic_search(
                    connection,
                    project_id=payload.project_id,
                    query=payload.query,
                    provider_id=payload.provider,  # type: ignore[arg-type]
                    model=payload.model,  # type: ignore[arg-type]
                    api_key=payload.api_key,
                )
                if not hits:
                    fallback_reason = (
                        "No embeddings found for this provider/model yet — run "
                        "'Generate Embeddings' first."
                    )
            except ProviderError as exc:
                fallback_reason = str(exc)
        if fallback_reason is not None:
            hits = keyword_search(connection, project_id=payload.project_id, query=payload.query)
            return {
                "mode": "keyword_fallback",
                "fallback_reason": fallback_reason,
                "hits": [h.__dict__ for h in hits],
            }
    return {"mode": "semantic", "fallback_reason": None, "hits": [h.__dict__ for h in hits]}


@router.get("/impact", response_model=ImpactOut)
def get_impact(project_id: str = Query(...), file: str = Query(...)) -> dict[str, Any]:
    settings = get_settings()
    with get_connection(settings) as connection:
        result = analyze_impact(connection, project_id=project_id, file_path=file)
    return result.__dict__


@router.get("/context", response_model=FileContextOut)
def get_context(project_id: str = Query(...), file: str = Query(...)) -> dict[str, Any]:
    settings = get_settings()
    with get_connection(settings) as connection:
        return gather_file_context(connection, project_id=project_id, file_path=file)


@router.get("/diagram", response_model=DiagramOut)
def get_diagram(
    project_id: str = Query(...), diagram_type: str = Query(default="dependency", alias="type")
) -> dict[str, Any]:
    settings = get_settings()
    with get_connection(settings) as connection:
        if diagram_type == "architecture":
            result = generate_architecture_diagram(connection, project_id=project_id)
        else:
            result = generate_dependency_diagram(connection, project_id=project_id)
    return result.__dict__


@router.get("/memory", response_model=list[MemoryEntryOut])
def list_memory(
    project_id: str | None = Query(default=None),
    memory_type: str = Query(default="knowledge", alias="type"),
) -> list[dict[str, Any]]:
    settings = get_settings()
    with get_connection(settings) as connection:
        return MemoryRepository(connection).list_by_type(
            project_id=project_id,
            type=memory_type,  # type: ignore[arg-type]
        )
