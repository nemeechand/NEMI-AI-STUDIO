from __future__ import annotations

import hashlib
import math
import sqlite3
from dataclasses import dataclass
from pathlib import Path

from app.ai.embeddings import get_embedding_provider
from app.db.repositories.embeddings_repository import EmbeddingsRepository, EntityType
from app.db.repositories.files_repository import FilesRepository
from app.db.repositories.memory_repository import MemoryRepository
from app.db.repositories.workflows_repository import WorkflowsRepository
from app.knowledge.code_parser import is_parseable

# Sprint 14: real semantic search — an actual embedding-model call, real
# cosine similarity, no simulated "understanding". Kept honest about its
# two hard requirements: (1) an embedding-capable provider + key, and (2)
# at least one prior `POST /knowledge/embed` run for the project. Neither
# is assumed silently; `search()` reports which mode it actually used.

MAX_TEXT_CHARS = 4000
# Smaller than a cloud API could comfortably take in one call, but a local
# CPU-bound model (Ollama) embedding a batch of ~4000-char texts genuinely
# needs the room — keeps each individual provider call finishing within its
# own timeout even on modest hardware, at the cost of more total requests.
EMBED_BATCH_SIZE = 16
# A real project can have far more indexed files than is reasonable to
# embed in one bulk pass (this app's own ~500 eligible files would take
# well over half an hour on a local CPU model) — capped, deterministically
# (alphabetical, so re-running is stable and the content-hash skip above
# keeps repeat runs cheap), rather than left unbounded. Memory and workflow
# candidates are NOT capped: they're the highest-value, lowest-volume part
# of "what should this app remember", and typically number in the tens.
MAX_FILE_EMBED_CANDIDATES = 150
_EMBEDDABLE_LANGUAGES = {"python", "javascript", "typescript", "markdown", "json", "yaml"}


@dataclass
class EmbedCandidate:
    entity_type: EntityType
    entity_id: str
    text: str
    content_hash: str


def _hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def gather_candidates(
    connection: sqlite3.Connection, *, project_id: str, project_path: str
) -> list[EmbedCandidate]:
    """Everything in this project currently eligible to be embedded — real
    file contents (capped, code/doc files only), real captured memory
    entries (decisions/bugs/fixes/sprint summaries), real workflow goals.
    """
    candidates: list[EmbedCandidate] = []
    root = Path(project_path)

    file_candidates_used = 0
    for file_row in FilesRepository(connection).list_for_project(project_id):
        if file_candidates_used >= MAX_FILE_EMBED_CANDIDATES:
            break
        language = file_row["language"]
        if language not in _EMBEDDABLE_LANGUAGES and not is_parseable(language):
            continue
        try:
            content = (root / file_row["relative_path"]).read_text(
                encoding="utf-8", errors="strict"
            )[:MAX_TEXT_CHARS]
        except (OSError, UnicodeDecodeError):
            continue
        text = f"File: {file_row['relative_path']}\nLanguage: {language}\n\n{content}"
        candidates.append(EmbedCandidate("file", file_row["id"], text, _hash(text)))
        file_candidates_used += 1

    memory_repo = MemoryRepository(connection)
    for mem_type in ("knowledge", "long_term"):
        for entry in memory_repo.list_by_type(project_id=project_id, type=mem_type):
            text = entry["value"][:MAX_TEXT_CHARS]
            candidates.append(EmbedCandidate("memory", entry["id"], text, _hash(text)))

    for workflow in WorkflowsRepository(connection).list_for_project(project_id):
        text = f"{workflow['title']}\n\n{workflow['goal']}"[:MAX_TEXT_CHARS]
        candidates.append(EmbedCandidate("workflow", workflow["id"], text, _hash(text)))

    return candidates


@dataclass
class EmbedRunResult:
    embedded: int = 0
    skipped_unchanged: int = 0
    failed: int = 0
    provider: str = ""
    model: str = ""


