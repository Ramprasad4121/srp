"""
SRP Phase 2 — LLM-Powered Security Planner

Uses the Security Reasoning Graph (SRG) to produce a structured,
attack-oriented security testing plan.  The full SRG is never sent
to the LLM; instead a compact summary is extracted first.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
from typing import Any, Optional
from core.utils import parse_llm_json

# Re-use the project's existing LLM wiring
from agents.base_agent import BaseAgent


# ────────────────────────── SRG Summarizer ────────────────────────────────

def summarize_srg(srg) -> dict:
    """
    Extract a compact, LLM-friendly summary from a SecurityReasoningGraph.
    Keeps token count low while preserving the information an auditor needs.
    """
    from srg.graph import NodeType, EdgeType

    summary = srg.summary()

    # Top contracts: those with the most HAS_FUNCTION edges
    contract_nodes = srg.nodes_by_type(NodeType.CONTRACT)
    contract_scores = []
    for c in contract_nodes:
        fn_count = len(srg.successors(c.id, EdgeType.HAS_FUNCTION))
        state_count = len(srg.successors(c.id, EdgeType.HAS_STATE))
        contract_scores.append({
            "name": c.name,
            "type": c.metadata.get("type", "contract"),
            "functions": fn_count,
            "state_variables": state_count,
            "inherits": c.metadata.get("inherits", []),
        })
    contract_scores.sort(key=lambda x: x["functions"], reverse=True)

    # Top functions: those with the most outgoing edges (calls, reads, writes, external)
    function_nodes = srg.nodes_by_type(NodeType.FUNCTION)
    function_scores = []
    for f in function_nodes:
        calls = len(srg.successors(f.id, EdgeType.CALLS))
        reads = len(srg.successors(f.id, EdgeType.READS))
        writes = len(srg.successors(f.id, EdgeType.WRITES))
        ext = len(srg.successors(f.id, EdgeType.EXTERNAL_CALL))
        score = calls * 2 + reads + writes * 3 + ext * 5  # weighted importance
        function_scores.append({
            "name": f.name,
            "contract": f.metadata.get("contract", ""),
            "visibility": f.metadata.get("visibility", ""),
            "calls": calls,
            "reads": reads,
            "writes": writes,
            "external_calls": ext,
            "risk_score": score,
        })
    function_scores.sort(key=lambda x: x["risk_score"], reverse=True)

    # External calls (deduplicated targets)
    ext_edges = srg.edges_by_type(EdgeType.EXTERNAL_CALL)
    external_calls = []
    seen = set()
    for e in ext_edges:
        if e.target not in seen:
            seen.add(e.target)
            source_node = srg.nodes.get(e.source)
            external_calls.append({
                "from": source_node.name if source_node else e.source,
                "target": e.target,
                "subtype": e.metadata.get("subtype", "unknown"),
            })

    # State variables with most writers (high-risk state)
    state_nodes = srg.nodes_by_type(NodeType.STATE)
    risky_state = []
    for s in state_nodes:
        writers = len(srg.find_state_writers(s.id))
        readers = len(srg.find_state_readers(s.id))
        if writers > 0:
            risky_state.append({
                "name": s.name,
                "contract": s.metadata.get("contract", ""),
                "writers": writers,
                "readers": readers,
            })
    risky_state.sort(key=lambda x: x["writers"], reverse=True)

    return {
        "contracts": contract_scores[:20],
        "top_functions": function_scores[:25],
        "external_calls": external_calls,
        "risky_state_variables": risky_state[:15],
        "relationships_summary": summary.get("edge_breakdown", {}),
        "totals": {
            "contracts": summary["contracts"],
            "functions": summary["functions"],
            "states": summary["states"],
            "edges": summary["edges"],
        },
    }


# ────────────────────────── LLM Prompt ────────────────────────────────────

PLANNER_SYSTEM_PROMPT = """You are a senior smart contract security researcher with 10+ years of experience auditing DeFi protocols.

You are given a STRUCTURAL ANALYSIS of a smart contract protocol derived from its Security Reasoning Graph (SRG). This analysis includes contract topology, function connectivity, state variable access patterns, and external call surfaces.

Your task is to:

1. **Identify the protocol type** (AMM, lending, staking, governance, bridge, perpetuals, vesting, marketplace, hybrid, or other)
2. **Identify key components** — which contracts hold funds, manage access, or perform critical logic
3. **Identify attack surfaces** — based on external calls, state writes, access control patterns, and common DeFi vulnerabilities
4. **Generate a prioritized security testing plan** — ordered by severity/likelihood, focusing on what a real attacker would target first

