"""
BadDebtAuditor — Specialized agent for lending protocol bad debt vulnerabilities.

Threat model: underwater positions, socialized losses, dust attacks, insolvency spirals,
shortfall handling, reserve depletion.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from uuid import uuid4

from agents.base_agent import BaseAgent


class BadDebtAuditor(BaseAgent):
    """Audits lending protocols for bad debt accumulation and insolvency risk."""

    def __init__(self, model: str = "meta/llama-3.1-405b-instruct") -> None:
        super().__init__(
            name="BadDebtAuditor",
            role="Lending domain specialist — audits for bad debt accumulation, insolvency spirals, and socialized losses",
            skill_keys=["audit-firm-1-solidity-auditor"],
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
        """Run bad debt-focused audit on the lending protocol.

        Args:
            context: Pipeline context with contract_map, recon_output, protocol_intent, etc.

        Returns:
            Dict with 'vulnerabilities' list in standard finding schema.
        """
        self.log_step("bad_debt_audit_started", {"context_keys": list(context.keys())})

        contract_map = context.get("contract_map", {})
        recon_output = context.get("recon_output", {})
        protocol_intent = context.get("protocol_intent", {})
        entry_points = recon_output.get("entry_points", {})

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

You are BAD DEBT AUDITOR — a specialist in lending protocol insolvency and bad debt accumulation.

Your SOLE focus: find scenarios where the protocol can accumulate bad debt or become insolvent.

{invariant_context}

Specific checks you MUST perform:
1. UNDERWATER POSITIONS: What happens when a position's collateral value drops below its debt? Is there a mechanism to socialize or absorb the loss? If not, bad debt accumulates silently.
2. LIQUIDATION INCENTIVE ECONOMICS: Is the liquidation bonus sufficient to incentivize liquidators even during extreme volatility? If not, positions go unliquidated and bad debt grows.
3. DUST POSITIONS: Can an attacker create many tiny positions (dust) that are individually unprofitable to liquidate? These accumulate bad debt that no one cleans up.
4. CASCADING LIQUIDATIONS: During a market crash, can liquidations of one asset trigger price drops that cascade into more liquidations (death spiral)?
5. SHORTFALL HANDLING: When bad debt occurs, how is it handled? Is it subtracted from reserves? Socialized across suppliers? Left as a silent hole in the accounting?
6. RESERVE DEPLETION: Can bad debt exceed protocol reserves? What happens then? Is there a backstop or insurance mechanism?
7. ISOLATED vs SHARED MARKETS: In shared-pool designs (Compound-style), can bad debt in one market affect depositors in another market?
8. BORROW CAP ENFORCEMENT: Are borrow caps enforced per-asset and per-user? Without caps, a single large position going underwater can create outsized bad debt.
9. TOKEN-SPECIFIC RISKS: Low-liquidity tokens, rebasing tokens, fee-on-transfer tokens — can these tokens create accounting mismatches that lead to hidden bad debt?
10. INSOLVENCY DETECTION: Does the protocol have on-chain detection for insolvency? Can governance respond quickly enough?

Entry points detected: {json.dumps(entry_points)[:3000]}

Return ONLY valid JSON:
{{
  "vulnerabilities": [
    {{
      "id": "LEND-BD-001",
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
        self.log_step("bad_debt_audit_prompt_built", {"prompt_chars": len(system_prompt) + len(user_payload)})

        raw_response = await self.call_llm(
            system_extra=system_prompt,
            messages=messages,
            api_key=context.get("api_key"),
            max_tokens=4096,
            timeout=120.0,
        )
        self.log_step("bad_debt_audit_llm_response", {"response_chars": len(raw_response)})

        parsed = self._parse_response(raw_response)
        vulnerabilities = self._normalize_findings(parsed.get("vulnerabilities", []))

        self.log_step("bad_debt_audit_completed", {"finding_count": len(vulnerabilities)})
        return {"vulnerabilities": vulnerabilities}

    def _parse_response(self, raw: str) -> dict:
        """Parse LLM JSON response."""
        from core.utils import parse_llm_json
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
                "id": str(f.get("id", f"LEND-BD-{idx:03d}")),
                "title": str(f.get("title", "Untitled")).strip(),
                "severity": severity,
                "contract": str(f.get("contract", "")).strip(),
                "description": str(f.get("description", "")).strip(),
                "vuln_code": str(f.get("vuln_code", "")).strip(),
                "fix_code": str(f.get("fix_code", "")).strip(),
                "exploit_code": str(f.get("exploit_code", "")).strip(),
            })

        return normalized
