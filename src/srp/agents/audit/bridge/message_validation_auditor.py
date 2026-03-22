"""MessageValidationAuditor — Validates cross-chain message handling."""
from __future__ import annotations
import json
from typing import Any
from srp.agents.base_agent import BaseAgent
from srp.agents.audit.title_utils import apply_finding_titles

class MessageValidationAuditor(BaseAgent):
    def __init__(self, model: str = "meta/llama-3.1-405b-instruct") -> None:
        super().__init__(name="MessageValidationAuditor", role="Bridge specialist — validates message handling", skill_keys=["audit-firm-1-solidity-auditor"], model=model)
    async def run(self, context: dict) -> dict:
        contract_map = context.get("contract_map", {})
        source = "\n".join(f"--- {n} ---\n{c[:3000]}" for n, c in contract_map.items()) if isinstance(contract_map, dict) else str(contract_map)[:8000]
        system = "You are MESSAGE VALIDATION AUDITOR. Find: input sanitization flaws, malformed message handling, arbitrary execution bugs. Return JSON with vulnerabilities array."
        raw = await self.call_llm(system_extra=system, messages=[{"role": "user", "content": json.dumps({"CODE": source[:10000]})}], api_key=context.get("api_key"), max_tokens=4096)
        from srp.core.utils import parse_llm_json
        parsed = parse_llm_json(raw)
        return {"vulnerabilities": apply_finding_titles(parsed.get("vulnerabilities", []), "Message Validation Bug", "arbitrary cross-chain execution")}
