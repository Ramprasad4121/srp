"""
Security Reasoning Graph (SRG) — Phase 1 (Upgraded)

An in-memory directed graph modelling smart-contract structure for
security analysis.  Built deterministically from parser output.

Node types : CONTRACT, FUNCTION, STATE
Edge types : CALLS, READS, WRITES, INHERITS, EXTERNAL_CALL, HAS_FUNCTION, HAS_STATE
"""

from __future__ import annotations

import json
from collections import deque
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Optional


# ────────────────────────── Enums ──────────────────────────────────────────

class NodeType(str, Enum):
    CONTRACT = "CONTRACT"
    FUNCTION = "FUNCTION"
    STATE    = "STATE"


class EdgeType(str, Enum):
    CALLS         = "CALLS"
    READS         = "READS"
    WRITES        = "WRITES"
    INHERITS      = "INHERITS"
    EXTERNAL_CALL = "EXTERNAL_CALL"
    HAS_FUNCTION  = "HAS_FUNCTION"
    HAS_STATE     = "HAS_STATE"


# ────────────────────────── Data Classes ──────────────────────────────────

@dataclass
class Node:
    id: str
    node_type: NodeType
    name: str
    metadata: dict = field(default_factory=dict)


@dataclass
class Edge:
    source: str
    target: str
    edge_type: EdgeType
    metadata: dict = field(default_factory=dict)


# ────────────────────────── Graph ─────────────────────────────────────────

