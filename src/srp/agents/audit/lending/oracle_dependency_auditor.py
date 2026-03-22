"""
OracleDependencyAuditor — Specialized agent for lending protocol oracle vulnerabilities.

Threat model: stale prices, zero/negative price, no fallback, TWAP manipulation,
decimal mismatch, sequencer downtime, oracle front-running.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from uuid import uuid4

from srp.agents.base_agent import BaseAgent


class OracleDependencyAuditor(BaseAgent):
    """Audits oracle dependencies in lending protocols for price manipulation and staleness flaws."""

    def __init__(self, model: str = "meta/llama-3.1-405b-instruct") -> None:
        super().__init__(
            name="OracleDependencyAuditor",
            role="Lending domain specialist — audits oracle dependencies for price manipulation and staleness",
            skill_keys=["audit-firm-1-solidity-auditor", "quillai-oracle-flashloan"],
            model=model,
        )
        self.lending_skill = self._load_lending_skill()

    def _load_lending_skill(self) -> str:
        """Load the lending domain skill file."""
        skill_path = Path(__file__).resolve().parents[3] / "skills" / "domains" / "lending.md"
        if skill_path.is_file():
            return skill_path.read_text(encoding="utf-8")
        return ""

    async def run(self, context: dict) -> dict:
        """Run oracle-focused audit on the lending protocol.

        Args:
            context: Pipeline context with contract_map, recon_output, protocol_intent, etc.

        Returns:
            Dict with 'vulnerabilities' list in standard finding schema.
        """
        self.log_step("oracle_audit_started", {"context_keys": list(context.keys())})

        contract_map = context.get("contract_map", {})
        recon_output = context.get("recon_output", {})
        protocol_intent = context.get("protocol_intent", {})
        entry_points = recon_output.get("entry_points", {})
        external_calls = recon_output.get("external_calls", [])

        if isinstance(contract_map, dict):
            contract_source = "\n".join(
                f"--- {name} ---\n{code[:5000]}" for name, code in contract_map.items()
            )
        else:
            contract_source = str(contract_map)[:10000]

        invariant_context = ""
        if isinstance(protocol_intent, dict):
            invariants = protocol_intent.get("invariants", [])
            if invariants:
                invariant_context = "Protocol-declared invariants:\n" + "\n".join(
                    f"- {inv.get('id', 'N/A')}: {inv.get('description', '')}" for inv in invariants
                )

        system_prompt = f"""
{self.lending_skill}

You are ORACLE DEPENDENCY AUDITOR — a specialist in oracle manipulation and price feed vulnerabilities.

Your SOLE focus: find exploitable flaws in how the protocol depends on price oracles.

{invariant_context}

External calls detected (may include oracle calls): {json.dumps(external_calls)[:2000]}

Specific checks you MUST perform:
1. STALENESS CHECK MISSING: Does the protocol check `updatedAt` from Chainlink's `latestRoundData()`? Is the staleness threshold reasonable (< 1 hour for volatile assets, < 24 hours for stables)?
2. ZERO/NEGATIVE PRICE: Does the protocol check `answer > 0`? What happens if the oracle returns 0 or a negative value?
3. NO FALLBACK: If the primary oracle fails (reverts, returns stale data), is there a fallback oracle? Does the fallback activate correctly?
4. DECIMAL MISMATCH: Are oracle prices correctly normalized to the expected decimals? Check: Chainlink feeds return 8 decimals for USD pairs, 18 for ETH pairs. Does the protocol handle both?
5. TWAP MANIPULATION: If using on-chain TWAP (Uniswap V3), can it be manipulated via large swaps? What's the TWAP window? Is it long enough to resist single-block manipulation?
6. L2 SEQUENCER: On L2s (Arbitrum, Optimism), does the protocol check sequencer uptime? Stale prices during sequencer downtime can lead to incorrect liquidations.
7. ORACLE FRONT-RUNNING: Can an attacker observe an oracle update in the mempool and front-run it to exploit the price change?
8. ROUND COMPLETENESS: Does the protocol check `answeredInRound >= roundId` to ensure the round is complete?
9. MULTI-ORACLE DIVERGENCE: If using multiple oracles, what happens when they diverge significantly? Is there a circuit breaker?
10. PRICE NORMALIZATION: When comparing collateral price to debt price, are both normalized to the same base (e.g., USD)?

Entry points detected: {json.dumps(entry_points)[:3000]}

Return ONLY valid JSON:
{{
  "vulnerabilities": [
    {{
      "id": "LEND-ORC-001",
      "title": "string — specific vulnerability title",
      "severity": "critical|high|medium|low",
      "contract": "contract name",
      "description": "detailed description of the vulnerability and how to exploit it",
      "vuln_code": "the vulnerable code snippet",
      "fix_code": "the fixed code snippet",
      "exploit_code": "complete Foundry test exploit"
    }}
  ]
}}
"""
        user_payload = json.dumps(
            {"CONTRACT_CODE": contract_source[:15000]},
            indent=2,
            default=str,
        )
        if len(user_payload) > 15000:
            user_payload = user_payload[:15000] + "\n...[TRUNCATED]..."

        messages = [{"role": "user", "content": user_payload}]
        self.log_step("oracle_audit_prompt_built", {"prompt_chars": len(system_prompt) + len(user_payload)})

        raw_response = await self.call_llm(
            system_extra=system_prompt,
            messages=messages,
            api_key=context.get("api_key"),
            max_tokens=4096,
            timeout=120.0,
        )
        self.log_step("oracle_audit_llm_response", {"response_chars": len(raw_response)})

        parsed = self._parse_response(raw_response)
        vulnerabilities = self._normalize_findings(parsed.get("vulnerabilities", []))

        self.log_step("oracle_audit_completed", {"finding_count": len(vulnerabilities)})
        return {"vulnerabilities": vulnerabilities}

    def _parse_response(self, raw: str) -> dict:
        """Parse LLM JSON response."""
        from srp.core.utils import parse_llm_json
        return parse_llm_json(raw)

    def _normalize_findings(self, findings: Any) -> list[dict]:
        """Normalize findings to standard schema."""
        if not isinstance(findings, list):
            return []

        normalized: list[dict] = []
        for idx, f in enumerate(findings, start=1):
            if not isinstance(f, dict):
                continue

            severity = str(f.get("severity", "medium")).strip().lower()
            if severity not in {"critical", "high", "medium", "low"}:
                severity = "medium"

            normalized.append({
                "id": str(f.get("id", f"LEND-ORC-{idx:03d}")),
                "title": str(f.get("title", "Untitled")).strip(),
                "severity": severity,
                "contract": str(f.get("contract", "")).strip(),
                "description": str(f.get("description", "")).strip(),
                "vuln_code": str(f.get("vuln_code", "")).strip(),
                "fix_code": str(f.get("fix_code", "")).strip(),
                "exploit_code": str(f.get("exploit_code", "")).strip(),
            })

        return normalized
