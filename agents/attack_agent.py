from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from uuid import uuid4

from .base_agent import BaseAgent


class AttackAgent(BaseAgent):
    def __init__(self, model: str = "deepseek-ai/deepseek-v3.2") -> None:
        super().__init__(
            name="AttackAgent",
            role="Red team agent — actively tries to find exploits",
            skill_keys=["audit-firm-1-solidity-auditor"],
            model=model,
        )
        self.skill_name = "solidity-auditor"
        self.skill_source = "audit-skills"
        self.skill_dir = Path(__file__).resolve().parents[1] / "skills" / self.skill_name
        self.skill_version = self._load_skill_version()
        self.skill_prompt = self._load_skill_prompt()

    async def run(self, context: dict) -> dict:
        self.log_step("attack_run_started", {"context_keys": list(context.keys())})
        self.log_step(
            "attack_skill_loaded",
            {
                "skill": self.skill_name,
                "source": self.skill_source,
                "version": self.skill_version,
            },
        )

        contract_map = context.get("contract_map", {})
        entry_points = context.get("entry_points", [])

        if not isinstance(contract_map, dict):
            contract_map = {}
        if not isinstance(entry_points, list):
            entry_points = [entry_points]

        self.log_step(
            "attack_inputs_extracted",
            {
                "contract_map_keys": list(contract_map.keys()),
                "entry_points_count": len(entry_points),
            },
        )

        business_logic_result = await self._run_business_logic_pass(contract_map, entry_points)
        invariant_result = await self._run_invariant_pass(
            contract_map, entry_points, business_logic_result
        )
        hypothesis_result = await self._run_hypothesis_pass(
            contract_map, entry_points, business_logic_result, invariant_result
        )
        exploit_result = await self._run_exploit_pass(
            contract_map, entry_points, hypothesis_result
        )

        ghost_result = await self._run_ghost_pass(contract_map)
        zero_result = await self._run_zero_pass(contract_map)

        merged_vulns = (
            self._ensure_list(exploit_result.get("vulnerabilities", [])) +
            self._ensure_list(ghost_result.get("vulnerabilities", [])) +
            self._ensure_list(zero_result.get("vulnerabilities", []))
        )

        vulnerabilities = self._normalize_vulnerabilities(merged_vulns)
        attack_summary = str(exploit_result.get("attack_summary", "")).strip()
        if not attack_summary:
            attack_summary = self._build_default_summary(vulnerabilities)

        result = {
            "vulnerabilities": vulnerabilities,
            "attack_summary": attack_summary,
        }
        self.log_step(
            "attack_run_completed",
            {
                "vulnerability_count": len(vulnerabilities),
                "attack_summary_preview": attack_summary[:500],
            },
        )
        return result

    async def _run_business_logic_pass(
        self, contract_map: dict, entry_points: list
    ) -> dict[str, Any]:
        pass_name = "business_logic"
        self.log_step(f"{pass_name}_pass_started", {"entry_points_count": len(entry_points)})

        system_prompt = (
            "Execute Pass 1 (Business Logic) using the loaded solidity-auditor skill methodology. "
            "Perform a protocol-aware logic review focused on roles, permissions, state transitions, "
            "economic assumptions, and abuse paths from externally reachable surfaces. "
            "Return ONLY valid JSON with keys: "
            "logic_flaws (array), high_risk_paths (array), notes (string)."
        )
        user_payload = {
            "contract_map": contract_map,
            "entry_points": entry_points,
        }

        result = await self._execute_json_pass(pass_name, system_prompt, user_payload)
        self.log_step(
            f"{pass_name}_pass_completed",
            {"logic_flaw_count": len(self._ensure_list(result.get("logic_flaws", [])))},
        )
        return result

    async def _run_invariant_pass(
        self,
        contract_map: dict,
        entry_points: list,
        business_logic_result: dict[str, Any],
    ) -> dict[str, Any]:
        pass_name = "invariant"
        self.log_step(f"{pass_name}_pass_started", {})

        system_prompt = (
            "Execute Pass 2 (Invariant) using the loaded solidity-auditor skill methodology. "
            "Identify concrete security invariants and evaluate adversarial ways to violate each one, "
            "including accounting, access control, state machine, and integration invariants. "
            "Return ONLY valid JSON with keys: "
            "invariants (array), break_attempts (array), likely_violations (array), notes (string)."
        )
        user_payload = {
            "contract_map": contract_map,
            "entry_points": entry_points,
            "business_logic_pass": business_logic_result,
        }

        result = await self._execute_json_pass(pass_name, system_prompt, user_payload)
        self.log_step(
            f"{pass_name}_pass_completed",
            {"invariant_count": len(self._ensure_list(result.get("invariants", [])))},
        )
        return result

    async def _run_hypothesis_pass(
        self,
        contract_map: dict,
        entry_points: list,
        business_logic_result: dict[str, Any],
        invariant_result: dict[str, Any],
    ) -> dict[str, Any]:
        pass_name = "hypothesis"
        self.log_step(f"{pass_name}_pass_started", {})

        system_prompt = (
            "Execute Pass 3 (Hypothesis) using the loaded solidity-auditor skill methodology. "
            "Generate exploit hypotheses from earlier passes, deduplicate by root cause, "
            "and rank by practical impact and exploitability. "
            "Return ONLY valid JSON with keys: "
            "hypotheses (array of objects with title, severity, affected_function, description, confidence), "
            "ranking_rationale (string). "
            "severity must be one of: low, medium, high, critical. "
            "confidence must be a number from 0.0 to 1.0."
        )
        # Only send the contract map keys (contract names) to avoid massive payload
        contract_names = list(contract_map.keys()) if isinstance(contract_map, dict) else []
        user_payload = {
            "contracts": contract_names,
            "entry_points": entry_points,
            "business_logic_pass": business_logic_result,
            "invariant_pass": invariant_result,
        }

        result = await self._execute_json_pass(pass_name, system_prompt, user_payload)
        hypotheses = self._ensure_list(result.get("hypotheses", []))
        self.log_step(f"{pass_name}_pass_completed", {"hypothesis_count": len(hypotheses)})
        return result

    async def _run_exploit_pass(
        self, contract_map: dict, entry_points: list, hypothesis_result: dict[str, Any]
    ) -> dict[str, Any]:
        pass_name = "exploit"
        hypotheses = self._ensure_list(hypothesis_result.get("hypotheses", []))
        self.log_step(f"{pass_name}_pass_started", {"hypothesis_count": len(hypotheses)})

        system_prompt = (
            "Execute Pass 4 (Exploit) using the loaded solidity-auditor skill methodology. "
            "For each credible hypothesis, provide an exploit narrative and Solidity proof-of-concept, "
            "with clear affected function mapping and confidence grading. "
            "Return ONLY valid JSON with keys: "
            "vulnerabilities (array of objects with id, title, severity, affected_function, description, exploit_code, confidence), "
            "attack_summary (string). "
            "All vulnerability objects must include Solidity code in exploit_code. "
            "severity must be one of: low, medium, high, critical. "
            "confidence must be a number from 0.0 to 1.0."
        )
        # Only send top 5 highest-confidence hypotheses to keep payload small
        hypotheses = self._ensure_list(hypothesis_result.get("hypotheses", []))
        top_hypotheses = sorted(
            hypotheses,
            key=lambda h: float(h.get("confidence", 0)) if isinstance(h.get("confidence"), (int, float, str)) else 0,
            reverse=True,
        )[:5]
        user_payload = {
            "entry_points": entry_points,
            "hypotheses": top_hypotheses,
        }

        result = await self._execute_json_pass(pass_name, system_prompt, user_payload)
        vulnerabilities = self._ensure_list(result.get("vulnerabilities", []))
        self.log_step(
            f"{pass_name}_pass_completed", {"vulnerability_count": len(vulnerabilities)}
        )
        return result

    async def _run_ghost_pass(
        self, contract_map: dict
    ) -> dict[str, Any]:
        pass_name = "ghost"
        self.log_step(f"{pass_name}_pass_started", {})

        ghost_skill = self.sl.load_many(["quillai-reentrancy", "quillai-oracle-flashloan", "quillai-proxy-upgrade"])
        self.log(f"ghost_skills_loaded — {len(ghost_skill)} chars")

        from core.solodit import solodit
        ghost_solodit = await solodit.search("reentrancy cross-function", limit=3)
        oracle_solodit = await solodit.search("oracle price manipulation", limit=3)
        solodit_block = f"Real-world exploit references:\n{ghost_solodit}\n{oracle_solodit}"

        system_prompt = (
            "You are GHOST — specialist in reentrancy, oracle manipulation, and proxy storage collisions.\n"
            "Focus ONLY on:\n"
            "- Reentrancy (single and cross-function)\n"
            "- Price oracle manipulation\n"
            "- Proxy implementation slot collisions\n"
            "- Delegatecall vulnerabilities\n\n"
            f"{ghost_skill}\n\n"
            f"{solodit_block}\n\n"
            "Return ONLY valid JSON with keys: vulnerabilities (array of objects with id, title, severity, affected_function, description, exploit_code, confidence)."
        )
        # Send only entry_points and contract names instead of full source map
        user_payload = {
            "entry_points": list(contract_map.keys()) if isinstance(contract_map, dict) else [],
        }

        result = await self._execute_json_pass(pass_name, system_prompt, user_payload)
        vulnerabilities = self._ensure_list(result.get("vulnerabilities", []))
        self.log_step(
            f"{pass_name}_pass_completed", {"vulnerability_count": len(vulnerabilities)}
        )
        return result

    async def _run_zero_pass(
        self, contract_map: dict
    ) -> dict[str, Any]:
        pass_name = "zero"
        self.log_step(f"{pass_name}_pass_started", {})

        zero_skill = self.sl.load_many(["quillai-signature-replay", "quillai-dos-griefing", "quillai-input-arithmetic"])
        self.log(f"zero_skills_loaded — {len(zero_skill)} chars")

        from core.solodit import solodit
        sig_solodit = await solodit.search("signature replay missing nonce", limit=3)
        dos_solodit = await solodit.search("gas griefing DoS", limit=3)
        solodit_block = f"Real-world exploit references:\n{sig_solodit}\n{dos_solodit}"

        system_prompt = (
            "You are ZERO — specialist in signature replay, DoS vectors, and arithmetic exploits.\n"
            "Focus ONLY on:\n"
            "- Signature replay attacks (missing nonce/chainId)\n"
            "- Block gas limit DoS\n"
            "- Integer overflow/underflow edge cases\n"
            "- Front-running and sandwich attacks\n\n"
            f"{zero_skill}\n\n"
            f"{solodit_block}\n\n"
            "Return ONLY valid JSON with keys: vulnerabilities (array of objects with id, title, severity, affected_function, description, exploit_code, confidence)."
        )
        # Send only entry_points and contract names instead of full source map
        user_payload = {
            "entry_points": list(contract_map.keys()) if isinstance(contract_map, dict) else [],
        }

        result = await self._execute_json_pass(pass_name, system_prompt, user_payload)
        vulnerabilities = self._ensure_list(result.get("vulnerabilities", []))
        self.log_step(
            f"{pass_name}_pass_completed", {"vulnerability_count": len(vulnerabilities)}
        )
        return result

    async def _execute_json_pass(
        self, pass_name: str, system_prompt: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        system_prompt_with_skill = self._prepend_skill_prompt(system_prompt)
        user_prompt = json.dumps(payload, indent=2, default=str)
        messages = [{"role": "user", "content": user_prompt}]
        self.log_step(
            f"{pass_name}_pass_prompt_built",
            {
                "system_preview": system_prompt_with_skill[:300],
                "user_prompt_chars": len(user_prompt),
                "message_count": len(messages),
            },
        )

        llm_output = await self.call_llm(
            system_extra=system_prompt_with_skill, messages=messages
        )
        self.log_step(
            f"{pass_name}_pass_llm_response_received",
            {"response_preview": llm_output[:1000]},
        )

        try:
            parsed = self._parse_json_output(llm_output)
            self.log_step(
                f"{pass_name}_pass_llm_response_parsed",
                {"parsed_keys": list(parsed.keys())},
            )
            return parsed
        except json.JSONDecodeError as exc:
            self.log_step(
                f"{pass_name}_pass_llm_response_parse_failed",
                {"error": str(exc), "raw_response_preview": llm_output[:1000]},
            )
            return {}

    def _parse_json_output(self, llm_output: str) -> dict[str, Any]:
        from core.utils import parse_llm_json
        return parse_llm_json(llm_output)

    def _normalize_vulnerabilities(self, vulnerabilities: Any) -> list[dict[str, Any]]:
        normalized: list[dict[str, Any]] = []
        for index, vuln in enumerate(self._ensure_list(vulnerabilities), start=1):
            if not isinstance(vuln, dict):
                vuln = {"description": str(vuln)}

            severity = str(vuln.get("severity", "medium")).strip().lower()
            if severity not in {"low", "medium", "high", "critical"}:
                severity = "medium"

            confidence = vuln.get("confidence", 0.0)
            try:
                confidence_value = float(confidence)
            except (TypeError, ValueError):
                confidence_value = 0.0
            confidence_value = max(0.0, min(1.0, confidence_value))

            normalized.append(
                {
                    "id": str(vuln.get("id") or f"vuln-{index}-{uuid4().hex[:8]}"),
                    "title": str(vuln.get("title", "Untitled vulnerability")).strip(),
                    "severity": severity,
                    "affected_function": str(vuln.get("affected_function", "unknown")).strip(),
                    "description": str(vuln.get("description", "")).strip(),
                    "exploit_code": str(vuln.get("exploit_code", "")).strip(),
                    "confidence": confidence_value,
                }
            )

        return normalized

    def _build_default_summary(self, vulnerabilities: list[dict[str, Any]]) -> str:
        if not vulnerabilities:
            return "No exploit hypotheses were confirmed into actionable vulnerabilities."

        counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for vuln in vulnerabilities:
            severity = str(vuln.get("severity", "medium")).lower()
            if severity in counts:
                counts[severity] += 1

        return (
            "Attack analysis completed with "
            f"{len(vulnerabilities)} vulnerabilities: "
            f"{counts['critical']} critical, {counts['high']} high, "
            f"{counts['medium']} medium, {counts['low']} low."
        )

    def _ensure_list(self, value: Any) -> list:
        if isinstance(value, list):
            return value
        if value is None:
            return []
        return [value]

    def _prepend_skill_prompt(self, pass_system_prompt: str) -> str:
        return (
            f"Skill: {self.skill_name}\n"
            f"Source: {self.skill_source}\n"
            f"Version: {self.skill_version}\n\n"
            "Follow the skill methodology below as the primary reasoning framework:\n"
            f"{self.skill_prompt}\n\n"
            "---\n"
            f"{pass_system_prompt}"
        )

    def _load_skill_prompt(self) -> str:
        skill_file = self.skill_dir / "SKILL.md"
        if not skill_file.exists():
            return (
                "Skill prompt unavailable. Fall back to strict adversarial Solidity auditing "
                "with explicit invariant and exploit reasoning."
            )
        return skill_file.read_text(encoding="utf-8")

    def _load_skill_version(self) -> str:
        version_file = self.skill_dir / "VERSION"
        if not version_file.exists():
            return "unknown"
        version = version_file.read_text(encoding="utf-8").strip()
        return version or "unknown"