async def run_embedding_pass(
    connection: sqlite3.Connection,
    *,
    project_id: str,
    project_path: str,
    provider_id: str,
    model: str,
    api_key: str | None,
) -> EmbedRunResult:
    provider = get_embedding_provider(provider_id)
    repo = EmbeddingsRepository(connection)
    candidates = gather_candidates(connection, project_id=project_id, project_path=project_path)

    result = EmbedRunResult(provider=provider_id, model=model)
    pending: list[EmbedCandidate] = []
    for candidate in candidates:
        existing = repo.get(
            project_id=project_id, entity_type=candidate.entity_type,
            entity_id=candidate.entity_id,
        )
        already_current = (
            existing is not None
            and existing["content_hash"] == candidate.content_hash
            and existing["model"] == model
        )
        if already_current:
            result.skipped_unchanged += 1
            continue
        pending.append(candidate)

    for start in range(0, len(pending), EMBED_BATCH_SIZE):
        batch = pending[start : start + EMBED_BATCH_SIZE]
        try:
            vectors = await provider.embed(
                texts=[c.text for c in batch], model=model, api_key=api_key
            )
        except Exception:
            result.failed += len(batch)
            continue
        for candidate, vector in zip(batch, vectors, strict=False):
            if not vector:
                result.failed += 1
                continue
            repo.upsert(
                project_id=project_id,
                entity_type=candidate.entity_type,
                entity_id=candidate.entity_id,
                content_hash=candidate.content_hash,
                provider=provider_id,
                model=model,
                vector=vector,
                text_preview=candidate.text[:280],
            )
            result.embedded += 1
    connection.commit()
    return result


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    if len(a) != len(b) or not a:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


@dataclass
class SearchHit:
    entity_type: str
    entity_id: str
    score: float
    preview: str


async def semantic_search(
    connection: sqlite3.Connection,
    *,
    project_id: str,
    query: str,
    provider_id: str,
    model: str,
    api_key: str | None,
    limit: int = 10,
) -> list[SearchHit]:
    """Raises whatever ProviderError the embedding call raises (missing
    key, network, auth) — the caller (the API route) is responsible for
    catching that and falling back to keyword_search()."""
    provider = get_embedding_provider(provider_id)
    query_vector = (
        await provider.embed(texts=[query], model=model, api_key=api_key)
    )[0]
    rows = EmbeddingsRepository(connection).list_for_project(
        project_id=project_id, provider=provider_id, model=model
    )
    scored = [
        SearchHit(
            entity_type=row["entity_type"],
            entity_id=row["entity_id"],
            score=_cosine_similarity(query_vector, row["vector"]),
            preview=row["text_preview"] or "",
        )
        for row in rows
    ]
    scored.sort(key=lambda hit: hit.score, reverse=True)
    return scored[:limit]


def keyword_search(
    connection: sqlite3.Connection, *, project_id: str, query: str, limit: int = 10
) -> list[SearchHit]:
    """Honest fallback when no embedding provider/key is available, or no
    embeddings have been generated yet: a plain SQL LIKE scan across the
    same three entity kinds semantic search would otherwise cover. Not
    ranked by meaning — ranked by match count, clearly labeled by the
    caller as `mode: "keyword_fallback"`."""
    like = f"%{query}%"
    hits: list[SearchHit] = []

    for row in connection.execute(
        "SELECT id, value FROM memory WHERE project_id IS ? AND value LIKE ? LIMIT ?",
        (project_id, like, limit),
    ).fetchall():
        hits.append(SearchHit("memory", row["id"], 1.0, row["value"][:280]))

    for row in connection.execute(
        "SELECT id, relative_path FROM files WHERE project_id = ? AND relative_path LIKE ? LIMIT ?",
        (project_id, like, limit),
    ).fetchall():
        hits.append(SearchHit("file", row["id"], 1.0, row["relative_path"]))

    for row in connection.execute(
        """
        SELECT id, title, goal FROM workflows
        WHERE project_id IS ? AND (title LIKE ? OR goal LIKE ?) LIMIT ?
        """,
        (project_id, like, like, limit),
    ).fetchall():
        hits.append(SearchHit("workflow", row["id"], 1.0, f"{row['title']}: {row['goal'][:200]}"))

    return hits[:limit]