class SecurityReasoningGraph:
    """Directed graph with traversal, queries, and helpers for security analysis."""

    def __init__(self) -> None:
        self.nodes: dict[str, Node] = {}
        self.edges: list[Edge] = []
        self._adj: dict[str, list[Edge]] = {}
        self._radj: dict[str, list[Edge]] = {}

    # ── Mutation ──────────────────────────────────────────────────────────

    def add_node(self, node: Node) -> None:
        self.nodes[node.id] = node
        self._adj.setdefault(node.id, [])
        self._radj.setdefault(node.id, [])

    def add_edge(self, edge: Edge) -> None:
        self.edges.append(edge)
        self._adj.setdefault(edge.source, []).append(edge)
        self._radj.setdefault(edge.target, []).append(edge)

    # ── Basic Queries ─────────────────────────────────────────────────────

    def successors(self, node_id: str, edge_type: Optional[EdgeType] = None) -> list[Node]:
        edges = self._adj.get(node_id, [])
        if edge_type:
            edges = [e for e in edges if e.edge_type == edge_type]
        return [self.nodes[e.target] for e in edges if e.target in self.nodes]

    def predecessors(self, node_id: str, edge_type: Optional[EdgeType] = None) -> list[Node]:
        edges = self._radj.get(node_id, [])
        if edge_type:
            edges = [e for e in edges if e.edge_type == edge_type]
        return [self.nodes[e.source] for e in edges if e.source in self.nodes]

    def nodes_by_type(self, node_type: NodeType | str) -> list[Node]:
        nt = NodeType(node_type) if isinstance(node_type, str) else node_type
        return [n for n in self.nodes.values() if n.node_type == nt]

    def edges_by_type(self, edge_type: EdgeType | str) -> list[Edge]:
        et = EdgeType(edge_type) if isinstance(edge_type, str) else edge_type
        return [e for e in self.edges if e.edge_type == et]

    # ── Helper Methods (requested) ────────────────────────────────────────

    def get_functions(self, contract_name: str) -> list[Node]:
        """Get all FUNCTION nodes belonging to a contract via HAS_FUNCTION edges."""
        cid = f"contract:{contract_name}"
        return self.successors(cid, EdgeType.HAS_FUNCTION)

    def get_called_functions(self, function_id: str) -> list[Node]:
        """Get all functions called by a given function."""
        return self.successors(function_id, EdgeType.CALLS)

    def get_state_dependencies(self, function_id: str) -> dict[str, list[Node]]:
        """Get state variables read and written by a function."""
        return {
            "reads": self.successors(function_id, EdgeType.READS),
            "writes": self.successors(function_id, EdgeType.WRITES),
        }

    def find_paths(self, start_id: str, end_id: str, max_depth: int = 8) -> list[list[str]]:
        """BFS to find all paths from start to end up to max_depth."""
        paths: list[list[str]] = []
        queue: deque[tuple[str, list[str]]] = deque([(start_id, [start_id])])
        while queue:
            current, path = queue.popleft()
            if len(path) > max_depth:
                continue
            if current == end_id and len(path) > 1:
                paths.append(path)
                continue
            for edge in self._adj.get(current, []):
                if edge.target not in path:
                    queue.append((edge.target, path + [edge.target]))
        return paths

    def get_call_chain(self, start_id: str, depth: int = 5) -> list[list[str]]:
        """BFS traversal following CALLS edges, returns all paths up to depth."""
        paths: list[list[str]] = []
        queue: deque[tuple[str, list[str]]] = deque([(start_id, [start_id])])
        while queue:
            current, path = queue.popleft()
            if len(path) > depth:
                continue
            callees = self.successors(current, EdgeType.CALLS)
            if not callees:
                paths.append(path)
            for callee in callees:
                if callee.id not in path:
                    queue.append((callee.id, path + [callee.id]))
        return paths

    def find_state_writers(self, state_id: str) -> list[Node]:
        return self.predecessors(state_id, EdgeType.WRITES)

    def find_state_readers(self, state_id: str) -> list[Node]:
        return self.predecessors(state_id, EdgeType.READS)

    def get_sensitive_functions(self) -> list[Node]:
        """Find functions that match a specific behavior profile (writes + external calls)."""
        results = []
        for node in self.nodes_by_type(NodeType.FUNCTION):
            has_write = bool(self.successors(node.id, EdgeType.WRITES))
            has_external = bool(self.successors(node.id, EdgeType.EXTERNAL_CALL))
            if has_write and has_external:
                results.append(node)
        return results

    def get_balance_changing_functions(self) -> list[Node]:
        """Find functions likely to affect token or ETH balances."""
        sensitive_keywords = ["balance", "reserve", "totalLiquidity", "vault", "pool"]
        results = []
        for node in self.nodes_by_type(NodeType.FUNCTION):
            # Check for writes to balance-related states
            writes = self.successors(node.id, EdgeType.WRITES)
            has_balance_write = any(any(kw in w.name.lower() for kw in sensitive_keywords) for w in writes)
            
            # Check for calls to transfer/withdraw/claim
            calls = self.successors(node.id, EdgeType.CALLS) + self.successors(node.id, EdgeType.EXTERNAL_CALL)
            has_transfer_call = any(any(kw in c.name.lower() for kw in ["transfer", "withdraw", "claim", "send", "call"]) for c in calls)
            
            if has_balance_write or has_transfer_call:
                results.append(node)
        return results

    def get_function_signature(self, function_id: str) -> str:
        """Constructs a minimal signature for calldata encoding."""
        node = self.nodes.get(function_id)
        if not node or node.node_type != NodeType.FUNCTION:
            return ""
        name = node.name
        args = node.metadata.get("arguments", [])
        # Extract types if available, else default to uint256
        arg_types = []
        if args:
            for arg in args:
                if isinstance(arg, dict):
                    arg_types.append(arg.get("type", "uint256"))
                else:
                    arg_types.append("uint256")
        else:
             # Heuristic: if name matches common patterns, guess args
             if name in ["borrow", "swap", "withdraw", "claim"]:
                 arg_types = ["uint256"]
        
        return f"{name}({','.join(arg_types)})"

    # ── Summary / Debug ───────────────────────────────────────────────────

    def summary(self) -> dict:
        return {
            "contracts": len(self.nodes_by_type(NodeType.CONTRACT)),
            "functions": len(self.nodes_by_type(NodeType.FUNCTION)),
            "states": len(self.nodes_by_type(NodeType.STATE)),
            "edges": len(self.edges),
            "edge_breakdown": {
                et.value: len(self.edges_by_type(et)) for et in EdgeType
            },
        }

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
        """Construct the SRG from the upgraded parser JSON."""
        g = cls()
        contract_map = parsed.get("contract_map", {})

        # ── Pass 1: Add all nodes ─────────────────────────────────────────

        # Contract nodes
        for c in parsed.get("contracts", []):
            g.add_node(Node(
                id=f"contract:{c['name']}",
                node_type=NodeType.CONTRACT,
                name=c["name"],
                metadata={"type": c.get("type"), "file": c.get("file"), "inherits": c.get("inherits", [])},
            ))

        # Function nodes
        for f in parsed.get("functions", []):
            contract = f.get("contract", "")
            fid = f"function:{contract}.{f['name']}" if contract else f"function:{f['name']}"
            if fid not in g.nodes:
                g.add_node(Node(
                    id=fid,
                    node_type=NodeType.FUNCTION,
                    name=f["name"],
                    metadata={
                        "contract": contract,
                        "arguments": f.get("arguments"),
                        "modifiers": f.get("modifiers"),
                        "returns": f.get("returns"),
                        "visibility": f.get("visibility"),
                        "file": f.get("file"),
                    },
                ))

        # State variable nodes
        for sv in parsed.get("state_variables", []):
            contract = sv.get("contract", "")
            sid = f"state:{contract}.{sv['name']}" if contract else f"state:{sv['name']}"
            if sid not in g.nodes:
                g.add_node(Node(
                    id=sid,
                    node_type=NodeType.STATE,
                    name=sv["name"],
                    metadata={
                        "contract": contract,
                        "type": sv.get("type"),
                        "visibility": sv.get("visibility"),
                        "file": sv.get("file"),
                    },
                ))

        # ── Pass 2: Add all edges from relationships ──────────────────────

        edge_map = {
            "INHERITS": EdgeType.INHERITS,
            "HAS_FUNCTION": EdgeType.HAS_FUNCTION,
            "HAS_STATE": EdgeType.HAS_STATE,
            "CALLS": EdgeType.CALLS,
            "READS": EdgeType.READS,
            "WRITES": EdgeType.WRITES,
            "EXTERNAL_CALL": EdgeType.EXTERNAL_CALL,
        }

        for rel in parsed.get("relationships", []):
            edge_type = edge_map.get(rel.get("type"))
            if not edge_type:
                continue

            source_raw = rel["source"]
            target_raw = rel["target"]

            # Resolve node IDs
            source_id = g._resolve_node_id(source_raw)
            target_id = g._resolve_node_id(target_raw)

            # For CALLS edges, try to resolve the target function within the same contract
            if edge_type == EdgeType.CALLS and target_id not in g.nodes:
                # Try: target is a bare function name; resolve within the source contract
                contract = source_raw.split(".")[0] if "." in source_raw else ""
                candidate = f"function:{contract}.{target_raw}"
                if candidate in g.nodes:
                    target_id = candidate
                else:
                    # Try across all contracts
                    for nid in g.nodes:
                        if nid.startswith("function:") and nid.endswith(f".{target_raw}"):
                            target_id = nid
                            break

            # Only add edges where both endpoints exist
            if source_id in g.nodes and target_id in g.nodes:
                g.add_edge(Edge(source=source_id, target=target_id, edge_type=edge_type))
            elif source_id in g.nodes:
                # Create a stub node for unresolved targets (important for external calls)
                if edge_type == EdgeType.EXTERNAL_CALL:
                    stub = Node(id=target_id, node_type=NodeType.FUNCTION, name=target_raw, metadata={"stub": True})
                    g.add_node(stub)
                    g.add_edge(Edge(source=source_id, target=target_id, edge_type=edge_type))

        return g

    def _resolve_node_id(self, raw: str) -> str:
        """Attempt to resolve a raw name to a node ID."""
        # Already a valid node id?
        if raw in self.nodes:
            return raw
        # contract name?
        if f"contract:{raw}" in self.nodes:
            return f"contract:{raw}"
        # function name (ContractName.funcName)?
        if f"function:{raw}" in self.nodes:
            return f"function:{raw}"
        # state variable?
        if f"state:{raw}" in self.nodes:
            return f"state:{raw}"
        # Fallback
        return f"function:{raw}"

    def __repr__(self) -> str:
        return f"<SRG nodes={len(self.nodes)} edges={len(self.edges)}>"


# ── CLI entry point ───────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent))
    from sol_parser.solidity_parser import SolidityParser

    target = sys.argv[1] if len(sys.argv) > 1 else "."
    parser = SolidityParser(target)
    parsed = parser.parse_all()
    srg = SecurityReasoningGraph.from_parser_output(parsed)

    s = srg.summary()
    print(f"Contracts: {s['contracts']}")
    print(f"Functions: {s['functions']}")
    print(f"States:    {s['states']}")
    print(f"Edges:     {s['edges']}")
    print(f"\nEdge breakdown:")
    for etype, count in s["edge_breakdown"].items():
        print(f"  {etype}: {count}")

    print(f"\nSample edges (first 10):")
    for e in srg.edges[:10]:
        print(f"  [{e.edge_type.value}] {e.source} -> {e.target}")
