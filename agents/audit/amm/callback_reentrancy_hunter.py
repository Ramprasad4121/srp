"""
CallbackReentrancyHunter — Specialized agent for AMM callback reentrancy.

Threat model: uniswapV3SwapCallback, uniswapV2Call, flashLoan callback exploits
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from agents.base_agent import BaseAgent


class CallbackReentrancyHunter(BaseAgent):
    """Hunts reentrancy via AMM callbacks."""

    def __init__(self, model: str = "meta/llama-3.1-405b-instruct") -> None:
        super().__init__(
            name="CallbackReentrancyHunter",
            role="AMM specialist — hunts callback reentrancy",
            skill_keys=["audit-firm-1-solidity-auditor"],
            model=model,
        )
        self.amm_skill = self._load_amm_skill()

    def _load_amm_skill(self) -> str:
        skill_path = Path(__file__).resolve().parents[3] / "skills" / "domains" / "amm.md"
        if skill_path.is_file():
            return skill_path.read_text(encoding="utf-8")
        return ""

    async def run(self, context: dict) -> dict:
        """Run callback reentrancy analysis."""
        self.log_step("amm_callback_reentrancy_started", {})

        contract_map = context.get("contract_map", {})

        if isinstance(contract_map, dict):
            contract_source = "\n".join(
                f"--- {name} ---\n{code[:5000]}" for name, code in contract_map.items()
            )
        else:
            contract_source = str(contract_map)[:10000]

        system_prompt = f"""{self.amm_skill}

You are CALLBACK REENTRANCY HUNTER — find reentrancy via swap callbacks.

Your SOLE focus: find reentrant call paths through swap callbacks.

Specific checks:
1. CEI PATTERN: Check-Effects-Interactions followed?
2. LOCKS: Reentrancy locks present?
3. CALLBACK HANDLING: Is callback executed safely?
4. ERC777/ERC223: Tokens with hooks handled?
5. FLASH LOANS: Can flash loans be exploited?

Look for: uniswapV3SwapCallback, uniswapV2Call, flashLoan callbacks

Return ONLY valid JSON with "vulnerabilities" array.
"""
        user_payload = json.dumps({"CONTRACT_CODE": contract_source[:15000]}, indent=2, default=str)

        raw_response = await self.call_llm(
            system_extra=system_prompt,
            messages=[{"role": "user", "content": user_payload}],
            api_key=context.get("api_key"),
            max_tokens=4096,
            timeout=120.0,
        )

        parsed = self._parse_response(raw_response)
        vulnerabilities = self._normalize_findings(parsed.get("vulnerabilities", []))

        self.log_step("amm_callback_reentrancy_completed", {"finding_count": len(vulnerabilities)})
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
            severity = str(f.get("severity", "high")).strip().lower()
            if severity not in {"critical", "high", "medium", "low"}:
                severity = "high"
            normalized.append({
                "id": str(f.get("id", f"AMM-REENT-{idx:03d}")),
                "title": f"Callback Reentrancy in {f.get('contract', 'Unknown')} allows fund extraction",
                "severity": severity,
                "contract": str(f.get("contract", "")).strip(),
                "description": str(f.get("description", "")).strip(),
                "vuln_code": str(f.get("vuln_code", "")).strip(),
                "fix_code": str(f.get("fix_code", "")).strip(),
                "exploit_code": str(f.get("exploit_code", "")).strip(),
            })
        return normalized