Think like an attacker. Prioritize:
- Functions with high write counts (state manipulation)
- External calls (reentrancy, return value checks)
- Functions with no access control modifiers
- Cross-contract interactions (trust boundaries)
- Value transfer paths (token flows, ETH transfers)

You MUST return ONLY valid JSON in this exact structure:

{
  "protocol_type": "string (e.g. 'vesting_marketplace', 'lending', 'amm')",
  "confidence": 0.0-1.0,
  "key_components": [
    {"name": "ContractName", "role": "brief description of role"}
  ],
  "attack_surfaces": [
    "description of attack surface"
  ],
  "plan": [
    {
      "priority": 1,
      "target": "ContractName.functionName",
      "action": "what to test",
      "reason": "why this is high priority"
    }
  ]
}

Return ONLY the JSON object. No markdown, no explanation, no code fences."""


# ────────────────────────── Planner Agent ─────────────────────────────────

class _PlannerAgent(BaseAgent):
    """Thin agent wrapper so we can re-use BaseAgent's call_llm."""

    def __init__(self, model: str | None = None):
        super().__init__(
            name="Planner",
            role="Security analysis planner",
            skill_keys=[],
            model=model,
        )

    async def run(self, context: dict) -> dict:
        # Not used directly; we call call_llm from Planner
        return {}


class Planner:
    """
    Phase 2 LLM-Powered Security Planner.

    Usage:
        planner = Planner()
        plan = await planner.create_plan(srg, api_key=key)
    """

    def __init__(self, model: str | None = None):
        self.model = model or os.environ.get("SRP_MODEL", "meta/llama-3.1-405b-instruct")
        self._agent = _PlannerAgent(model=self.model)

    async def create_plan(self, srg, api_key: str | None = None) -> dict:
        """
        Summarise the SRG, send to the LLM, parse and validate the plan.
        """
        # 1. Summarize
        srg_summary = summarize_srg(srg)

        # 2. Build user message
        user_message = (
            "Here is the structural analysis of the smart contract protocol:\n\n"
            f"```json\n{json.dumps(srg_summary, indent=2)}\n```\n\n"
            "Analyze this protocol and return your security testing plan as JSON."
        )

        messages = [{"role": "user", "content": user_message}]

        # 3. Call LLM
        raw = await self._agent.call_llm(
            system_extra=PLANNER_SYSTEM_PROMPT,
            messages=messages,
            api_key=api_key,
            max_tokens=4096,
        )

        # 4. Parse & validate
        plan = self._parse_plan(raw, srg_summary)

        # 5. Log
        self._agent.log_step("plan_created", {
            "protocol_type": plan.get("protocol_type"),
            "confidence": plan.get("confidence"),
            "attack_surfaces": len(plan.get("attack_surfaces", [])),
            "plan_steps": len(plan.get("plan", [])),
        })

        return plan

    def _parse_plan(self, raw: str, srg_summary: dict) -> dict:
        """Extract JSON from LLM response with standardized robust parsing."""
        parsed = parse_llm_json(raw)
        
        if parsed and isinstance(parsed, dict) and "protocol_type" in parsed and "plan" in parsed:
            return parsed

        # Fallback if parsing fails or structure is incorrect
        return self._rule_based_fallback(srg_summary)

    def _rule_based_fallback(self, srg_summary: dict) -> dict:
        """Rule-based fallback if LLM fails, using function signatures."""
        funcs = ""
        for f in srg_summary.get("top_functions", []):
            funcs += str(f.get("name", "")).lower() + " "
            
        protocol = "unknown"
        if any(kw in funcs for kw in ["swap", "addliquidity", "removeliquidity"]):
            protocol = "amm"
        elif any(kw in funcs for kw in ["borrow", "repay", "liquidate"]):
            protocol = "lending"
        elif any(kw in funcs for kw in ["stake", "unstake", "reward"]):
            protocol = "staking"
        elif any(kw in funcs for kw in ["vote", "proposal", "governance"]):
            protocol = "governance"

        return {
            "protocol_type": protocol,
            "confidence": 0.4,
            "attack_surfaces": ["LLM failed — using rule-based fallback"],
            "plan": [
                {
                    "priority": 1,
                    "target": "all_contracts",
                    "action": "automated security review",
                    "reason": "fallback plan triggered",
                }
            ],
            "fallback": True,
            "error": "llm_failed"
        }
