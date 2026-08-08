from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import uuid4

NodeType = Literal[
    "project", "file", "function", "class", "agent", "workflow", "commit", "user", "requirement"
]
Relationship = Literal[
    "contains", "defines", "imports", "modifies", "executed_by", "authored_by", "implements",
    "related_to",
]


class KnowledgeRepository:
    """Data access for `graph_nodes`/`graph_edges` — the knowledge graph.

    A node is uniquely identified by (project_id, node_type, label), so
    re-indexing is idempotent: `upsert_node` finds-or-creates rather than
    duplicating. `ref_id` optionally points at the real row backing the
    node (e.g. a `files.id`) so callers can join back to full detail;
    derived nodes with no single backing row (a git author, a workflow's
    goal-as-requirement) leave it null.
    """

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    def upsert_node(
        self,
        *,
        project_id: str | None,
        node_type: NodeType,
        label: str,
        ref_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        now = datetime.now(UTC).isoformat()
        existing = self._connection.execute(
            "SELECT id FROM graph_nodes WHERE project_id IS ? AND node_type = ? AND label = ?",
            (project_id, node_type, label),
        ).fetchone()
        metadata_json = json.dumps(metadata) if metadata is not None else None
        if existing:
            self._connection.execute(
                "UPDATE graph_nodes SET ref_id = ?, metadata = ?, updated_at = ? WHERE id = ?",
                (ref_id, metadata_json, now, existing["id"]),
            )
            node_id = existing["id"]
        else:
            node_id = str(uuid4())
            self._connection.execute(
                """
                INSERT INTO graph_nodes
                    (id, project_id, node_type, label, ref_id, metadata, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (node_id, project_id, node_type, label, ref_id, metadata_json, now, now),
            )
        return self.get_node(node_id)  # type: ignore[return-value]

    def get_node(self, node_id: str) -> dict[str, Any] | None:
        row = self._connection.execute(
            "SELECT * FROM graph_nodes WHERE id = ?", (node_id,)
        ).fetchone()
        return _node_dict(row) if row else None

    def find_node_by_ref(
        self, *, project_id: str | None, node_type: NodeType, ref_id: str
    ) -> dict[str, Any] | None:
        row = self._connection.execute(
            "SELECT * FROM graph_nodes WHERE project_id IS ? AND node_type = ? AND ref_id = ?",
            (project_id, node_type, ref_id),
        ).fetchone()
        return _node_dict(row) if row else None

    def find_node(
        self, *, project_id: str | None, node_type: NodeType, label: str
    ) -> dict[str, Any] | None:
        row = self._connection.execute(
            "SELECT * FROM graph_nodes WHERE project_id IS ? AND node_type = ? AND label = ?",
            (project_id, node_type, label),
        ).fetchone()
        return _node_dict(row) if row else None

    def add_edge(
        self,
        *,
        project_id: str | None,
        from_node_id: str,
        to_node_id: str,
        relationship: Relationship,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        existing = self._connection.execute(
            """
            SELECT id FROM graph_edges
            WHERE from_node_id = ? AND to_node_id = ? AND relationship = ?
            """,
            (from_node_id, to_node_id, relationship),
        ).fetchone()
        if existing:
            return self.get_edge(existing["id"])  # type: ignore[return-value]
        edge_id = str(uuid4())
        now = datetime.now(UTC).isoformat()
        self._connection.execute(
            """
            INSERT INTO graph_edges
                (id, project_id, from_node_id, to_node_id, relationship, metadata, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                edge_id,
                project_id,
                from_node_id,
                to_node_id,
                relationship,
                json.dumps(metadata) if metadata is not None else None,
                now,
            ),
        )
        return self.get_edge(edge_id)  # type: ignore[return-value]

    def get_edge(self, edge_id: str) -> dict[str, Any] | None:
        row = self._connection.execute(
            "SELECT * FROM graph_edges WHERE id = ?", (edge_id,)
        ).fetchone()
        return _edge_dict(row) if row else None

    def list_nodes(
        self, *, project_id: str | None, node_type: NodeType | None = None, limit: int = 1000
    ) -> list[dict[str, Any]]:
        if node_type:
            rows = self._connection.execute(
                """
                SELECT * FROM graph_nodes WHERE project_id IS ? AND node_type = ?
                ORDER BY label LIMIT ?
                """,
                (project_id, node_type, limit),
            ).fetchall()
        else:
            rows = self._connection.execute(
                "SELECT * FROM graph_nodes WHERE project_id IS ? ORDER BY node_type, label LIMIT ?",
                (project_id, limit),
            ).fetchall()
        return [_node_dict(r) for r in rows]

    def list_edges(self, *, project_id: str | None, limit: int = 2000) -> list[dict[str, Any]]:
        rows = self._connection.execute(
            "SELECT * FROM graph_edges WHERE project_id IS ? LIMIT ?", (project_id, limit)
        ).fetchall()
        return [_edge_dict(r) for r in rows]

    def edges_to(
        self, node_id: str, relationship: Relationship | None = None
    ) -> list[dict[str, Any]]:
        """Edges pointing AT `node_id` — e.g. "who imports this file"."""
        if relationship:
            rows = self._connection.execute(
                "SELECT * FROM graph_edges WHERE to_node_id = ? AND relationship = ?",
                (node_id, relationship),
            ).fetchall()
        else:
            rows = self._connection.execute(
                "SELECT * FROM graph_edges WHERE to_node_id = ?", (node_id,)
            ).fetchall()
        return [_edge_dict(r) for r in rows]

    def edges_from(
        self, node_id: str, relationship: Relationship | None = None
    ) -> list[dict[str, Any]]:
        if relationship:
            rows = self._connection.execute(
                "SELECT * FROM graph_edges WHERE from_node_id = ? AND relationship = ?",
                (node_id, relationship),
            ).fetchall()
        else:
            rows = self._connection.execute(
                "SELECT * FROM graph_edges WHERE from_node_id = ?", (node_id,)
            ).fetchall()
        return [_edge_dict(r) for r in rows]

    def stats(self, project_id: str | None) -> dict[str, Any]:
        node_rows = self._connection.execute(
            "SELECT node_type, COUNT(*) AS n FROM graph_nodes WHERE project_id IS ? "
            "GROUP BY node_type",
            (project_id,),
        ).fetchall()
        edge_count = self._connection.execute(
            "SELECT COUNT(*) AS n FROM graph_edges WHERE project_id IS ?", (project_id,)
        ).fetchone()["n"]
        return {
            "nodes_by_type": {row["node_type"]: row["n"] for row in node_rows},
            "total_nodes": sum(row["n"] for row in node_rows),
            "total_edges": edge_count,
        }

    def delete_nodes_not_in(self, *, project_id: str, node_type: NodeType, labels: set[str]) -> int:
        existing = self.list_nodes(project_id=project_id, node_type=node_type, limit=100_000)
        stale_ids = [n["id"] for n in existing if n["label"] not in labels]
        if not stale_ids:
            return 0
        placeholders = ",".join("?" * len(stale_ids))
        self._connection.execute(
            f"DELETE FROM graph_edges WHERE from_node_id IN ({placeholders}) "
            f"OR to_node_id IN ({placeholders})",
            stale_ids + stale_ids,
        )
        self._connection.execute(f"DELETE FROM graph_nodes WHERE id IN ({placeholders})", stale_ids)
        return len(stale_ids)


def _node_dict(row: sqlite3.Row) -> dict[str, Any]:
    data = dict(row)
    data["metadata"] = json.loads(data["metadata"]) if data.get("metadata") else None
    return data


def _edge_dict(row: sqlite3.Row) -> dict[str, Any]:
    data = dict(row)
    data["metadata"] = json.loads(data["metadata"]) if data.get("metadata") else None
    return data
