from __future__ import annotations

import posixpath
import sqlite3
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.db.repositories.files_repository import FilesRepository
from app.db.repositories.knowledge_repository import KnowledgeRepository
from app.knowledge.code_parser import is_parseable, language_for_path, parse_source

# Sprint 14: bounds on a single index run, so an unusually large project
# folder can't hang the backend or blow up the graph into something no
# dashboard could render. Mirrors the spirit of Sprint 9's MAX_LIST_ALL_FILES
# / MAX_SEARCH_RESULTS caps in the Electron filesystem layer, applied here
# because indexing runs backend-side (see the module docstring below for why).
MAX_FILES = 3000
MAX_PARSE_BYTES = 512_000  # 500 KB — larger files still get a `file` node, just no parsed symbols

IGNORED_NAMES = {
    "node_modules", ".git", "dist", "dist-electron", "__pycache__", ".venv", "venv",
    ".pytest_cache", ".ruff_cache", ".mypy_cache", "build", ".idea", ".vscode",
}

_JS_RESOLVE_EXTENSIONS = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs")


@dataclass
class IndexSummary:
    files_indexed: int = 0
    files_removed: int = 0
    functions_found: int = 0
    classes_found: int = 0
    edges_created: int = 0
    commits_indexed: int = 0
    truncated: bool = False
    duration_ms: int = 0
    errors: list[str] = field(default_factory=list)


def _walk_files(root: Path) -> list[Path]:
    results: list[Path] = []

    def _walk(directory: Path) -> None:
        if len(results) >= MAX_FILES:
            return
        try:
            entries = sorted(directory.iterdir())
        except OSError:
            return
        for entry in entries:
            if entry.name in IGNORED_NAMES:
                continue
            if entry.is_dir():
                _walk(entry)
            elif entry.is_file():
                results.append(entry)
            if len(results) >= MAX_FILES:
                return

    _walk(root)
    return results


def _read_text(path: Path, max_bytes: int) -> str | None:
    try:
        if path.stat().st_size > max_bytes:
            return None
        return path.read_text(encoding="utf-8", errors="strict")
    except (OSError, UnicodeDecodeError):
        return None


def _resolve_js_import(*, importer_relpath: str, spec: str, known_paths: set[str]) -> str | None:
    if not spec.startswith("."):
        return None  # external package (npm) — not modeled, see indexer module docstring
    importer_dir = posixpath.dirname(importer_relpath)
    candidate_base = posixpath.normpath(posixpath.join(importer_dir, spec))
    for suffix in ("", *_JS_RESOLVE_EXTENSIONS):
        candidate = f"{candidate_base}{suffix}"
        if candidate in known_paths:
            return candidate
    for ext in _JS_RESOLVE_EXTENSIONS:
        candidate = f"{candidate_base}/index{ext}"
        if candidate in known_paths:
            return candidate
    return None


def _resolve_python_import(*, spec: str, py_module_index: dict[str, str]) -> str | None:
    if spec in py_module_index:
        return py_module_index[spec]
    # Unambiguous suffix match (e.g. `schema` matching `app.db.schema`) —
    # only applied when exactly one candidate matches, to avoid a wrong link.
    suffix = f".{spec}"
    matches = [path for module, path in py_module_index.items() if module.endswith(suffix)]
    if len(matches) == 1:
        return matches[0]
    return None


