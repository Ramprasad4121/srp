"""
VoteManipulationHunter — Finds flash loan voting, delegation attacks, vote buying.

Checks: flash loan voting, delegation timing, checkpoint manipulation.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from agents.base_agent import BaseAgent


class VoteManipulationHunter(BaseAgent):
    """Hunts for vote manipulation vectors."""

    def __init__(self, model: str = "meta/llama-3.1-405b-instruct") -> None:
        super().__init__(
            name="VoteManipulationHunter",
            role="Governance specialist — hunts vote manipulation",
            skill_keys=["audit-firm-1-solidity-auditor"],
            model=model,
        )
        self.governance_skill = self._load_skill()

    def _load_skill(self) -> str:
        skill_path = Path(__file__).resolve().parents[3] / "skills" / "domains" / "governance.md"
        if skill_path.is_file():
            return skill_path.read_text(encoding="utf-8")
        return ""

    async def run(self, context: dict) -> dict:
        self.log_step("vote_manipulation_audit_started", {})

        contract_map = context.get("contract_map", {})
        if isinstance(contract_map, dict):
            source = "\n".join(f"--- {n} ---\n{c[:5000]}" for n, c in contract_map.items())
        else:
            source = str(contract_map)[:10000]

        system = f"""{self.governance_skill}

You are VOTE MANIPULATION HUNTER. Focus on:
1. Flash loan voting (acquire tokens, vote, repay in same block)
2. Delegation attacks (delegate, vote, undelegate)
3. Checkpoint manipulation
4. Vote buying / selling votes
5. Vote delegation stacking

Return JSON: {{"vulnerabilities": [{{"id": "GOV-VOTE-001", "title": "...", "severity": "high|medium|low", "description": "...", "contract": "...", "vuln_code": "...", "fix_code": "...", "exploit_code": "..."}}]}}"""

        user = json.dumps({"CONTRACT_CODE": source[:15000]})
        raw = await self.call_llm(system_extra=system, messages=[{"role": "user", "content": user}],
                                   api_key=context.get("api_key"), max_tokens=4096, timeout=120.0)

        from core.utils import parse_llm_json
        parsed = parse_llm_json(raw)
        vulns = self._normalize(parsed.get("vulnerabilities", []))
        self.log_step("vote_manipulation_audit_completed", {"count": len(vulns)})
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
                "id": str(f.get("id", f"GOV-VOTE-{idx:03d}")),
                "title": str(f.get("title", "Untitled")),
                "severity": sev,
                "contract": str(f.get("contract", "")),
                "description": str(f.get("description", "")),
                "vuln_code": str(f.get("vuln_code", "")),
                "fix_code": str(f.get("fix_code", "")),
                "exploit_code": str(f.get("exploit_code", "")),
            })
        return normalized
