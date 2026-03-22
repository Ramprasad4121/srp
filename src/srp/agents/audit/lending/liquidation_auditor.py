"""
LiquidationAuditor — Specialized agent for lending protocol liquidation vulnerabilities.

Threat model: liquidation threshold bypass, bonus overflow, self-liquidation,
partial liquidation edge cases, liquidation front-running.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from uuid import uuid4

from srp.agents.base_agent import BaseAgent


class LiquidationAuditor(BaseAgent):
    """Audits liquidation logic in lending protocols for exploitable flaws."""

    def __init__(self, model: str = "meta/llama-3.1-405b-instruct") -> None:
        super().__init__(
            name="LiquidationAuditor",
            role="Lending domain specialist — audits liquidation mechanics for exploitable flaws",
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
        """Run liquidation-focused audit on the lending protocol.

        Args:
            context: Pipeline context with contract_map, recon_output, protocol_intent, etc.

        Returns:
            Dict with 'vulnerabilities' list in standard finding schema.
        """
        self.log_step("liquidation_audit_started", {"context_keys": list(context.keys())})

        contract_map = context.get("contract_map", {})
        recon_output = context.get("recon_output", {})
        protocol_intent = context.get("protocol_intent", {})
        entry_points = recon_output.get("entry_points", {})

        # Build contract source summary
        if isinstance(contract_map, dict):
            contract_source = "\n".join(
                f"--- {name} ---\n{code[:5000]}" for name, code in contract_map.items()
            )
        else:
            contract_source = str(contract_map)[:10000]

        # Build invariant context from protocol intent
        invariant_context = ""
        if isinstance(protocol_intent, dict):
            invariants = protocol_intent.get("invariants", [])
            if invariants:
                invariant_context = "Protocol-declared invariants:\n" + "\n".join(
                    f"- {inv.get('id', 'N/A')}: {inv.get('description', '')}" for inv in invariants
                )

        system_prompt = f"""
{self.lending_skill}

You are LIQUIDATION AUDITOR — a specialist in lending protocol liquidation vulnerabilities.

Your SOLE focus: find exploitable flaws in liquidation mechanics.

{invariant_context}

Specific checks you MUST perform:
1. THRESHOLD BYPASS: Can an attacker manipulate collateral factor or liquidation threshold to avoid liquidation?
2. BONUS OVERFLOW: Can liquidation bonus exceed the available collateral, creating bad debt?
3. SELF-LIQUIDATION: Can a user liquidate their own position to extract the bonus?
4. PARTIAL LIQUIDATION: Does partial liquidation handle rounding correctly? Can repeated partial liquidations drain more than intended?
5. CLOSE FACTOR: Is the close factor enforced? Can an attacker liquidate more than the allowed percentage?
6. HEALTH FACTOR MANIPULATION: Can health factor be manipulated within a single transaction (flash loan + deposit + borrow + liquidate)?
7. LIQUIDATION ORDERING: If multiple positions are underwater, can the liquidation order be gamed?
8. DUST POSITIONS: Can tiny positions be created that are unprofitable to liquidate, accruing bad debt?

Entry points detected: {json.dumps(entry_points)[:3000]}

Return ONLY valid JSON:
{{
  "vulnerabilities": [
    {{
      "id": "LEND-LIQ-001",
      "title": "string — specific vulnerability title",
      "severity": "critical|high|medium|low",
      "contract": "contract name",
      "description": "detailed description of the vulnerability and how to exploit it",
      "vuln_code": "the vulnerable code snippet",
      "fix_code": "the fixed code snippet",
      "exploit_code": "complete Foundry test exploit — use vm.startPrank(attacker), call the vulnerable function, assert impact"
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
        self.log_step("liquidation_audit_prompt_built", {"prompt_chars": len(system_prompt) + len(user_payload)})

        raw_response = await self.call_llm(
            system_extra=system_prompt,
            messages=messages,
            api_key=context.get("api_key"),
            max_tokens=4096,
            timeout=120.0,
        )
        self.log_step("liquidation_audit_llm_response", {"response_chars": len(raw_response)})

        parsed = self._parse_response(raw_response)
        vulnerabilities = self._normalize_findings(parsed.get("vulnerabilities", []))

        self.log_step("liquidation_audit_completed", {"finding_count": len(vulnerabilities)})
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
                "id": str(f.get("id", f"LEND-LIQ-{idx:03d}")),
                "title": str(f.get("title", "Untitled")).strip(),
                "severity": severity,
                "contract": str(f.get("contract", "")).strip(),
                "description": str(f.get("description", "")).strip(),
                "vuln_code": str(f.get("vuln_code", "")).strip(),
                "fix_code": str(f.get("fix_code", "")).strip(),
                "exploit_code": str(f.get("exploit_code", "")).strip(),
            })

        return normalized
