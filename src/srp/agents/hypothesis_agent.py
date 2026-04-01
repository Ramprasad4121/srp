from __future__ import annotations

import json
from typing import Any

from .base_agent import BaseAgent


class HypothesisAgent(BaseAgent):
    """Generates protocol-specific attack hypotheses (Phase 3).
    
    Goal: Write 20-30 specific hypotheses BEFORE deep code reading.
    Every bug is an invariant violation.
    """

    def __init__(self, model: str = "meta/llama-3.1-405b-instruct") -> None:
        super().__init__(
            name="HypothesisAgent",
            role="Generates adversarial exploit hypotheses (Phase 3)",
        )

    async def run(self, context: dict) -> dict:
        self.log_step("hypothesis_generation_started", {"context_keys": list(context.keys())})

        api_key = context.get("api_key")
        recon = context.get("recon_output", {})
        protocol_intent = context.get("protocol_intent", {})
        
        system_prompt = (
            "You are an adversarial security researcher performing Phase 3: Attack Hypotheses.\n\n"
            "Your goal is to write 20-30 specific attack hypotheses for the protocol based on the provided Recon and Intent data.\n"
            "Each hypothesis must be CONCRETE and PROTOCOL-SPECIFIC. Avoid generic checklists.\n\n"
            "Examples:\n"
            "- HYP-001: Can an attacker call initialize() after deployment?\n"
            "- HYP-002: Does reward calculation double-count if deposit+withdraw in same block?\n"
            "- HYP-003: Can flash loan inflate totalSupply to steal yield?\n\n"
            "Return ONLY valid JSON with keys:\n"
            "hypotheses (array of objects: id, title, description, target_contract, affected_function, impact)."
        )
        
        user_prompt = (
            f"Protocol Recon:\n{json.dumps(recon)}\n\n"
            f"Protocol Intent:\n{json.dumps(protocol_intent)}"
        )
        
        messages = [{"role": "user", "content": user_prompt}]
        llm_output = await self.call_llm(system_extra=system_prompt, messages=messages, api_key=api_key)
        
        try:
            result = self.parse_json(llm_output)
        except Exception:
            result = {"hypotheses": []}

        self.log_step("hypothesis_generation_completed", {"hypothesis_count": len(result.get("hypotheses", []))})
        return result
