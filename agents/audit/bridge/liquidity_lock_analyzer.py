"""LiquidityLockAnalyzer — Analyzes fund lock conditions."""
from __future__ import annotations
import json
from typing import Any
from agents.base_agent import BaseAgent

class LiquidityLockAnalyzer(BaseAgent):
    def __init__(self, model: str = "meta/llama-3.1-405b-instruct") -> None:
        super().__init__(name="LiquidityLockAnalyzer", role="Bridge specialist — analyzes liquidity locks", skill_keys=["audit-firm-1-solidity-auditor"], model=model)
    async def run(self, context: dict) -> dict:
        contract_map = context.get("contract_map", {})
        source = "\n".join(f"--- {n} ---\n{c[:3000]}" for n, c in contract_map.items()) if isinstance(contract_map, dict) else str(contract_map)[:8000]
        system = "You are LIQUIDITY LOCK ANALYZER. Find: permanent fund locking, stuck messages, unrecoverable states. Return JSON with vulnerabilities array."
        raw = await self.call_llm(system_extra=system, messages=[{"role": "user", "content": json.dumps({"CODE": source[:10000]})}], api_key=context.get("api_key"), max_tokens=4096)
        from core.utils import parse_llm_json
        parsed = parse_llm_json(raw)
        return {"vulnerabilities": parsed.get("vulnerabilities", [])}
