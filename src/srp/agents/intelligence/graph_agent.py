from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import aiohttp
import networkx as nx

from ..base_agent import BaseAgent


class GraphAgent(BaseAgent):
    NODE_TYPES = {"contract", "protocol", "oracle", "attack_pattern", "exploit_event"}
    EDGE_TYPES = {
        "calls",
        "inherits",
        "trusts_oracle",
        "is_fork_of",
        "was_exploited_by",
        "shares_pattern_with",
    }

    def __init__(self) -> None:
        super().__init__(
            name="GraphAgent",
            role="Builds a protocol relationship graph for dependency and blast-radius analysis",
            skill_keys=["ethskills-standards", "ethskills-concepts"],
        )
        self.graph = nx.DiGraph()
        self.graph_path = Path("./data/contract_graph.json")
        self.etherscan_api_url = os.environ.get("ETHERSCAN_API_URL", "https://api.etherscan.io/api")
        self._load_graph_from_disk()

    async def map_contract(self, address: str, source_code: str) -> dict:
        contract_addr = self._normalize_address(address)
        contract_node_id = self._node_id("contract", contract_addr)
        self._upsert_node(
            contract_node_id,
            "contract",
            label=contract_addr,
            address=contract_addr,
            mapped_at=datetime.now(timezone.utc).isoformat(),
        )
        self.log_step(
            "graph_map_started",
            {"address": contract_addr, "source_chars": len(source_code)},
        )

        inheritance = self._parse_inheritance(source_code)
        for parent in inheritance:
            parent_node = self._node_id("contract", parent)
            self._upsert_node(parent_node, "contract", label=parent, name=parent)
            self._upsert_edge(contract_node_id, parent_node, "inherits")

        parsed_calls = self._parse_external_calls(source_code)
        address_targets = parsed_calls["address_targets"][:25]
        symbol_targets = parsed_calls["symbol_targets"]
        low_level_calls = parsed_calls["low_level_calls"]

        abi_by_address: dict[str, list[dict[str, Any]] | None] = {}
        if address_targets:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=25)) as session:
                for target in address_targets:
                    abi_by_address[target] = await self._fetch_etherscan_abi(session, target)

        external_protocols: list[dict[str, Any]] = []
        oracle_dependencies: list[str] = []

        for target in address_targets:
            abi = abi_by_address.get(target)
            is_oracle = self._abi_looks_like_oracle(abi)
            node_type = "oracle" if is_oracle else "protocol"
            node_id = self._node_id(node_type, target)

            abi_functions = self._abi_function_names(abi)
            self._upsert_node(
                node_id,
                node_type,
                label=target,
                address=target,
                abi_functions=abi_functions[:50],
                abi_available=bool(abi_functions),
            )
            self._upsert_edge(
                contract_node_id,
                node_id,
                "trusts_oracle" if is_oracle else "calls",
            )

            row = {
                "target": target,
                "node_id": node_id,
                "node_type": node_type,
                "abi_available": bool(abi_functions),
            }
            external_protocols.append(row)
            if is_oracle:
                oracle_dependencies.append(target)

        for symbol in symbol_targets:
            lower_symbol = symbol.lower()
            looks_oracle = any(
                token in lower_symbol for token in ("oracle", "price", "twap", "feed", "chainlink")
            )
            node_type = "oracle" if looks_oracle else "protocol"
            node_id = self._node_id(node_type, symbol)
            self._upsert_node(node_id, node_type, label=symbol, symbol=symbol)
            self._upsert_edge(
                contract_node_id,
                node_id,
                "trusts_oracle" if looks_oracle else "calls",
            )
            external_protocols.append(
                {
                    "target": symbol,
                    "node_id": node_id,
                    "node_type": node_type,
                    "abi_available": False,
                }
            )
            if looks_oracle:
                oracle_dependencies.append(symbol)

        oracle_hints = self._parse_oracle_dependencies(source_code)
        for oracle_name in oracle_hints:
            node_id = self._node_id("oracle", oracle_name)
            self._upsert_node(node_id, "oracle", label=oracle_name, symbol=oracle_name)
            self._upsert_edge(contract_node_id, node_id, "trusts_oracle")
            if oracle_name not in oracle_dependencies:
                oracle_dependencies.append(oracle_name)

        for fork_hint in self._parse_fork_hints(source_code):
            fork_node = self._node_id("protocol", fork_hint)
            self._upsert_node(fork_node, "protocol", label=fork_hint, symbol=fork_hint)
            self._upsert_edge(contract_node_id, fork_node, "is_fork_of")

        for pattern_name in self._detect_attack_patterns(source_code, low_level_calls):
            pattern_node = self._node_id("attack_pattern", pattern_name)
            self._upsert_node(
                pattern_node,
                "attack_pattern",
                label=pattern_name,
                pattern=pattern_name,
            )
            self._upsert_edge(contract_node_id, pattern_node, "shares_pattern_with")

        depth = self._compute_depth(contract_node_id)
        self._save_graph_to_disk()
        nodes, edges = self._serialize_graph()

        result = {
            "nodes": nodes,
            "edges": edges,
            "depth": depth,
            "external_protocols": self._dedupe_dict_list(external_protocols, key_field="node_id"),
            "oracle_dependencies": sorted(set(oracle_dependencies)),
        }
        self.log_step(
            "graph_map_completed",
            {
                "address": contract_addr,
                "nodes": len(nodes),
                "edges": len(edges),
                "depth": depth,
                "external_protocols": len(result["external_protocols"]),
                "oracle_dependencies": len(result["oracle_dependencies"]),
            },
        )
        return result

    async def get_blast_path(self, exploit_address: str) -> list:
        normalized = self._normalize_address(exploit_address)
        exploit_node = self._node_id("exploit_event", normalized)
        self._upsert_node(
            exploit_node,
            "exploit_event",
            label=normalized,
            address=normalized,
            first_seen=datetime.now(timezone.utc).isoformat(),
        )

        for node_type in ("contract", "protocol", "oracle"):
            candidate = self._node_id(node_type, normalized)
            if self.graph.has_node(candidate):
                self._upsert_edge(exploit_node, candidate, "was_exploited_by")

        paths = nx.single_source_shortest_path(self.graph, exploit_node)
        blast_paths: list[dict[str, Any]] = []
        for target, path in paths.items():
            if target == exploit_node:
                continue
            target_type = str(self.graph.nodes[target].get("type", "unknown"))
            blast_paths.append(
                {
                    "target": target,
                    "target_type": target_type,
                    "path": path,
                    "length": max(0, len(path) - 1),
                }
            )

        blast_paths.sort(key=lambda row: (row["length"], row["target"]))
        self._save_graph_to_disk()
        self.log_step(
            "graph_blast_path_completed",
            {
                "exploit_address": normalized,
                "paths": len(blast_paths),
            },
        )
        return blast_paths

    async def export_for_ui(self) -> dict:
        nodes, edges = self._serialize_graph()
        payload = {
            "nodes": nodes,
            "links": edges,
            "meta": {
                "node_count": len(nodes),
                "edge_count": len(edges),
                "generated_at": datetime.now(timezone.utc).isoformat(),
            },
        }
        return payload

    async def run(self, context: dict) -> dict:
        address = str(context.get("address", "")).strip()
        source_code = str(context.get("source_code", "")).strip()
        exploit_address = str(context.get("exploit_address", "")).strip()

        if address and source_code:
            result = await self.map_contract(address=address, source_code=source_code)
            
            from srp.core.solodit import solodit

            # After building contract map, enrich with historical context
            solodit_context = []
            for keyword in ["flash loan", "reentrancy", "oracle manipulation", "proxy storage"]:
                results = await solodit.search(keyword, limit=3)
                if results:
                    solodit_context.append(f"## Historical {keyword} exploits:\n{results}")

            self.log("solodit_context_loaded")
            # Inject into recon context passed downstream
            context["solodit_intel"] = "\n\n".join(solodit_context)
            
            return result
        if exploit_address:
            paths = await self.get_blast_path(exploit_address)
            return {"blast_paths": paths}
        return await self.export_for_ui()

    def _load_graph_from_disk(self) -> None:
        path = self.graph_path
        if not path.is_absolute():
            path = Path.cwd() / path
        if not path.exists():
            return
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            self.log_step("graph_load_failed", {"error": str(exc)})
            return

        nodes = payload.get("nodes", [])
        links = payload.get("links", payload.get("edges", []))
        if not isinstance(nodes, list) or not isinstance(links, list):
            return

        for node in nodes:
            if not isinstance(node, dict):
                continue
            node_id = str(node.get("id", "")).strip()
            node_type = str(node.get("type", "")).strip()
            if not node_id or node_type not in self.NODE_TYPES:
                continue
            attrs = dict(node)
            attrs.pop("id", None)
            self.graph.add_node(node_id, **attrs)

        for link in links:
            if not isinstance(link, dict):
                continue
            source = str(link.get("source", "")).strip()
            target = str(link.get("target", "")).strip()
            edge_type = str(link.get("type", "")).strip()
            if not source or not target or edge_type not in self.EDGE_TYPES:
                continue
            self._upsert_edge(source, target, edge_type)

    def _save_graph_to_disk(self) -> None:
        path = self.graph_path
        if not path.is_absolute():
            path = Path.cwd() / path
        path.parent.mkdir(parents=True, exist_ok=True)
        nodes, edges = self._serialize_graph()
        payload = {
            "nodes": nodes,
            "links": edges,
            "meta": {
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "node_count": len(nodes),
                "edge_count": len(edges),
            },
        }
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def _upsert_node(self, node_id: str, node_type: str, **attrs: Any) -> None:
        if node_type not in self.NODE_TYPES:
            raise ValueError(f"Unsupported node type: {node_type}")
        base = {"type": node_type}
        base.update(attrs)
        if self.graph.has_node(node_id):
            self.graph.nodes[node_id].update(base)
        else:
            self.graph.add_node(node_id, **base)

    def _upsert_edge(self, source: str, target: str, edge_type: str) -> None:
        if edge_type not in self.EDGE_TYPES:
            raise ValueError(f"Unsupported edge type: {edge_type}")

        if self.graph.has_edge(source, target):
            data = dict(self.graph.get_edge_data(source, target) or {})
            edge_types = data.get("edge_types", [])
            if not isinstance(edge_types, list):
                edge_types = [data.get("type")] if data.get("type") else []
            if edge_type not in edge_types:
                edge_types.append(edge_type)
            data["edge_types"] = sorted(set(edge_types))
            data["type"] = edge_type
            self.graph.add_edge(source, target, **data)
        else:
            self.graph.add_edge(
                source,
                target,
                type=edge_type,
                edge_types=[edge_type],
            )

    async def _fetch_etherscan_abi(
        self, session: aiohttp.ClientSession, address: str
    ) -> list[dict[str, Any]] | None:
        api_key = os.environ.get("ETHERSCAN_API_KEY", "").strip()
        params = {
            "module": "contract",
            "action": "getabi",
            "address": address,
        }
        if api_key:
            params["apikey"] = api_key

        try:
            async with session.get(self.etherscan_api_url, params=params) as response:
                if response.status != 200:
                    return None
                payload = await response.json(content_type=None)
        except Exception as exc:  # pragma: no cover - network dependent
            self.log_step("graph_etherscan_fetch_failed", {"address": address, "error": str(exc)})
            return None

        if not isinstance(payload, dict):
            return None
        result = payload.get("result")
        if not isinstance(result, str):
            return None

        try:
            decoded = json.loads(result)
        except json.JSONDecodeError:
            return None
        if isinstance(decoded, list):
            return [item for item in decoded if isinstance(item, dict)]
        return None

    @staticmethod
    def _abi_function_names(abi: list[dict[str, Any]] | None) -> list[str]:
        if not isinstance(abi, list):
            return []
        names: list[str] = []
        for item in abi:
            if not isinstance(item, dict):
                continue
            if item.get("type") != "function":
                continue
            name = str(item.get("name", "")).strip()
            if name:
                names.append(name)
        return names

    def _abi_looks_like_oracle(self, abi: list[dict[str, Any]] | None) -> bool:
        names = {name.lower() for name in self._abi_function_names(abi)}
        markers = {
            "latestrounddata",
            "latestanswer",
            "getrounddata",
            "decimals",
            "consult",
            "getreserves",
        }
        return bool(names.intersection(markers))

    def _parse_inheritance(self, source_code: str) -> list[str]:
        entries: list[str] = []
        pattern = re.compile(r"\bcontract\s+\w+\s+is\s+([^{]+)\{", re.IGNORECASE)
        for match in pattern.finditer(source_code):
            clause = match.group(1)
            for base in clause.split(","):
                cleaned = base.strip().split()[-1] if base.strip() else ""
                if cleaned:
                    entries.append(cleaned)
        return sorted(set(entries))

    def _parse_external_calls(self, source_code: str) -> dict[str, Any]:
        address_targets = {
            self._normalize_address(addr)
            for addr in re.findall(r"0x[a-fA-F0-9]{40}", source_code)
        }

        low_level_calls: list[dict[str, str]] = []
        low_call_pattern = re.compile(
            r"\b([A-Za-z_][A-Za-z0-9_\.]*)\s*\.\s*(call|delegatecall|staticcall)\s*\(",
            re.IGNORECASE,
        )
        for target, call_type in low_call_pattern.findall(source_code):
            cleaned_target = target.strip()
            low_level_calls.append({"target": cleaned_target, "call_type": call_type.lower()})
            if re.fullmatch(r"0x[a-fA-F0-9]{40}", cleaned_target):
                address_targets.add(self._normalize_address(cleaned_target))

        symbol_targets: set[str] = set()
        call_pattern = re.compile(
            r"\b([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(",
        )
        skip_bases = {
            "this",
            "super",
            "msg",
            "tx",
            "block",
            "abi",
            "address",
            "console",
            "vm",
        }
        for base, fn in call_pattern.findall(source_code):
            base_lower = base.lower()
            if base_lower in skip_bases:
                continue
            if fn.lower() in {"length", "push", "pop"}:
                continue
            symbol_targets.add(base)

        return {
            "address_targets": sorted(address_targets),
            "symbol_targets": sorted(symbol_targets),
            "low_level_calls": low_level_calls,
        }

    def _parse_oracle_dependencies(self, source_code: str) -> list[str]:
        hints: set[str] = set()
        oracle_patterns = [
            r"\bAggregatorV3Interface\b",
            r"\bChainlink\b",
            r"\blatestRoundData\b",
            r"\bTWAP\b",
            r"\bpriceFeed\b",
            r"\boracle\b",
        ]
        for pattern in oracle_patterns:
            if re.search(pattern, source_code, re.IGNORECASE):
                token = re.sub(r"\\b", "", pattern).strip("\\")
                hints.add(token)
        return sorted(hints)

    def _parse_fork_hints(self, source_code: str) -> list[str]:
        hints: set[str] = set()
        fork_patterns = [
            r"fork(?:ed)?\s+from\s+([A-Za-z0-9_\- ]+)",
            r"derived\s+from\s+([A-Za-z0-9_\- ]+)",
        ]
        for pattern in fork_patterns:
            for match in re.findall(pattern, source_code, flags=re.IGNORECASE):
                cleaned = str(match).strip(" .,:;")
                if cleaned:
                    hints.add(cleaned)
        return sorted(hints)

    def _detect_attack_patterns(
        self, source_code: str, low_level_calls: list[dict[str, str]]
    ) -> list[str]:
        patterns: set[str] = set()
        lowered = source_code.lower()

        if low_level_calls and "nonreentrant" not in lowered:
            patterns.add("potential_reentrancy_window")
        if "delegatecall" in lowered:
            patterns.add("delegatecall_upgrade_risk")
        if "ecrecover" in lowered or "permit(" in lowered:
            patterns.add("signature_verification_surface")
        if "latestRoundData".lower() in lowered or "chainlink" in lowered:
            patterns.add("oracle_dependency_risk")
        if "for (" in lowered and ".length" in lowered:
            patterns.add("unbounded_loop_dos_risk")
        if "unchecked" in lowered:
            patterns.add("unchecked_arithmetic_surface")
        return sorted(patterns)

    def _compute_depth(self, root_node: str) -> int:
        if not self.graph.has_node(root_node):
            return 0
        lengths = nx.single_source_shortest_path_length(self.graph, root_node)
        return max(lengths.values()) if lengths else 0

    def _serialize_graph(self) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        nodes: list[dict[str, Any]] = []
        for node_id, attrs in self.graph.nodes(data=True):
            row = {"id": node_id}
            row.update({key: value for key, value in attrs.items() if key != "abi"})
            row.setdefault("label", node_id)
            row.setdefault("type", "unknown")
            nodes.append(row)

        edges: list[dict[str, Any]] = []
        for source, target, attrs in self.graph.edges(data=True):
            edge_types = attrs.get("edge_types", [])
            if not isinstance(edge_types, list) or not edge_types:
                edge_types = [attrs.get("type", "calls")]
            for edge_type in edge_types:
                edges.append(
                    {
                        "source": source,
                        "target": target,
                        "type": edge_type,
                    }
                )
        return nodes, edges

    @staticmethod
    def _dedupe_dict_list(rows: list[dict[str, Any]], key_field: str) -> list[dict[str, Any]]:
        by_key: dict[str, dict[str, Any]] = {}
        for row in rows:
            key = str(row.get(key_field, "")).strip()
            if not key:
                continue
            by_key[key] = row
        return list(by_key.values())

    @staticmethod
    def _normalize_address(value: str) -> str:
        addr = str(value).strip()
        if re.fullmatch(r"0x[a-fA-F0-9]{40}", addr):
            return addr.lower()
        return addr

    @staticmethod
    def _node_id(node_type: str, value: str) -> str:
        normalized = str(value).strip().lower()
        return f"{node_type}:{normalized}"
