"""
SoloditVerifier — Verifies if mapped Solodit findings actually exist in the current codebase.

Threat model: false positive mappings, context misunderstanding, pattern mismatch
"""
from __future__ import annotations

import json
from typing import Any

from srp.agents.base_agent import BaseAgent


class SoloditVerifier(BaseAgent):
    """Verifies Solodit findings against current codebase."""

    def __init__(self, model: str = "meta/llama-3.1-405b-instruct") -> None:
        super().__init__(
            name="SoloditVerifier",
            role="Solodit intelligence — verifies findings against current code",
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
        """Run Solodit verification phase.

        Args:
            context: Pipeline context with contract_map, recon_output, protocol_intent, etc.
            mapped_findings: List of findings from SoloditMapper

        Returns:
            Dict with 'confirmed_findings' list containing verified findings.
        """
        self.log_step("solodit_verification_started", {"context_keys": list(context.keys())})

        contract_map = context.get("contract_map", {})
        mapped_findings = context.get("mapped_findings", [])

        if not mapped_findings:
            return {"confirmed_findings": []}

        # Build contract source summary
        if isinstance(contract_map, dict):
            contract_source = "\n".join(
                f"--- {name} ---\n{code[:3000]}" for name, code in contract_map.items()
            )
        else:
            contract_source = str(contract_map)[:8000]

        # Verify each mapped finding
        confirmed_findings = []
        for mapped in mapped_findings:
            result = await self._verify_finding(mapped, contract_source)
            if result["confirmed"]:
                confirmed_findings.append({
                    **mapped["solodit_finding"],
                    "matching_functions": mapped["matching_functions"],
                    "confidence_score": mapped["confidence_score"],
                    "verification_confidence": result["confidence"],
                    "verification_notes": result["notes"],
                })

        self.log_step("solodit_verification_completed", {
            "confirmed_count": len(confirmed_findings),
            "total_mapped": len(mapped_findings),
        })
        return {"confirmed_findings": confirmed_findings}

    async def _verify_finding(self, mapped: dict, contract_source: str) -> dict:
        """Verify if a mapped finding actually exists in the code."""
        finding = mapped["solodit_finding"]
        matching_functions = mapped["matching_functions"]
        confidence = mapped["confidence_score"]

        # Build verification prompt
        prompt = f"""You are a Solodit VERIFIER — check if this specific Solodit finding exists in this codebase.

Finding Details:
- Title: {finding.get('title', '')}
- Description: {finding.get('description', '')[:200]}...
- Severity: {finding.get('severity', 'MEDIUM')}
- Solodit URL: {finding.get('solodit_url', '')}

Matching Functions Found:
"""

        for mf in matching_functions:
            prompt += f"- {mf['type']}: {mf['name']} (relevance: {mf['relevance']}%)
"

        prompt += f"""

Contract Context (first 2000 chars):
--- BEGIN CONTRACT CONTEXT ---
{contract_source[:2000]}
--- END CONTRACT CONTEXT ---

Does this Solodit finding actually exist in this codebase? Answer YES/NO with explanation.

Return JSON:
{{
  "confirmed": true/false,
  "confidence": 0-100,
  "notes": "explanation of why it exists or doesn't exist",
  "relevant_functions": ["list", "of", "matching", "functions"],
  "missing_context": "any context needed to confirm",
}}
"""

        # Call LLM for verification
        messages = [{"role": "user", "content": prompt}]
        raw_response = await self.call_llm(
            system_extra="",
            messages=messages,
            api_key=context.get("api_key"),
            max_tokens=4096,
            timeout=120.0,
        )

        # Parse response
        parsed = self._parse_response(raw_response)
        return {
            "confirmed": parsed.get("confirmed", False),
            "confidence": int(parsed.get("confidence", 50)),
            "notes": parsed.get("notes", ""),
            "relevant_functions": parsed.get("relevant_functions", []),
        }

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
            severity = str(f.get("impact", "medium")).strip().upper()
            if severity not in {"CRITICAL", "HIGH", "MEDIUM", "LOW"}:
                severity = "MEDIUM"
            normalized.append({
                "id": str(f.get("id", f"SOL-001-{idx:03d}")),
                "title": str(f.get("title", "Untitled")).strip(),
                "severity": severity,
                "contract": str(f.get("contract", "")).strip(),
                "description": str(f.get("description", "")).strip(),
                "vuln_code": str(f.get("vuln_code", "")).strip(),
                "fix_code": str(f.get("fix_code", "")).strip(),
                "exploit_code": str(f.get("exploit_code", "")).strip(),
                "solodit_url": str(f.get("url", "")).strip(),
                "solodit_id": str(f.get("id", "")).strip(),
                "protocol": str(f.get("protocol", "")).strip(),
                "firms": f.get("issues_issue_finders", []),
                "tags": f.get("tags", []),
            })
        return normalized