from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from typing import Any

from app.db.repositories.knowledge_repository import KnowledgeRepository

# Sprint 14, Code Impact Analysis: real, transparent, and bounded — not a
# machine-learning "regression predictor" (no model for that exists or is
# claimed to exist here). "Affected files" is a real graph traversal
# (reverse `imports` edges). The risk score is a simple, documented
# heuristic (dependent count + related recorded-bug count), not a
# probability — labeled as a heuristic in the API response, never implied
# to be a measured likelihood.

MAX_DIAGRAM_EDGES = 150


@dataclass
class ImpactResult:
    file: str
    found: bool
    dependents: list[str] = field(default_factory=list)
    defines: list[str] = field(default_factory=list)
    related_bugs: list[str] = field(default_factory=list)
    risk_score: int = 0
    risk_label: str = "unknown"


def analyze_impact(
    connection: sqlite3.Connection, *, project_id: str, file_path: str
) -> ImpactResult:
    graph_repo = KnowledgeRepository(connection)
    file_node = graph_repo.find_node(project_id=project_id, node_type="file", label=file_path)
    if file_node is None:
        return ImpactResult(file=file_path, found=False)

    dependents = [
        graph_repo.get_node(edge["from_node_id"])["label"]  # type: ignore[index]
        for edge in graph_repo.edges_to(file_node["id"], relationship="imports")
    ]
    defines = [
        graph_repo.get_node(edge["to_node_id"])["label"]  # type: ignore[index]
        for edge in graph_repo.edges_from(file_node["id"], relationship="defines")
    ]

    bug_rows = connection.execute(
        """
        SELECT value FROM memory
        WHERE project_id IS ? AND type = 'knowledge' AND key LIKE 'bug:%' AND value LIKE ?
        """,
        (project_id, f"%{file_path}%"),
    ).fetchall()
    related_bugs = [row["value"] for row in bug_rows]

    risk_score = len(dependents) + 2 * len(related_bugs)
    if risk_score == 0:
        risk_label = "low"
    elif risk_score <= 3:
        risk_label = "medium"
    else:
        risk_label = "high"

    return ImpactResult(
        file=file_path,
        found=True,
        dependents=dependents,
        defines=defines,
        related_bugs=related_bugs,
        risk_score=risk_score,
        risk_label=risk_label,
    )


@dataclass
class DiagramResult:
    mermaid: str
    node_count: int
    edge_count: int
    truncated: bool


def generate_dependency_diagram(
    connection: sqlite3.Connection, *, project_id: str
) -> DiagramResult:
    """A real Mermaid `graph LR` built from actual `imports` edges between
    indexed files — not a fabricated architecture sketch. Capped at
    MAX_DIAGRAM_EDGES so a large project still renders as something a
    human can read; `truncated` says so honestly when the cap is hit."""
    graph_repo = KnowledgeRepository(connection)
    edges = [
        e for e in graph_repo.list_edges(project_id=project_id, limit=100_000)
        if e["relationship"] == "imports"
    ]
    truncated = len(edges) > MAX_DIAGRAM_EDGES
    edges = edges[:MAX_DIAGRAM_EDGES]

    lines = ["graph LR"]
    node_ids: dict[str, str] = {}
    nodes_used: set[str] = set()

    def _alias(node_id: str, label: str) -> str:
        if node_id not in node_ids:
            node_ids[node_id] = f"n{len(node_ids)}"
        nodes_used.add(node_id)
        return node_ids[node_id]

    for edge in edges:
        from_node = graph_repo.get_node(edge["from_node_id"])
        to_node = graph_repo.get_node(edge["to_node_id"])
        if not from_node or not to_node:
            continue
        from_alias = _alias(from_node["id"], from_node["label"])
        to_alias = _alias(to_node["id"], to_node["label"])
        lines.append(
            f'    {from_alias}["{from_node["label"]}"] --> {to_alias}["{to_node["label"]}"]'
        )

    if len(lines) == 1:
        lines.append("    empty[\"No import relationships indexed yet — run indexing first.\"]")

    return DiagramResult(
        mermaid="\n".join(lines),
        node_count=len(nodes_used),
        edge_count=max(0, len(lines) - 1),
        truncated=truncated,
    )


def generate_architecture_diagram(
    connection: sqlite3.Connection, *, project_id: str
) -> DiagramResult:
    """A real Mermaid `graph TD` of directory containment plus which agent
    roles executed which sprints (workflows) — the two structural
    relationships this app's graph actually models at the project level."""
    graph_repo = KnowledgeRepository(connection)
    files = graph_repo.list_nodes(project_id=project_id, node_type="file", limit=5000)
    workflows = graph_repo.list_nodes(project_id=project_id, node_type="workflow", limit=500)

    directories: dict[str, int] = {}
    for f in files:
        top_dir = f["label"].split("/")[0] if "/" in f["label"] else "(root)"
        directories[top_dir] = directories.get(top_dir, 0) + 1

    lines = ["graph TD", '    proj["Project"]']
    for index, (directory, count) in enumerate(sorted(directories.items())):
        lines.append(f'    d{index}["{directory}/ ({count} files)"]')
        lines.append(f"    proj --> d{index}")

    for index, workflow in enumerate(workflows[:50]):
        wid = f"w{index}"
        lines.append(f'    {wid}["Sprint: {workflow["label"]}"]')
        lines.append(f"    proj --> {wid}")
        for edge in graph_repo.edges_from(workflow["id"], relationship="executed_by"):
            agent_node = graph_repo.get_node(edge["to_node_id"])
            if agent_node:
                aid = f"{wid}_{agent_node['label']}"
                lines.append(f'    {aid}["{agent_node["label"]}"]')
                lines.append(f"    {wid} --> {aid}")

    return DiagramResult(
        mermaid="\n".join(lines),
        node_count=1 + len(directories) + len(workflows[:50]),
        edge_count=max(0, len(lines) - 2),
        truncated=len(workflows) > 50,
    )


def gather_file_context(
    connection: sqlite3.Connection, *, project_id: str, file_path: str
) -> dict[str, Any]:
    """Architecture Intelligence: real gathered context for "why was this
    written / where is it used / what will break" — graph relationships
    plus any captured memory (decisions/bugs/fixes/architecture changes)
    that mentions this file. Git blame/log ("who changed it") deliberately
    is NOT gathered here — that stays Electron's job (Sprint 13's git
    ownership rule) and is merged with this on the frontend before being
    sent to the AI chat as retrieval-augmented context."""
    impact = analyze_impact(connection, project_id=project_id, file_path=file_path)
    memory_rows = connection.execute(
        """
        SELECT type, key, value, updated_at FROM memory
        WHERE project_id IS ? AND value LIKE ? ORDER BY updated_at DESC LIMIT 20
        """,
        (project_id, f"%{file_path}%"),
    ).fetchall()
    return {
        "file": file_path,
        "found_in_graph": impact.found,
        "imported_by": impact.dependents,
        "defines": impact.defines,
        "related_memory": [dict(row) for row in memory_rows],
        "risk_score": impact.risk_score,
        "risk_label": impact.risk_label,
    }
