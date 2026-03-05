from __future__ import annotations

import json
import os
from typing import Any

from web3 import Web3

from ..base_agent import BaseAgent


class SentinelAgent(BaseAgent):
    OPENCLAW_HEARTBEAT_SECONDS = 60

    def __init__(self) -> None:
        super().__init__(
            name="SentinelAgent",
            role="Monitors on-chain transactions and flags likely attack behavior patterns",
            skill_keys=["audit-firm-1-solidity-auditor", "ethskills-concepts"],
        )
        self.monitored_contracts: list[str] = []

    async def analyze_transaction(self, tx: dict) -> dict:
        normalized_tx = self._normalize_tx(tx)
        self.log_step(
            "sentinel_analyze_tx_started",
            {
                "hash": normalized_tx.get("hash"),
                "to": normalized_tx.get("to"),
                "gas_used": normalized_tx.get("gas_used"),
            },
        )

        system_extra = (
            "Is this transaction anomalous? Check for: flash loan attack pattern, reentrancy call sequence, "
            "unusual gas consumption, price manipulation signals, unexpected large value transfer, governance "
            "attack patterns.\n\n"
            "Return ONLY valid JSON with keys: "
            "is_anomalous, confidence, attack_type, severity, explanation, trigger_agents. "
            "confidence must be 0.0-1.0. attack_type may be null."
        )
        user_payload = {"tx": normalized_tx}
        messages = [{"role": "user", "content": json.dumps(user_payload, default=str)}]

        try:
            llm_output = await self.call_llm(system_extra=system_extra, messages=messages)
            parsed = self._parse_json_output(llm_output)
        except Exception as exc:  # pragma: no cover - network/env dependent
            self.log_step("sentinel_analyze_tx_llm_failed", {"error": str(exc)})
            parsed = {}

        result = self._normalize_anomaly_result(parsed, normalized_tx)
        self.log_step(
            "sentinel_analyze_tx_completed",
            {
                "hash": normalized_tx.get("hash"),
                "is_anomalous": result["is_anomalous"],
                "attack_type": result["attack_type"],
                "severity": result["severity"],
                "confidence": result["confidence"],
            },
        )
        return result

    async def run_heartbeat(self) -> dict:
        if not self.monitored_contracts:
            self.log_step("sentinel_heartbeat_no_contracts", {})
            return {
                "heartbeat_interval_seconds": self.OPENCLAW_HEARTBEAT_SECONDS,
                "contracts_scanned": 0,
                "transactions_scanned": 0,
                "flagged_transactions": 0,
                "anomalies": [],
            }

        rpc_url = os.environ.get("RPC_URL", "").strip()
        if not rpc_url:
            raise ValueError("RPC_URL is required for SentinelAgent heartbeat")

        web3 = Web3(Web3.HTTPProvider(rpc_url))
        if not web3.is_connected():
            raise ConnectionError("Failed to connect to RPC_URL for SentinelAgent heartbeat")

        self.log_step(
            "sentinel_heartbeat_started",
            {
                "contracts": len(self.monitored_contracts),
                "heartbeat_interval_seconds": self.OPENCLAW_HEARTBEAT_SECONDS,
            },
        )

        anomalies: list[dict[str, Any]] = []
        transactions_scanned = 0
        flagged_transactions = 0

        for contract in self.monitored_contracts:
            contract_addr = self._normalize_address(contract, web3)
            txs = self._fetch_recent_txs_for_contract(web3, contract_addr, limit=50)
            transactions_scanned += len(txs)

            for tx in txs:
                if not self._is_flagged_tx(tx):
                    continue

                flagged_transactions += 1
                analysis = await self.analyze_transaction(tx)
                if not analysis.get("is_anomalous", False):
                    continue

                anomalies.append(
                    {
                        "contract": contract_addr,
                        "tx_hash": tx.get("hash"),
                        "analysis": analysis,
                    }
                )

        self.log_step(
            "sentinel_heartbeat_completed",
            {
                "contracts_scanned": len(self.monitored_contracts),
                "transactions_scanned": transactions_scanned,
                "flagged_transactions": flagged_transactions,
                "anomalies": len(anomalies),
            },
        )

        return {
            "heartbeat_interval_seconds": self.OPENCLAW_HEARTBEAT_SECONDS,
            "contracts_scanned": len(self.monitored_contracts),
            "transactions_scanned": transactions_scanned,
            "flagged_transactions": flagged_transactions,
            "anomalies": anomalies,
        }

    async def run(self, context: dict) -> dict:
        monitored = context.get("monitored_contracts")
        if isinstance(monitored, list):
            self.monitored_contracts = [str(item) for item in monitored if str(item).strip()]
        return await self.run_heartbeat()

    def get_openclaw_config(self) -> dict[str, Any]:
        return {
            "handler": "run_heartbeat",
            "interval_seconds": self.OPENCLAW_HEARTBEAT_SECONDS,
        }

    def _fetch_recent_txs_for_contract(
        self, web3: Web3, contract_addr: str, limit: int = 50
    ) -> list[dict[str, Any]]:
        latest = web3.eth.block_number
        scanned_blocks = 0
        max_blocks = 3000
        found: list[dict[str, Any]] = []

        while len(found) < limit and scanned_blocks < max_blocks and latest - scanned_blocks >= 0:
            block_number = latest - scanned_blocks
            scanned_blocks += 1
            try:
                block = web3.eth.get_block(block_number, full_transactions=True)
            except Exception:
                continue

            for tx in block.get("transactions", []):
                tx_to = self._safe_lower_hex(tx.get("to"))
                tx_from = self._safe_lower_hex(tx.get("from"))
                if tx_to != contract_addr.lower() and tx_from != contract_addr.lower():
                    continue

                tx_hash = tx.get("hash")
                hash_hex = tx_hash.hex() if hasattr(tx_hash, "hex") else str(tx_hash)
                receipt = None
                try:
                    receipt = web3.eth.get_transaction_receipt(tx_hash)
                except Exception:
                    receipt = None

                logs = []
                gas_used = 0
                if receipt is not None:
                    gas_used = int(receipt.get("gasUsed", 0))
                    for log in receipt.get("logs", []):
                        logs.append(
                            {
                                "address": str(log.get("address", "")),
                                "topics": [
                                    topic.hex() if hasattr(topic, "hex") else str(topic)
                                    for topic in log.get("topics", [])
                                ],
                                "data": (
                                    log.get("data").hex()
                                    if hasattr(log.get("data"), "hex")
                                    else str(log.get("data", ""))
                                ),
                            }
                        )

                found.append(
                    {
                        "hash": hash_hex,
                        "from": str(tx.get("from", "")),
                        "to": str(tx.get("to", "")),
                        "value": int(tx.get("value", 0)),
                        "input": (
                            tx.get("input").hex()
                            if hasattr(tx.get("input"), "hex")
                            else str(tx.get("input", ""))
                        ),
                        "gas_used": gas_used,
                        "logs": logs,
                    }
                )

                if len(found) >= limit:
                    break

        return found

    @staticmethod
    def _is_flagged_tx(tx: dict[str, Any]) -> bool:
        value = int(tx.get("value", 0) or 0)
        gas_used = int(tx.get("gas_used", 0) or 0)
        input_data = str(tx.get("input", ""))
        logs = tx.get("logs", [])

        return (
            value > 10**19
            or gas_used > 800000
            or len(input_data) > 600
            or (isinstance(logs, list) and len(logs) > 30)
        )

    def _normalize_anomaly_result(self, parsed: dict[str, Any], tx: dict[str, Any]) -> dict[str, Any]:
        is_anomalous = bool(parsed.get("is_anomalous", False))
        confidence = parsed.get("confidence", 0.0)
        try:
            confidence_value = float(confidence)
        except (TypeError, ValueError):
            confidence_value = 0.0
        confidence_value = max(0.0, min(1.0, confidence_value))

        attack_type = parsed.get("attack_type")
        attack_type_value = None if attack_type in (None, "", "null") else str(attack_type)

        severity = str(parsed.get("severity", "low")).strip().lower()
        if severity not in {"low", "medium", "high", "critical"}:
            severity = "low"

        trigger_agents = parsed.get("trigger_agents", [])
        if not isinstance(trigger_agents, list):
            trigger_agents = [str(trigger_agents)] if trigger_agents else []
        trigger_agents = [str(item).strip() for item in trigger_agents if str(item).strip()]

        explanation = str(parsed.get("explanation", "")).strip()
        if not explanation:
            explanation = f"No anomaly rationale provided for tx {tx.get('hash', '<unknown>')}."

        return {
            "is_anomalous": is_anomalous,
            "confidence": confidence_value,
            "attack_type": attack_type_value,
            "severity": severity,
            "explanation": explanation,
            "trigger_agents": trigger_agents,
        }

    @staticmethod
    def _normalize_tx(tx: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(tx, dict):
            tx = {}
        return {
            "hash": str(tx.get("hash", "")),
            "from": str(tx.get("from", "")),
            "to": str(tx.get("to", "")),
            "value": int(tx.get("value", 0) or 0),
            "input": str(tx.get("input", "")),
            "gas_used": int(tx.get("gas_used", 0) or 0),
            "logs": tx.get("logs", []) if isinstance(tx.get("logs"), list) else [],
        }

    @staticmethod
    def _normalize_address(address: str, web3: Web3) -> str:
        addr = str(address).strip()
        if not addr:
            return addr
        if web3.is_address(addr):
            return web3.to_checksum_address(addr)
        return addr

    @staticmethod
    def _safe_lower_hex(value: Any) -> str:
        if value is None:
            return ""
        return str(value).lower()

    def _parse_json_output(self, llm_output: str) -> dict[str, Any]:
        text = llm_output.strip()
        if text.startswith("```"):
            lines = text.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            text = "\n".join(lines).strip()

        try:
            parsed = json.loads(text)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError as exc:
            self.log_step(
                "sentinel_parse_failed",
                {"error": str(exc), "raw_preview": llm_output[:1000]},
            )
            return {}
