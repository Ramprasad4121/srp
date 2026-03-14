"""
InsuranceFundAnalyzer — Analyzes insurance fund solvency and ADL triggers.

Checks: depletion, socialized loss, ADL ordering.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from agents.base_agent import BaseAgent


class InsuranceFundAnalyzer(BaseAgent):
    """Analyzes insurance fund and ADL mechanics."""

    def __init__(self, model: str = "meta/llama-3.1-405b-instruct") -> None:
        super().__init__(
            name="InsuranceFundAnalyzer",
            role="Perpetuals specialist — analyzes insurance fund",
            skill_keys=["audit-firm-1-solidity-auditor"],
            model=model,
        )
        self.perpetuals_skill = self._load_skill()

    def _load_skill(self) -> str:
        skill_path = Path(__file__).resolve().parents[3] / "skills" / "domains" / "perpetuals.md"
        if skill_path.is_file():
            return skill_path.read_text(encoding="utf-8")
        return ""

    async def run(self, context: dict) -> dict:
        self.log_step("insurance_fund_audit_started", {})

        contract_map = context.get("contract_map", {})
        if isinstance(contract_map, dict):
            source = "\n".join(f"--- {n} ---\n{c[:5000]}" for n, c in contract_map.items())
        else:
            source = str(contract_map)[:10000]

        system = f"""{self.perpetuals_skill}

You are INSURANCE FUND ANALYZER. Focus on:
1. Insurance fund depletion scenarios
2. Socialized loss triggering
3. ADL (auto-deleveraging) ordering fairness
4. Fund topping mechanism (fees)
5. Maximum exposure per liquidation

Return JSON: {{"vulnerabilities": [{{"id": "PERP-INSURANCE-001", "title": "...", "severity": "high|medium|low", "description": "...", "contract": "...", "vuln_code": "...", "fix_code": "...", "exploit_code": "..."}}]}}"""

        user = json.dumps({"CONTRACT_CODE": source[:15000]})
        raw = await self.call_llm(system_extra=system, messages=[{"role": "user", "content": user}],
                                   api_key=context.get("api_key"), max_tokens=4096, timeout=120.0)

        from core.utils import parse_llm_json
        parsed = parse_llm_json(raw)
        vulns = self._normalize(parsed.get("vulnerabilities", []))
        self.log_step("insurance_fund_audit_completed", {"count": len(vulns)})
        return {"vulnerabilities": vulns}

    def _normalize(self, findings: Any) -> list[dict]:
        if not isinstance(findings, list):
            return []
        normalized = []
        for idx, f in enumerate(findings, 1):
            if not isinstance(f, dict):
                continue
            sev = str(f.get("severity", "medium")).lower()
            if sev not in {"critical", "high", "medium", "low"}:
                sev = "medium"
            normalized.append({
                "id": str(f.get("id", f"PERP-INSURANCE-{idx:03d}")),
                "title": str(f.get("title", "Untitled")),
                "severity": sev,
                "contract": str(f.get("contract", "")),
                "description": str(f.get("description", "")),
                "vuln_code": str(f.get("vuln_code", "")),
                "fix_code": str(f.get("fix_code", "")),
                "exploit_code": str(f.get("exploit_code", "")),
            })
        return normalized
