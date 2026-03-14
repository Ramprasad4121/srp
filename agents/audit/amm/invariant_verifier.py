"""
InvariantVerifier — Specialized agent for AMM invariant verification.

Threat model: x*y=k violation, rounding errors, invariant drift
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from agents.base_agent import BaseAgent


class InvariantVerifier(BaseAgent):
    """Verifies AMM invariants are correctly maintained."""

    def __init__(self, model: str = "meta/llama-3.1-405b-instruct") -> None:
        super().__init__(
            name="InvariantVerifier",
            role="AMM specialist — verifies x*y=k invariants",
            skill_keys=["audit-firm-1-solidity-auditor"],
            model=model,
        )
        self.amm_skill = self._load_amm_skill()

    def _load_amm_skill(self) -> str:
        """Load the AMM domain skill file."""
        skill_path = Path(__file__).resolve().parents[3] / "skills" / "domains" / "amm.md"
        if skill_path.is_file():
            return skill_path.read_text(encoding="utf-8")
        return ""

    async def run(self, context: dict) -> dict:
        """Run invariant verification on the AMM protocol."""
        self.log_step("amm_invariant_verification_started", {"context_keys": list(context.keys())})

        contract_map = context.get("contract_map", {})
        recon_output = context.get("recon_output", {})
        protocol_intent = context.get("protocol_intent", {})

        # Build contract source summary
        if isinstance(contract_map, dict):
            contract_source = "\n".join(
                f"--- {name} ---\n{code[:5000]}" for name, code in contract_map.items()
            )
        else:
            contract_source = str(contract_map)[:10000]

        system_prompt = f"""{self.amm_skill}

You are INVARIANT VERIFIER — verify AMM invariants are correctly implemented.

Your SOLE focus: verify x*y=k and related invariants hold after all operations.

Specific checks you MUST perform:
1. SWAP INVARIANT: After swap, x*y should not decrease (fees aside)
2. LIQUIDITY INVARIANT: LP token mint/burn proportional to liquidity
3. ROUNDING: All calculations round in protocol's favor
4. BALANCE CHECKS: Stored reserves match actual token balances
5. FEE ACCOUNTING: Fees don't break the invariant

Return ONLY valid JSON:
{{
  "vulnerabilities": [
    {{
      "id": "AMM-INV-001",
      "title": "string",
      "severity": "high|medium|low",
      "contract": "contract name",
      "description": "detailed description",
      "vuln_code": "vulnerable code",
      "fix_code": "fixed code",
      "exploit_code": "exploit test"
    }}
  ]
}}
"""
        user_payload = json.dumps({"CONTRACT_CODE": contract_source[:15000]}, indent=2, default=str)
        if len(user_payload) > 15000:
            user_payload = user_payload[:15000] + "\n...[TRUNCATED]..."

        messages = [{"role": "user", "content": user_payload}]

        raw_response = await self.call_llm(
            system_extra=system_prompt,
            messages=messages,
            api_key=context.get("api_key"),
            max_tokens=4096,
            timeout=120.0,
        )

        parsed = self._parse_response(raw_response)
        vulnerabilities = self._normalize_findings(parsed.get("vulnerabilities", []))

        self.log_step("amm_invariant_verification_completed", {"finding_count": len(vulnerabilities)})
        return {"vulnerabilities": vulnerabilities}

    def _parse_response(self, raw: str) -> dict:
        from core.utils import parse_llm_json
        return parse_llm_json(raw)

    def _normalize_findings(self, findings: Any) -> list[dict]:
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
                "id": str(f.get("id", f"AMM-INV-{idx:03d}")),
                "title": str(f.get("title", "Untitled")).strip(),
                "severity": severity,
                "contract": str(f.get("contract", "")).strip(),
                "description": str(f.get("description", "")).strip(),
                "vuln_code": str(f.get("vuln_code", "")).strip(),
                "fix_code": str(f.get("fix_code", "")).strip(),
                "exploit_code": str(f.get("exploit_code", "")).strip(),
            })
        return normalized