def index_project(
    connection: sqlite3.Connection, *, project_id: str, project_path: str,
    commits: list[dict[str, Any]] | None = None,
) -> IndexSummary:
    """Builds the structural half of the knowledge graph — files, their
    heuristically-parsed functions/classes, and resolved same-project
    imports — plus commit/author nodes from the git history Electron
    already gathered (git operations stay Electron's, per Sprint 13's
    ownership rule; this function only records what it's given).

    Deliberately reads the project's files directly from disk (`project_path`,
    already the source of truth stored on the `projects` row) rather than
    round-tripping file contents through Electron IPC: this is read-only,
    non-interactive, batch analysis that feeds straight into SQLite — a
    data-layer concern, not the interactive CRUD/live-watch Sprint 5 scoped
    to Electron. See docs/ARCHITECTURE.md's KNOWLEDGE GRAPH ENGINE section.
    """
    start = time.monotonic()
    summary = IndexSummary()
    root = Path(project_path)
    if not root.is_dir():
        summary.errors.append(f"Project path does not exist or is not a directory: {project_path}")
        return summary

    files_repo = FilesRepository(connection)
    graph_repo = KnowledgeRepository(connection)

    all_paths = _walk_files(root)
    summary.truncated = len(all_paths) >= MAX_FILES

    project_node = graph_repo.upsert_node(
        project_id=project_id, node_type="project", label=project_id, ref_id=project_id
    )

    known_relpaths = {p.relative_to(root).as_posix() for p in all_paths}
    py_module_index: dict[str, str] = {}
    for relpath in known_relpaths:
        if relpath.endswith(".py"):
            dotted = relpath[: -len(".py")].replace("/", ".")
            if dotted.endswith(".__init__"):
                dotted = dotted[: -len(".__init__")]
            py_module_index[dotted] = relpath

    # Pass 1: file + function/class nodes (needs every file's node to exist
    # before pass 2 can create cross-file `imports` edges).
    parsed_by_path: dict[str, Any] = {}
    file_node_by_path: dict[str, dict[str, Any]] = {}
    for path in all_paths:
        relpath = path.relative_to(root).as_posix()
        language = language_for_path(relpath)
        files_repo.upsert(project_id=project_id, relative_path=relpath, language=language)
        file_node = graph_repo.upsert_node(
            project_id=project_id, node_type="file", label=relpath, ref_id=None,
            metadata={"language": language},
        )
        file_node_by_path[relpath] = file_node
        graph_repo.add_edge(
            project_id=project_id, from_node_id=project_node["id"], to_node_id=file_node["id"],
            relationship="contains",
        )
        summary.edges_created += 1
        summary.files_indexed += 1

        if not is_parseable(language):
            continue
        content = _read_text(path, MAX_PARSE_BYTES)
        if content is None:
            continue
        parsed = parse_source(content, language)  # type: ignore[arg-type]
        parsed_by_path[relpath] = parsed

        for symbol in parsed.functions:
            symbol_node = graph_repo.upsert_node(
                project_id=project_id, node_type="function", label=f"{relpath}::{symbol.name}",
            )
            graph_repo.add_edge(
                project_id=project_id, from_node_id=file_node["id"], to_node_id=symbol_node["id"],
                relationship="defines",
            )
            summary.functions_found += 1
            summary.edges_created += 1
        for symbol in parsed.classes:
            symbol_node = graph_repo.upsert_node(
                project_id=project_id, node_type="class", label=f"{relpath}::{symbol.name}",
            )
            graph_repo.add_edge(
                project_id=project_id, from_node_id=file_node["id"], to_node_id=symbol_node["id"],
                relationship="defines",
            )
            summary.classes_found += 1
            summary.edges_created += 1

    # Pass 2: resolve imports into `imports` edges between file nodes.
    for relpath, parsed in parsed_by_path.items():
        language = language_for_path(relpath)
        for spec in parsed.imports:
            resolved: str | None = None
            if language == "python":
                resolved = _resolve_python_import(spec=spec, py_module_index=py_module_index)
            elif language in ("javascript", "typescript"):
                resolved = _resolve_js_import(
                    importer_relpath=relpath, spec=spec, known_paths=known_relpaths
                )
            if resolved and resolved != relpath and resolved in file_node_by_path:
                graph_repo.add_edge(
                    project_id=project_id,
                    from_node_id=file_node_by_path[relpath]["id"],
                    to_node_id=file_node_by_path[resolved]["id"],
                    relationship="imports",
                )
                summary.edges_created += 1

    summary.files_removed = files_repo.delete_missing(project_id, known_relpaths)
    graph_repo.delete_nodes_not_in(project_id=project_id, node_type="file", labels=known_relpaths)

    # Commits + authors (git data supplied by the caller — see docstring).
    for commit in commits or []:
        commit_label = commit["hash"]
        commit_node = graph_repo.upsert_node(
            project_id=project_id, node_type="commit", label=commit_label,
            metadata={"message": commit.get("message"), "date": commit.get("date")},
        )
        author = commit.get("author")
        if author:
            author_node = graph_repo.upsert_node(
                project_id=project_id, node_type="user", label=author
            )
            graph_repo.add_edge(
                project_id=project_id, from_node_id=commit_node["id"], to_node_id=author_node["id"],
                relationship="authored_by",
            )
            summary.edges_created += 1
        for changed_path in commit.get("files", []):
            modified_file_node = file_node_by_path.get(changed_path)
            if modified_file_node:
                graph_repo.add_edge(
                    project_id=project_id, from_node_id=commit_node["id"],
                    to_node_id=modified_file_node["id"], relationship="modifies",
                )
                summary.edges_created += 1
        summary.commits_indexed += 1

    connection.commit()
    summary.duration_ms = int((time.monotonic() - start) * 1000)
    return summary
