"""
InterestRateAuditor — Specialized agent for lending protocol interest rate vulnerabilities.

Threat model: interest accrual ordering bugs, index manipulation, rate model abuse,
stale index exploitation, rapid borrow/repay rate gaming.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from uuid import uuid4

from srp.agents.base_agent import BaseAgent


class InterestRateAuditor(BaseAgent):
    """Audits interest rate mechanics in lending protocols for exploitable flaws."""

    def __init__(self, model: str = "meta/llama-3.1-405b-instruct") -> None:
        super().__init__(
            name="InterestRateAuditor",
            role="Lending domain specialist — audits interest rate mechanics for ordering bugs and index manipulation",
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
        """Run interest rate-focused audit on the lending protocol.

        Args:
            context: Pipeline context with contract_map, recon_output, protocol_intent, etc.

        Returns:
            Dict with 'vulnerabilities' list in standard finding schema.
        """
        self.log_step("interest_rate_audit_started", {"context_keys": list(context.keys())})

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

You are INTEREST RATE AUDITOR — a specialist in lending protocol interest rate vulnerabilities.

Your SOLE focus: find exploitable flaws in interest accrual, index calculations, and rate models.

{invariant_context}

Specific checks you MUST perform:
1. ACCRUAL ORDERING: Is accrueInterest() called BEFORE every state change? Check: borrow(), repay(), deposit(), withdraw(), liquidate(), transfer(). If accrual happens AFTER a state change, stale indexes allow value extraction.
2. INDEX MANIPULATION: Can supply/borrow indexes be manipulated within a single block? Check: time-weighted calculations, minimum time between updates, flash loan combined with index-dependent operations.
3. RATE MODEL ABUSE: Can utilization rate be rapidly cycled (borrow→repay→borrow) to create interest rate spikes that cascade into liquidations of other users?
4. EXCHANGE RATE ATTACK: Can the first depositor manipulate the exchange rate (cToken/aToken to underlying) via direct token transfer before minting? Check: virtual shares offset, minimum deposit requirement.
5. RESERVE FACTOR: Is reserve accumulation calculated correctly? Can reserves be drained through math errors or missing access control?
6. INTEREST ROUNDING: Does interest rounding always favor the protocol? Check all division operations in interest calculations for rounding direction.
7. COMPOUND INTEREST vs SIMPLE: Is compound interest calculated correctly across blocks? Are there edge cases where interest is double-counted or skipped?
8. TOKEN TRANSFER HOOKS: Does transferring interest-bearing tokens (cTokens, aTokens) correctly accrue interest first?

Entry points detected: {json.dumps(entry_points)[:3000]}

Return ONLY valid JSON:
{{
  "vulnerabilities": [
    {{
      "id": "LEND-INT-001",
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
        self.log_step("interest_rate_audit_prompt_built", {"prompt_chars": len(system_prompt) + len(user_payload)})

        raw_response = await self.call_llm(
            system_extra=system_prompt,
            messages=messages,
            api_key=context.get("api_key"),
            max_tokens=4096,
            timeout=120.0,
        )
        self.log_step("interest_rate_audit_llm_response", {"response_chars": len(raw_response)})

        parsed = self._parse_response(raw_response)
        vulnerabilities = self._normalize_findings(parsed.get("vulnerabilities", []))

        self.log_step("interest_rate_audit_completed", {"finding_count": len(vulnerabilities)})
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
                "id": str(f.get("id", f"LEND-INT-{idx:03d}")),
                "title": str(f.get("title", "Untitled")).strip(),
                "severity": severity,
                "contract": str(f.get("contract", "")).strip(),
                "description": str(f.get("description", "")).strip(),
                "vuln_code": str(f.get("vuln_code", "")).strip(),
                "fix_code": str(f.get("fix_code", "")).strip(),
                "exploit_code": str(f.get("exploit_code", "")).strip(),
            })

        return normalized
