"""
Solodit Crosschecker — Additional verification pass for Solodit findings.

Threat model: false positives, context misunderstanding, pattern mismatch
"""
from __future__ import annotations

import json
from typing import Any

from srp.agents.base_agent import BaseAgent


class SoloditCrosschecker(BaseAgent):
    """Additional verification pass for Solodit findings."""

    def __init__(self, model: str = "meta/llama-3.1-405b-instruct") -> None:
        super().__init__(
            name="SoloditCrosschecker",
            role="Solodit intelligence — additional verification pass",
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
        """Run Solodit crosschecker phase.

        Args:
            context: Pipeline context with confirmed_findings, contract_map, etc.

        Returns:
            Dict with 'crosschecked_findings' list.
        """
        self.log_step("solodit_crosscheck_started", {"context_keys": list(context.keys())})

        confirmed_findings = context.get("confirmed_findings", [])
        contract_map = context.get("contract_map", {})

        if not confirmed_findings:
            return {"crosschecked_findings": []}

        # Build contract source summary
        if isinstance(contract_map, dict):
            contract_source = "\n".join(
                f"--- {name} ---\n{code[:3000]}" for name, code in contract_map.items()
            )
        else:
            contract_source = str(contract_map)[:8000]

        # Crosscheck each confirmed finding
        crosschecked_findings = []
        for finding in confirmed_findings:
            result = await self._crosscheck_finding(finding, contract_source)
            if result["confirmed"]:
                crosschecked_findings.append({
                    **finding,
                    "crosscheck_confidence": result["confidence"],
                    "crosscheck_notes": result["notes"],
                })

        self.log_step("solodit_crosscheck_completed", {
            "crosschecked_count": len(crosschecked_findings),
            "total_confirmed": len(confirmed_findings),
        })
        return {"crosschecked_findings": crosschecked_findings}

    async def _crosscheck_finding(self, finding: dict, contract_source: str) -> dict:
        """Crosscheck if a confirmed finding actually exists in the code."""
        title = finding.get("title", "").lower()
        description = finding.get("description", "").lower()
        contract_source_preview = contract_source[:2000]

        # Build verification prompt
        prompt = f"""You are a Solodit CROSSCHECKER — perform additional verification on this confirmed finding.

Finding Details:
- Title: {finding.get('title', '')}
- Description: {finding.get('description', '')[:200]}...
- Severity: {finding.get('severity', 'MEDIUM')}
- Solodit URL: {finding.get('solodit_url', '')}

Contract Context (first 2000 chars):
--- BEGIN CONTRACT CONTEXT ---
{contract_source_preview}
--- END CONTRACT CONTEXT ---

Does this confirmed Solodit finding still appear valid after additional verification? Answer YES/NO with explanation.

Return JSON:
{{
  "confirmed": true/false,
  "confidence": 0-100,
  "notes": "explanation of why it exists or doesn't exist",
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
