"""
HypothesisAgent — D1
Generates adversarial exploit hypotheses from recon + invariant analysis,
ranked by impact × likelihood. Feeds prioritized hypotheses to the exploit pass.
"""
from __future__ import annotations

import json
from typing import Any

from .base_agent import BaseAgent


class HypothesisAgent(BaseAgent):
    """
    HypothesisAgent generates ranked exploit hypotheses from prior analysis passes.

    Inputs (from context):
        - contract_map: dict[str, str]  — {contract_name: source_code}
        - recon_output: dict            — recon agent output (entry points, external calls, etc.)
        - logic_flaws: list             — discovered logic flaws
        - invariant_violations: list    — discovered invariant violations

    Outputs:
        - hypotheses: list[dict]        — ranked exploit hypotheses with confidence scores
        - hypothesis_summary: str       — human-readable summary
    """

    def __init__(self, model: str = "claude-sonnet-4-6") -> None:
        super().__init__(
            name="HypothesisAgent",
            role="Hypothesis engine — generates ranked adversarial exploit scenarios",
            skill_keys=["audit-firm-1-solidity-auditor"],
            model=model,
        )

    async def run(self, context: dict) -> dict:
        self.log_step("hypothesis_run_started", {"context_keys": list(context.keys())})

        contract_map = context.get("contract_map", {})
        recon_output = context.get("recon_output", {})
        logic_flaws = context.get("logic_flaws", [])
        invariant_violations = context.get("invariant_violations", [])

        if not isinstance(contract_map, dict):
            contract_map = {}
        if not isinstance(logic_flaws, list):
            logic_flaws = []
        if not isinstance(invariant_violations, list):
            invariant_violations = []

        # Phase 1: Generate raw hypotheses
        raw_hypotheses = await self._generate_hypotheses(
            contract_map, recon_output, logic_flaws, invariant_violations
        )

        # Phase 2: Rank and deduplicate
        ranked_hypotheses = await self._rank_hypotheses(contract_map, raw_hypotheses)

        hypothesis_count = len(ranked_hypotheses.get("hypotheses", []))
        self.log_step("hypothesis_run_completed", {"hypothesis_count": hypothesis_count})

        return {
            "hypotheses": ranked_hypotheses.get("hypotheses", []),
            "hypothesis_summary": ranked_hypotheses.get("summary", ""),
        }

    async def _generate_hypotheses(
        self,
        contract_map: dict,
        recon_output: dict,
        logic_flaws: list,
        invariant_violations: list,
    ) -> dict[str, Any]:
        self.log_step("hypothesis_generate_started", {})

        entry_points = recon_output.get("entry_points", {})
        external_calls = recon_output.get("external_calls", [])
        contracts = list(contract_map.keys())

        system_prompt = (
            "You are HypothesisAgent — SRP's adversarial hypothesis engine. "
            "Your role: receive prior analysis findings and generate concrete, testable exploit hypotheses. "
            "Each hypothesis must describe a specific attack scenario with: "
            "1) the exact function(s) involved, "
            "2) the precondition the attacker must satisfy, "
            "3) the state change they can cause, "
            "4) the economic or security impact. "
            "SEVERITY RULES (Cyfrin 3-tier): "
            "high = High Impact + High Likelihood; "
            "medium = High Impact + Low Likelihood OR Medium Impact + any Likelihood; "
            "low = Low Impact + any Likelihood. "
            "Never use 'critical' or 'informational'. "
            "Return ONLY valid JSON with keys: "
            "hypotheses (array of objects: title, severity, contract, affected_function, "
            "precondition, attack_steps, impact, confidence [0.0-1.0]), "
            "generation_notes (string)."
        )

        # Compact the input to avoid context window issues
        logic_summaries = [
            {"title": str(f.get("title", str(f)))[:80], "severity": str(f.get("severity", "medium"))}
            if isinstance(f, dict) else {"title": str(f)[:80], "severity": "medium"}
            for f in logic_flaws[:10]
        ]
        violation_summaries = [
            {"id": str(v.get("id", ""))[:20], "description": str(v.get("description", str(v)))[:80]}
            if isinstance(v, dict) else {"description": str(v)[:80]}
            for v in invariant_violations[:10]
        ]

        user_payload = {
            "contracts": contracts,
            "entry_points": entry_points,
            "external_calls": external_calls[:20],
            "logic_flaws": logic_summaries,
            "invariant_violations": violation_summaries,
        }

        result = await self._execute_json_pass("hypothesis_generate", system_prompt, user_payload)
        if not isinstance(result, dict):
            result = {}
        
        self.log_step("hypothesis_generate_completed", {
            "hypothesis_count": len(result.get("hypotheses", []))
        })
        return result

    async def _rank_hypotheses(
        self, contract_map: dict, raw_hypotheses: dict[str, Any]
    ) -> dict[str, Any]:
        self.log_step("hypothesis_rank_started", {})

        hypotheses = raw_hypotheses.get("hypotheses", [])
        if not hypotheses:
            return {"hypotheses": [], "summary": "No hypotheses generated."}

        system_prompt = (
            "You are HypothesisAgent ranking exploit hypotheses. "
            "Your task: deduplicate by root cause, then rank by (impact × likelihood). "
            "Deduplication rule: if two hypotheses target the same root cause in the same function, "
            "keep only the higher-confidence one. "
            "Ranking rule: impact score 1-3 × likelihood score 1-3 = priority score. "
            "Output the top 10 unique hypotheses, sorted by priority descending. "
            "Update confidence scores based on your ranking assessment. "
            "Return ONLY valid JSON with keys: "
            "hypotheses (ranked array, same schema as input with added priority_score field), "
            "summary (string: 2-3 sentences describing the highest-risk attack surfaces)."
        )

        # Only pass summary info, not full contract code, to save tokens
        user_payload = {
            "contracts": list(contract_map.keys()),
            "hypotheses": hypotheses[:20],  # Max 20 to rank
        }

        result = await self._execute_json_pass("hypothesis_rank", system_prompt, user_payload)
        if not isinstance(result, dict):
            result = {}

        self.log_step("hypothesis_rank_completed", {
            "ranked_count": len(result.get("hypotheses", []))
        })
        return result

    async def _execute_json_pass(
        self,
        pass_name: str,
        system_prompt: str,
        payload: dict[str, Any],
        timeout: float | None = None,
    ) -> dict[str, Any]:
        user_prompt = json.dumps(payload, indent=2, default=str)
        if len(user_prompt) > 20000:
            user_prompt = user_prompt[:20000] + "\n...[TRUNCATED]..."

        messages = [{"role": "user", "content": user_prompt}]
        llm_output = await self.call_llm(
            system_extra=system_prompt, messages=messages, timeout=timeout
        )

        try:
            return self.parse_json(llm_output)
        except Exception as exc:
            self.log_step(f"{pass_name}_parse_failed", {"error": str(exc)})
            return {}
