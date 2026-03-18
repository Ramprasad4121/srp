"""
Security Reasoning Graph (SRG) — Phase 1

An in-memory directed graph that models smart-contract structure
for security analysis.

Node types : CONTRACT, FUNCTION, STATE
Edge types : CALLS, WRITES, READS, INHERITS
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Optional


# ────────────────────────── Enums ──────────────────────────────────────────

class NodeType(str, Enum):
    CONTRACT = "CONTRACT"
    FUNCTION = "FUNCTION"
    STATE    = "STATE"


class EdgeType(str, Enum):
    CALLS    = "CALLS"
    WRITES   = "WRITES"
    READS    = "READS"
    INHERITS = "INHERITS"


# ────────────────────────── Data Classes ──────────────────────────────────

@dataclass
class Node:
    id: str
    node_type: NodeType
    name: str
    metadata: dict = field(default_factory=dict)


@dataclass
class Edge:
    source: str          # node id
    target: str          # node id
    edge_type: EdgeType
    metadata: dict = field(default_factory=dict)


# ────────────────────────── Graph ─────────────────────────────────────────

class SecurityReasoningGraph:
    """Directed graph supporting traversal and relationship queries."""

    def __init__(self) -> None:
        self.nodes: dict[str, Node] = {}
        self.edges: list[Edge] = []
        self._adj: dict[str, list[Edge]] = {}   # forward adjacency
        self._radj: dict[str, list[Edge]] = {}   # reverse adjacency

    # ── Mutation ──────────────────────────────────────────────────────────

    def add_node(self, node: Node) -> None:
        self.nodes[node.id] = node
        self._adj.setdefault(node.id, [])
        self._radj.setdefault(node.id, [])

    def add_edge(self, edge: Edge) -> None:
        self.edges.append(edge)
        self._adj.setdefault(edge.source, []).append(edge)
        self._radj.setdefault(edge.target, []).append(edge)

    # ── Queries ───────────────────────────────────────────────────────────

    def successors(self, node_id: str, edge_type: Optional[EdgeType] = None) -> list[Node]:
        """Get all nodes reachable from *node_id* (one hop)."""
        edges = self._adj.get(node_id, [])
        if edge_type:
            edges = [e for e in edges if e.edge_type == edge_type]
        return [self.nodes[e.target] for e in edges if e.target in self.nodes]

    def predecessors(self, node_id: str, edge_type: Optional[EdgeType] = None) -> list[Node]:
        """Get all nodes that point *to* node_id (one hop)."""
        edges = self._radj.get(node_id, [])
        if edge_type:
            edges = [e for e in edges if e.edge_type == edge_type]
        return [self.nodes[e.source] for e in edges if e.source in self.nodes]

    def nodes_by_type(self, node_type: NodeType) -> list[Node]:
        return [n for n in self.nodes.values() if n.node_type == node_type]

    def edges_by_type(self, edge_type: EdgeType) -> list[Edge]:
        return [e for e in self.edges if e.edge_type == edge_type]

    def get_call_chain(self, start_id: str, depth: int = 5) -> list[list[str]]:
        """BFS traversal following CALLS edges, returns all paths up to *depth*."""
        paths: list[list[str]] = []
        queue: list[tuple[str, list[str]]] = [(start_id, [start_id])]
        while queue:
            current, path = queue.pop(0)
            if len(path) > depth:
                continue
            callees = self.successors(current, EdgeType.CALLS)
            if not callees:
                paths.append(path)
            for callee in callees:
                if callee.id not in path:  # prevent cycles
                    queue.append((callee.id, path + [callee.id]))
        return paths

    def find_state_writers(self, state_id: str) -> list[Node]:
        """Find all functions that WRITE to a specific state variable."""
        return self.predecessors(state_id, EdgeType.WRITES)

    def find_state_readers(self, state_id: str) -> list[Node]:
        """Find all functions that READ a specific state variable."""
        return self.predecessors(state_id, EdgeType.READS)

    # ── Serialization ─────────────────────────────────────────────────────

    def to_dict(self) -> dict:
        return {
            "nodes": [asdict(n) for n in self.nodes.values()],
            "edges": [asdict(e) for e in self.edges],
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, default=str)

    # ── Build from parser output ──────────────────────────────────────────

    @classmethod
    def from_parser_output(cls, parsed: dict) -> "SecurityReasoningGraph":
        """Construct the SRG from the JSON output of the SolidityParser."""
        g = cls()

        # Add contract nodes
        for c in parsed.get("contracts", []):
            g.add_node(Node(
                id=f"contract:{c['name']}",
                node_type=NodeType.CONTRACT,
                name=c["name"],
                metadata={"type": c.get("type"), "file": c.get("file"), "inherits": c.get("inherits", [])},
            ))

        # Add function nodes
        for f in parsed.get("functions", []):
            fid = f"function:{f['name']}"
            g.add_node(Node(
                id=fid,
                node_type=NodeType.FUNCTION,
                name=f["name"],
                metadata={"arguments": f.get("arguments"), "modifiers": f.get("modifiers"), "returns": f.get("returns"), "file": f.get("file")},
            ))

        # Add state variable nodes
        for sv in parsed.get("state_variables", []):
            sid = f"state:{sv['name']}"
            g.add_node(Node(
                id=sid,
                node_type=NodeType.STATE,
                name=sv["name"],
                metadata={"type": sv.get("type"), "visibility": sv.get("visibility"), "file": sv.get("file")},
            ))

        # Add inheritance edges from parser relationships
        for rel in parsed.get("relationships", []):
            if rel.get("type") == "INHERITS":
                g.add_edge(Edge(
                    source=f"contract:{rel['source']}",
                    target=f"contract:{rel['target']}",
                    edge_type=EdgeType.INHERITS,
                ))

        return g

    def __repr__(self) -> str:
        return f"<SRG nodes={len(self.nodes)} edges={len(self.edges)}>"


# ── CLI entry point ───────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent))
    from parser.solidity_parser import SolidityParser

    target = sys.argv[1] if len(sys.argv) > 1 else "."
    parser = SolidityParser(target)
    parsed = parser.parse_all()
    srg = SecurityReasoningGraph.from_parser_output(parsed)
    print(srg)
    print(srg.to_json())
