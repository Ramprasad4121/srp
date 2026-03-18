from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .base_agent import BaseAgent


class DefenseAgent(BaseAgent):
    def __init__(self, model: str = "meta/llama-3.1-405b-instruct") -> None:
        super().__init__(
            name="DefenseAgent",
            role="Blue team agent — challenges AttackAgent findings and proposes fixes",
            skill_keys=["audit-firm-1-solidity-auditor"],
            model=model,
        )
        self.skill_name = "solidity-auditor"
        self.skill_role = "defense"
        self.skill_dir = Path(__file__).resolve().parents[1] / "skills" / self.skill_name
        self.skill_prompt = self._load_skill_prompt()

    async def run(self, context: dict) -> dict:
        self.log_step("defense_run_started", {"context_keys": list(context.keys())})
        self.log_step(
            "defense_skill_loaded",
            {"skill": self.skill_name, "role": self.skill_role},
        )

        vulnerabilities = context.get("vulnerabilities", [])
        vulnerabilities_list = self._ensure_list(vulnerabilities)
        self.log_step(
            "defense_inputs_extracted",
            {"vulnerability_count": len(vulnerabilities_list)},
        )

        import asyncio
        tasks = [
            self._review_single_vulnerability(vulnerability, index)
            for index, vulnerability in enumerate(vulnerabilities_list, start=1)
        ]
        reviewed_vulnerabilities = await asyncio.gather(*tasks, return_exceptions=True)
        # Filter out exceptions and maintain logging if possible, 
        # but asyncio.gather hides the individual log steps unless handled inside.
        # For simplicity and speed, we'll take the results and filter.
        reviewed_vulnerabilities = [r for r in reviewed_vulnerabilities if not isinstance(r, Exception)]

        overall_security_score = self._calculate_overall_security_score(reviewed_vulnerabilities)
        result = {
            "reviewed_vulnerabilities": reviewed_vulnerabilities,
            "overall_security_score": overall_security_score,
        }
        self.log_step(
            "defense_run_completed",
            {
                "reviewed_count": len(reviewed_vulnerabilities),
                "overall_security_score": overall_security_score,
            },
        )
        return result

    async def _review_single_vulnerability(
        self, vulnerability: Any, index: int
    ) -> dict[str, Any]:
        if not isinstance(vulnerability, dict):
            vulnerability = {"description": str(vulnerability)}

        pass_system_prompt = (
            "You are the Blue Team reviewer in a smart contract security process. "
            "Use the loaded solidity-auditor methodology with a defense focus: "
            "validate exploit realism, challenge assumptions, adjust severity with reasoning, "
            "and propose concrete Solidity remediations plus tests. "
            "Return ONLY valid JSON with keys: "
            "status, final_severity, severity_reasoning, summary, root_cause, internal_preconditions, external_preconditions, attack_path, impact, mitigation, fix_code, test_code, defense_notes. "
            "status must be one of: validated, false_positive, needs_more_info. "
            "final_severity must be one of: high, medium, low — no critical, no informational. "
            "Use Cyfrin severity matrix: https://support.cyfrin.io/codehawks/findings-severity "
            "fix_code must be Solidity code. "
            "test_code should be a Solidity or Foundry-style test snippet."
        )
        system_prompt = self._prepend_skill_prompt(pass_system_prompt)
        user_payload = {"vulnerability": vulnerability}
        user_prompt = json.dumps(user_payload, indent=2, default=str)
        messages = [{"role": "user", "content": user_prompt}]
        self.log_step(
            "defense_prompt_built",
            {
                "index": index,
                "system_preview": system_prompt[:320],
                "user_prompt_chars": len(user_prompt),
            },
        )

        llm_output = await self.call_llm(system_extra=system_prompt, messages=messages)
        self.log_step(
            "defense_llm_response_received",
            {"index": index, "response_preview": llm_output[:1000]},
        )

        try:
            parsed = self._parse_json_output(llm_output)
            self.log_step(
                "defense_llm_response_parsed",
                {"index": index, "parsed_keys": list(parsed.keys())},
            )
        except json.JSONDecodeError as exc:
            self.log_step(
                "defense_llm_response_parse_failed",
                {
                    "index": index,
                    "error": str(exc),
                    "raw_response_preview": llm_output[:1000],
                },
            )
            parsed = {}

        return self._normalize_review(vulnerability, parsed, index)

    def _normalize_review(
        self, vulnerability: dict[str, Any], parsed: dict[str, Any], index: int
    ) -> dict[str, Any]:
        original_id = str(vulnerability.get("id", f"vuln-{index}"))

        status = str(parsed.get("status", "needs_more_info")).strip().lower()
        if status not in {"validated", "false_positive", "needs_more_info"}:
            status = "needs_more_info"

        fallback_severity = str(vulnerability.get("severity", "medium")).strip().lower()
        if fallback_severity not in {"low", "medium", "high", "critical"}:
            fallback_severity = "medium"

        final_severity = str(parsed.get("final_severity", fallback_severity)).strip().lower()
        
        # Remap to Cyfrin 3-tier system
        SEVERITY_MAP = {
            "critical": "high",
            "informational": "low",
            "info": "low",
            "gas": "low",
            "qa": "low",
        }
        final_severity = SEVERITY_MAP.get(final_severity, final_severity)
        if final_severity not in {"high", "medium", "low"}:
            final_severity = "medium"

        severity_reasoning = str(parsed.get("severity_reasoning", "")).strip()
        base_notes = str(parsed.get("defense_notes", "")).strip()
        if severity_reasoning:
            defense_notes = f"{base_notes}\nSeverity reasoning: {severity_reasoning}".strip()
        else:
            defense_notes = base_notes

        if not defense_notes:
            defense_notes = "No additional defense notes provided."

        return {
            "original_id": original_id,
            "status": status,
            "final_severity": final_severity,
            "summary": str(parsed.get("summary", vulnerability.get("summary", ""))).strip(),
            "root_cause": str(parsed.get("root_cause", vulnerability.get("root_cause", ""))).strip(),
            "internal_preconditions": str(parsed.get("internal_preconditions", vulnerability.get("internal_preconditions", ""))).strip(),
            "external_preconditions": str(parsed.get("external_preconditions", vulnerability.get("external_preconditions", ""))).strip(),
            "attack_path": str(parsed.get("attack_path", vulnerability.get("attack_path", ""))).strip(),
            "impact": str(parsed.get("impact", vulnerability.get("impact", ""))).strip(),
            "mitigation": str(parsed.get("mitigation", vulnerability.get("mitigation", ""))).strip(),
            "fix_code": str(parsed.get("fix_code", "")).strip(),
            "test_code": str(parsed.get("test_code", "")).strip(),
            "defense_notes": defense_notes,
            "poc_result": vulnerability.get("poc_result"),
        }

    def _calculate_overall_security_score(self, reviews: list[dict[str, Any]]) -> int:
        score = 100.0
        severity_penalty = {"high": 25.0, "medium": 10.0, "low": 3.0}
        status_multiplier = {"validated": 1.0, "needs_more_info": 0.5, "false_positive": 0.0}

        for review in reviews:
            status = str(review.get("status", "needs_more_info")).lower()
            severity = str(review.get("final_severity", "medium")).lower()
            penalty = severity_penalty.get(severity, 12.0)
            multiplier = status_multiplier.get(status, 0.5)
            score -= penalty * multiplier

        score = max(0.0, min(100.0, score))
        return int(round(score))

    def _parse_json_output(self, llm_output: str) -> dict[str, Any]:
        from core.utils import parse_llm_json
        return parse_llm_json(llm_output)

    def _ensure_list(self, value: Any) -> list:
        if isinstance(value, list):
            return value
        if value is None:
            return []
        return [value]

    def _prepend_skill_prompt(self, pass_system_prompt: str) -> str:
        return (
            f"Skill: {self.skill_name}\n"
            f"Role: {self.skill_role}\n\n"
            "Follow the skill methodology below as the primary review framework:\n"
            f"{self.skill_prompt}\n\n"
            "---\n"
            f"{pass_system_prompt}"
        )

    def _load_skill_prompt(self) -> str:
        skill_file = self.skill_dir / "SKILL.md"
        if not skill_file.exists():
            return (
                "Skill prompt unavailable. Apply strict defensive Solidity review methodology: "
                "validate exploit preconditions, rank realistic impact, and provide tested fixes."
            )
        return skill_file.read_text(encoding="utf-8")
