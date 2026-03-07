from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Awaitable, Callable

from ..base_agent import BaseAgent


class BlastRadiusAgent(BaseAgent):
    def __init__(self) -> None:
        super().__init__(
            name="BlastRadiusAgent",
            role="Assesses exploit blast radius by pattern-matching vulnerabilities across monitored contracts",
            skill_keys=["tob-variant-analysis"],
        )
        self.graph_path = Path("./data/contract_graph.json")
        self.alert_callback: Callable[[dict[str, Any]], Awaitable[None]] | None = None
        self.websocket_clients: list[Any] = []

    async def run(self, context: dict) -> dict:
        self.log_step("blast_radius_run_started", {"context_keys": list(context.keys())})

        exploit = self._normalize_exploit(context.get("new_exploit"))
        graph_payload = self._load_graph_payload(
            graph_payload=context.get("graph_payload"),
            graph_path=context.get("graph_path"),
        )
        contracts = self._extract_contract_nodes(
            graph_payload=graph_payload,
            monitored_contracts=context.get("monitored_contracts"),
        )
        contract_sources = context.get("contract_sources", {})
        if not isinstance(contract_sources, dict):
            contract_sources = {}

        self.log_step(
            "blast_radius_inputs_ready",
            {
                "protocol": exploit.get("protocol"),
                "attack_vector": exploit.get("attack_vector"),
                "contracts_in_scope": len(contracts),
            },
        )

        at_risk_contracts: list[dict[str, Any]] = []
        safe_contracts: list[dict[str, Any]] = []

        for contract in contracts:
            source_code = self._resolve_contract_source(contract, contract_sources)
            assessment = await self._assess_variant_similarity(
                exploit=exploit,
                contract=contract,
                source_code=source_code,
            )
            row = {
                "address": contract["address"],
                "similarity_score": assessment["similarity_score"],
                "reason": assessment["reason"],
                "urgency": assessment["urgency"],
            }
            if assessment["similarity_score"] > 70:
                at_risk_contracts.append(row)
            else:
                safe_contracts.append(row)

        at_risk_contracts.sort(key=lambda item: item["similarity_score"], reverse=True)
        safe_contracts.sort(key=lambda item: item["similarity_score"], reverse=True)

        if at_risk_contracts:
            await self.emergency_alert(at_risk_contracts)

        result = {
            "exploit": exploit,
            "at_risk_contracts": at_risk_contracts,
            "safe_contracts": safe_contracts,
        }
        self.log_step(
            "blast_radius_run_completed",
            {
                "at_risk_count": len(at_risk_contracts),
                "safe_count": len(safe_contracts),
            },
        )
        return result

    async def emergency_alert(self, at_risk: list) -> None:
        payload = {
            "event": "emergency_alert",
            "agent": self.name,
            "data": {
                "at_risk_count": len(at_risk),
                "at_risk_contracts": at_risk,
            },
        }

        subscribers_notified = 0
        if self.alert_callback is not None:
            try:
                await self.alert_callback(payload)
                subscribers_notified += 1
            except Exception as exc:  # pragma: no cover - callback transport dependent
                self.log_step("blast_radius_alert_callback_failed", {"error": str(exc)})

        stale_clients: list[Any] = []
        for client in self.websocket_clients:
            send_json = getattr(client, "send_json", None)
            if not callable(send_json):
                stale_clients.append(client)
                continue
            try:
                maybe_awaitable = send_json(payload)
                if hasattr(maybe_awaitable, "__await__"):
                    await maybe_awaitable
                subscribers_notified += 1
            except Exception as exc:  # pragma: no cover - network dependent
                stale_clients.append(client)
                self.log_step("blast_radius_alert_ws_failed", {"error": str(exc)})

        if stale_clients:
            self.websocket_clients = [c for c in self.websocket_clients if c not in stale_clients]

        if subscribers_notified == 0:
            self.log_step(
                "blast_radius_alert_not_sent",
                {"reason": "no_websocket_subscribers", "at_risk_count": len(at_risk)},
            )
            return

        self.log_step(
            "blast_radius_alert_sent",
            {"subscribers_notified": subscribers_notified, "at_risk_count": len(at_risk)},
        )

    def set_alert_callback(self, callback: Callable[[dict[str, Any]], Awaitable[None]]) -> None:
        self.alert_callback = callback

    def register_websocket(self, websocket: Any) -> None:
        self.websocket_clients.append(websocket)

    async def _assess_variant_similarity(
        self,
        exploit: dict[str, Any],
        contract: dict[str, Any],
        source_code: str,
    ) -> dict[str, Any]:
        system_extra = (
            "Use Trail of Bits variant-analysis methodology. "
            "Does this contract share the vulnerable pattern? "
            "Find similar vulnerability instances across codebases using pattern-based analysis. "
            "Similarity 0-100.\n\n"
            "Return ONLY valid JSON with keys: similarity_score (int), reason (str), urgency (str)."
        )
        payload = {
            "new_exploit": exploit,
            "contract": {
                "address": contract["address"],
                "node_id": contract["node_id"],
                "label": contract["label"],
                "metadata": contract["metadata"],
            },
            "contract_source": source_code[:12000],
        }

        try:
            llm_output = await self.call_llm(
                system_extra=system_extra,
                messages=[{"role": "user", "content": json.dumps(payload, default=str)}],
            )
            parsed = self._parse_json_output(llm_output)
            score = self._to_score(parsed.get("similarity_score"))
            reason = str(parsed.get("reason", "")).strip()
            urgency = self._normalize_urgency(parsed.get("urgency"), score)
        except Exception as exc:  # pragma: no cover - network/env dependent
            self.log_step(
                "blast_radius_variant_llm_failed",
                {"address": contract["address"], "error": str(exc)},
            )
            score, reason, urgency = self._fallback_similarity(exploit, contract, source_code)

        if not reason:
            reason = "Pattern overlap analysis did not provide a detailed explanation."

        self.log_step(
            "blast_radius_contract_assessed",
            {
                "address": contract["address"],
                "similarity_score": score,
                "urgency": urgency,
            },
        )
        return {
            "similarity_score": score,
            "reason": reason,
            "urgency": urgency,
        }

    def _fallback_similarity(
        self,
        exploit: dict[str, Any],
        contract: dict[str, Any],
        source_code: str,
    ) -> tuple[int, str, str]:
        pattern_text = " ".join(
            [
                str(exploit.get("attack_vector", "")),
                str(exploit.get("vulnerable_pattern", "")),
            ]
        )
        contract_text = " ".join(
            [
                contract["address"],
                contract["node_id"],
                contract["label"],
                source_code[:8000],
            ]
        )
        score = self._keyword_overlap_score(pattern_text, contract_text)
        urgency = self._normalize_urgency(None, score)
        reason = "Fallback lexical overlap scoring used due to unavailable LLM response."
        return score, reason, urgency

    def _load_graph_payload(
        self,
        graph_payload: Any,
        graph_path: Any,
    ) -> dict[str, Any]:
        if isinstance(graph_payload, dict):
            return graph_payload

        selected_path = Path(str(graph_path).strip()) if graph_path else self.graph_path
        if not selected_path.is_absolute():
            selected_path = Path.cwd() / selected_path
        if not selected_path.exists():
            self.log_step("blast_radius_graph_missing", {"path": str(selected_path)})
            return {"nodes": [], "links": []}

        try:
            data = json.loads(selected_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ValueError(f"Failed to load graph payload from {selected_path}: {exc}") from exc

        if not isinstance(data, dict):
            raise ValueError(f"Graph payload at {selected_path} must be a JSON object")
        return data

    def _extract_contract_nodes(
        self,
        graph_payload: dict[str, Any],
        monitored_contracts: Any,
    ) -> list[dict[str, Any]]:
        nodes = graph_payload.get("nodes", [])
        if not isinstance(nodes, list):
            nodes = []

        monitored_set = set()
        if isinstance(monitored_contracts, list):
            for value in monitored_contracts:
                text = str(value).strip().lower()
                if text:
                    monitored_set.add(text)

        contracts: list[dict[str, Any]] = []
        seen: set[str] = set()
        for node in nodes:
            if not isinstance(node, dict):
                continue
            node_type = str(node.get("type", "")).strip().lower()
            if node_type != "contract":
                continue

            node_id = str(node.get("id", "")).strip()
            if not node_id:
                continue
            address = str(node.get("address", "")).strip() or self._address_from_node_id(node_id)
            if not address:
                continue

            normalized = address.lower()
            if monitored_set and normalized not in monitored_set and node_id.lower() not in monitored_set:
                continue
            if normalized in seen:
                continue

            contracts.append(
                {
                    "node_id": node_id,
                    "address": normalized,
                    "label": str(node.get("label", address)).strip() or normalized,
                    "metadata": node,
                }
            )
            seen.add(normalized)

        return contracts

    def _resolve_contract_source(self, contract: dict[str, Any], sources: dict[str, Any]) -> str:
        candidates = [
            contract["address"],
            contract["address"].lower(),
            contract["node_id"],
            contract["node_id"].lower(),
        ]
        for key in candidates:
            if key in sources:
                return str(sources.get(key, ""))
        return ""

    def _normalize_exploit(self, value: Any) -> dict[str, str]:
        if not isinstance(value, dict):
            raise ValueError("BlastRadiusAgent requires context['new_exploit'] as an object")

        exploit = {
            "protocol": str(value.get("protocol", "")).strip(),
            "attack_vector": str(value.get("attack_vector", "")).strip(),
            "vulnerable_pattern": str(value.get("vulnerable_pattern", "")).strip(),
            "exploit_code": str(value.get("exploit_code", "")).strip(),
        }
        if not exploit["vulnerable_pattern"]:
            raise ValueError("new_exploit.vulnerable_pattern is required")
        return exploit

    @staticmethod
    def _parse_json_output(raw: str) -> dict[str, Any]:
        from core.utils import parse_llm_json
        return parse_llm_json(raw)

    @staticmethod
    def _to_score(value: Any) -> int:
        try:
            score = int(round(float(value)))
        except (TypeError, ValueError):
            score = 0
        return max(0, min(100, score))

    @staticmethod
    def _normalize_urgency(value: Any, score: int) -> str:
        urgency = str(value or "").strip().lower()
        if urgency in {"low", "medium", "high", "critical"}:
            return urgency
        if score > 90:
            return "critical"
        if score > 80:
            return "high"
        if score > 70:
            return "medium"
        return "low"

    @staticmethod
    def _keyword_overlap_score(pattern_text: str, contract_text: str) -> int:
        pattern_tokens = set(re.findall(r"[a-zA-Z_][a-zA-Z0-9_]{2,}", pattern_text.lower()))
        contract_tokens = set(re.findall(r"[a-zA-Z_][a-zA-Z0-9_]{2,}", contract_text.lower()))
        if not pattern_tokens:
            return 0
        overlap = pattern_tokens.intersection(contract_tokens)
        raw = int((len(overlap) / max(1, len(pattern_tokens))) * 100)
        return max(0, min(100, raw))

    @staticmethod
    def _address_from_node_id(node_id: str) -> str:
        if ":" not in node_id:
            return node_id.strip().lower()
        return node_id.split(":", 1)[1].strip().lower()
