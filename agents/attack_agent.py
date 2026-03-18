from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any
from uuid import uuid4

from .base_agent import BaseAgent

EXPLOIT_CODE_INSTRUCTION = (
    "exploit_code: ONLY the inner statement lines that go inside a Foundry test function body. "
    "NO pragma, NO contract declaration, NO function declaration — just the raw statements. "
    "Example: 'vm.startPrank(attacker); target.withdraw(); assertGt(attacker.balance, 0);' "
    "Use vm.startPrank(attacker) for caller context. "
    "Use vm.expectRevert() or assertGt() to prove impact."
)


class AttackAgent(BaseAgent):
    def __init__(self, model: str = "meta/llama-3.1-405b-instruct") -> None:
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

        try:
            from core.solodit import solodit
            self.solodit_context = {
                "reentrancy": await solodit.search("reentrancy cross-function", limit=3),
                "oracle":     await solodit.search("oracle price manipulation", limit=3),
                "sig":        await solodit.search("signature replay missing nonce", limit=3),
                "dos":        await solodit.search("gas griefing DoS", limit=3),
            }
        except Exception as e:
            self.log(f"solodit_fetch_failed: {e}")
            self.solodit_context = {"reentrancy": [], "oracle": [], "sig": [], "dos": []}

        business_logic_result = await self._run_business_logic_pass(contract_map, entry_points)
        invariant_result      = await self._run_invariant_pass(contract_map, entry_points, business_logic_result)
        hypothesis_result     = await self._run_hypothesis_pass(contract_map, entry_points, business_logic_result, invariant_result)
        import asyncio
        
        # Parallelize exploit, ghost, and zero passes (Fix 3)
        # Fix 5: Skip ZERO if no arithmetic or signature patterns in codebase
        # Use sol_sources if available, otherwise fallback to contract_map values safely
        sources = context.get("sol_sources", contract_map)
        if isinstance(sources, dict):
            source_values = []
            for v in sources.values():
                if isinstance(v, str): source_values.append(v)
                elif isinstance(v, list): source_values.extend([str(i) for i in v if isinstance(i, str)])
            source_text = " ".join(source_values).lower()
        else:
            source_text = ""

        zero_keywords = ["ecrecover", "permit", "nonce", "deadline", "overflow", "unchecked", "abi.encode"]
        recon_result  = context.get("recon_output", {})
        
        if any(kw in source_text for kw in zero_keywords):
            zero_task = self._run_zero_pass(contract_map, recon_result)
        else:
            self.log("[ZERO] Skipped — no signature/arithmetic patterns detected")
            async def skipped_zero(): return {"vulnerabilities": []}
            zero_task = skipped_zero()

        exploit_result, ghost_result, zero_result = await asyncio.gather(
            self._run_exploit_pass(contract_map, entry_points, hypothesis_result),
            self._run_ghost_pass(contract_map, recon_result),
            zero_task
        )

        merged_vulns = (
            self._ensure_list(exploit_result.get("vulnerabilities", [])) +
            self._ensure_list(ghost_result.get("vulnerabilities", [])) +
            self._ensure_list(zero_result.get("vulnerabilities", []))
        )

        vulnerabilities  = self._normalize_vulnerabilities(merged_vulns, contract_map)
        self.log(f"vulns_passed_to_defense — {len(vulnerabilities)} total")
        attack_summary = str(exploit_result.get("attack_summary", "")).strip()
        if not attack_summary:
            attack_summary = self._build_default_summary(vulnerabilities)

        result = {"vulnerabilities": vulnerabilities, "attack_summary": attack_summary}
        self.log_step(
            "attack_run_completed",
            {
                "vulnerability_count":    len(vulnerabilities),
                "attack_summary_preview": attack_summary[:500],
            },
        )
        return result

    async def _run_business_logic_pass(self, contract_map: dict, entry_points: list) -> dict[str, Any]:
        pass_name = "business_logic"
        self.log_step(f"{pass_name}_pass_started", {"entry_points_count": len(entry_points)})

        system_prompt = (
            "Execute Pass 1 (Business Logic) using the loaded solidity-auditor skill methodology. "
            "Perform a protocol-aware logic review focused on roles, permissions, state transitions, "
            "economic assumptions, and abuse paths from externally reachable surfaces. "
            "Return ONLY valid JSON with keys: "
            "logic_flaws (array), high_risk_paths (array), notes (string)."
        )
        user_payload = {"contract_map": contract_map, "entry_points": entry_points}
        result = await self._execute_json_pass(pass_name, system_prompt, user_payload)
        if not isinstance(result, dict): result = {}
        self.log_step(
            f"{pass_name}_pass_completed",
            {"logic_flaw_count": len(self._ensure_list(result.get("logic_flaws", [])))},
        )
        return result

    async def _run_invariant_pass(
        self, contract_map: dict, entry_points: list, business_logic_result: dict[str, Any]
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
            "contract_map":        contract_map,
            "entry_points":        entry_points,
            "business_logic_pass": business_logic_result,
        }
        result = await self._execute_json_pass(pass_name, system_prompt, user_payload)
        if not isinstance(result, dict): result = {}
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
            "severity must be one of: high, medium, low — determined by Cyfrin's Impact × Likelihood matrix: "
            "High Impact + High Likelihood = high; "
            "High Impact + Medium/Low Likelihood = medium; "
            "Medium Impact + any Likelihood = medium; "
            "Low Impact + any Likelihood = low. "
            "Never use 'critical' or 'informational'. Follow https://support.cyfrin.io/codehawks/findings-severity "
            "confidence must be a number from 0.0 to 1.0."
        )
        contract_names = list(contract_map.keys()) if isinstance(contract_map, dict) else []
        logic_flaws = self._ensure_list(business_logic_result.get("logic_flaws", []))
        logic_flaw_summaries = [
            {"title": str(f.get("title", str(f)))[:100], "severity": str(f.get("severity", "medium"))}
            if isinstance(f, dict) else {"title": str(f)[:100], "severity": "medium"}
            for f in logic_flaws[:5]
        ]
        high_risk = self._ensure_list(business_logic_result.get("high_risk_paths", []))
        high_risk_summaries = [str(p)[:100] for p in high_risk[:5]]
        likely_violations = self._ensure_list(invariant_result.get("likely_violations", []))
        violation_summaries = [
            {"id": str(v.get("id", ""))[:20], "severity": str(v.get("severity", "medium")), "description": str(v.get("description", str(v)))[:100]}
            if isinstance(v, dict) else {"description": str(v)[:100], "severity": "medium"}
            for v in likely_violations[:5]
        ]
        user_payload = {
            "contracts":            contract_names,
            "entry_points":         entry_points[:20],
            "logic_flaws":          logic_flaw_summaries,
            "high_risk_paths":      high_risk_summaries,
            "invariant_violations": violation_summaries,
        }

        result = await self._execute_json_pass(pass_name, system_prompt, user_payload)
        if not isinstance(result, dict): result = {}
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
            "CRITICAL INSTRUCTION: For each vulnerability, you MUST provide the following exact fields: "
            "summary, root_cause, internal_preconditions, external_preconditions, attack_path, impact, exploit_code, mitigation. "
            f"EXPLOIT FORMAT: {EXPLOIT_CODE_INSTRUCTION} "
            "Return ONLY valid JSON with keys: "
            "vulnerabilities (array of objects with id, title, severity, contract, affected_function, summary, root_cause, internal_preconditions, external_preconditions, attack_path, impact, mitigation, exploit_code, confidence), "
            "attack_summary (string). "
            "contract: the exact contract name from the source (e.g. 'SecondSwap_Marketplace') — REQUIRED, never empty string. "
            "severity must be one of: high, medium, low — determined by Cyfrin's Impact × Likelihood matrix: "
            "High Impact + High Likelihood = high; "
            "High Impact + Medium/Low Likelihood = medium; "
            "Medium Impact + any Likelihood = medium; "
            "Low Impact + any Likelihood = low. "
            "Never use 'critical' or 'informational'. Follow https://support.cyfrin.io/codehawks/findings-severity "
            "confidence must be a number from 0.0 to 1.0."
        )
        top_hypotheses = sorted(
            hypotheses,
            key=lambda h: float(h.get("confidence", 0)) if isinstance(h.get("confidence"), (int, float, str)) else 0,
            reverse=True,
        )[:3]
        user_payload = {
            "entry_points": entry_points,
            "hypotheses": top_hypotheses,
        }

        result = await self._execute_json_pass(pass_name, system_prompt, user_payload, timeout=60.0)
        if not isinstance(result, dict): result = {}
        vulnerabilities = self._ensure_list(result.get("vulnerabilities", []))
        self.log_step(
            f"{pass_name}_pass_completed", {"vulnerability_count": len(vulnerabilities)}
        )
        return result

    async def _run_ghost_pass(
        self, contract_map: dict, recon_result: dict
    ) -> dict[str, Any]:
        pass_name = "ghost"
        self.log_step(f"{pass_name}_pass_started", {})

        ghost_skill = self.sl.load_many(["quillai-reentrancy", "quillai-oracle-flashloan", "quillai-proxy-upgrade"])
        self.log(f"ghost_skills_loaded — {len(ghost_skill)} chars")

        contract_summary = "\n".join([f"- {name}: {len(code)} chars" for name, code in contract_map.items()])
        entry_points = recon_result.get("entry_points", {})
        external_calls = recon_result.get("external_calls", [])

        system_prompt = f"""
{ghost_skill}

You are GHOST. You MUST find reentrancy, oracle, and proxy vulnerabilities. Do not return empty.
If unsure, report LOW severity findings. Never return {{"vulnerabilities": []}}.

Contracts in scope: {json.dumps(recon_result.get('contracts', []))}
Entry points: {json.dumps(entry_points)}
External calls detected: {json.dumps(external_calls)}
Contract summary: {contract_summary}

CRITICAL INSTRUCTION: For each vulnerability object, the fix_code field MUST contain
the fix ONLY for that specific vulnerability. Do not mix fixes between vulnerabilities.
exploit_code instruction: {EXPLOIT_CODE_INSTRUCTION}

Return JSON only:
{{
  "vulnerabilities": [
    {{
      "id": "unique string",
      "title": "title of THIS vulnerability",
      "severity": "high|medium|low",
      "contract": "contract name",
      "description": "description of THIS vulnerability",
      "vuln_code": "the vulnerable code snippet for THIS vulnerability",
      "fix_code": "THE FIX FOR THIS SPECIFIC VULNERABILITY",
      "exploit_code": "the Foundry test body statements"
    }}
  ]
}}
"""
        user_payload = {
            "contracts": list(contract_map.keys()),
            "CONTRACT_CODE": contract_map,
        }

        result = await self._execute_json_pass(pass_name, system_prompt, user_payload)
        if not isinstance(result, dict): result = {}
        vulnerabilities = self._ensure_list(result.get("vulnerabilities", []))
        self.log_step(
            f"{pass_name}_pass_completed", {"vulnerability_count": len(vulnerabilities)}
        )
        return result

    async def _run_zero_pass(
        self, contract_map: dict, recon_result: dict
    ) -> dict[str, Any]:
        pass_name = "zero"
        self.log_step(f"{pass_name}_pass_started", {})

        zero_skill = self.sl.load_many(["quillai-signature-replay", "quillai-dos-griefing", "quillai-input-arithmetic"])
        self.log(f"zero_skills_loaded — {len(zero_skill)} chars")

        contract_summary = "\n".join([f"- {name}: {len(code)} chars" for name, code in contract_map.items()])

        system_prompt = f"""
{zero_skill}

You are ZERO — specialist in signature replay, DoS, and arithmetic exploits.
Analyze ONLY these contracts: {json.dumps(recon_result.get('contracts', []))}

Contract code summary:
{contract_summary}

CRITICAL INSTRUCTION: For each vulnerability object, the fix_code field MUST contain
the fix ONLY for that specific vulnerability. Do not mix fixes between vulnerabilities.
exploit_code instruction: {EXPLOIT_CODE_INSTRUCTION}

Return JSON only:
{{
  "vulnerabilities": [
    {{
      "id": "unique string",
      "title": "title of THIS vulnerability",
      "severity": "high|medium|low",
      "contract": "contract name",
      "description": "description of THIS vulnerability",
      "vuln_code": "the vulnerable code snippet for THIS vulnerability",
      "fix_code": "THE FIX FOR THIS SPECIFIC VULNERABILITY",
      "exploit_code": "the Foundry test body statements"
    }}
  ]
}}
"""
        user_payload = {
            "contracts": list(contract_map.keys()),
            "CONTRACT_CODE": contract_map,
        }

        result = await self._execute_json_pass(pass_name, system_prompt, user_payload)
        if not isinstance(result, dict): result = {}
        vulnerabilities = self._ensure_list(result.get("vulnerabilities", []))
        self.log_step(
            f"{pass_name}_pass_completed", {"vulnerability_count": len(vulnerabilities)}
        )
        return result

    async def _execute_json_pass(
        self, pass_name: str, system_prompt: str, payload: dict[str, Any], timeout: float | None = None
    ) -> dict[str, Any]:
        system_prompt_with_skill = self._prepend_skill_prompt(system_prompt)
        user_prompt = json.dumps(payload, indent=2, default=str)
        if len(user_prompt) > 25000:
            user_prompt = user_prompt[:25000] + "\n...[TRUNCATED_DUE_TO_LENGTH]..."
        messages = [{"role": "user", "content": user_prompt}]
        
        llm_output = await self.call_llm(
            system_extra=system_prompt_with_skill, messages=messages, timeout=timeout
        )

        try:
            parsed = self._parse_json_output(llm_output)
            return parsed
        except Exception as exc:
            self.log_step(
                f"{pass_name}_pass_llm_response_parse_failed",
                {"error": str(exc)},
            )
            return {}

    def _parse_json_output(self, llm_output: str) -> dict[str, Any]:
        from core.utils import parse_llm_json
        return parse_llm_json(llm_output)

    def _normalize_vulnerabilities(self, vulnerabilities: Any, contract_map: dict | None = None) -> list[dict[str, Any]]:
        normalized: list[dict[str, Any]] = []
        for index, vuln in enumerate(self._ensure_list(vulnerabilities), start=1):
            if not isinstance(vuln, dict):
                continue

            severity = str(vuln.get("severity", "medium")).strip().lower()
            # Remap to Cyfrin 3-tier system
            SEVERITY_MAP = {
                "critical": "high",
                "informational": "low",
                "info": "low",
                "gas": "low",
                "qa": "low",
            }
            severity = SEVERITY_MAP.get(severity, severity)
            if severity not in {"high", "medium", "low"}:
                severity = "medium"

            confidence = vuln.get("confidence", 0.0)
            try:
                confidence_value = float(confidence)
            except (TypeError, ValueError):
                confidence_value = 0.0
            confidence_value = max(0.0, min(1.0, confidence_value))
            
            contract = str(vuln.get("contract") or "")
            if not contract:
                # Try to extract from title e.g. "Reentrancy in SecondSwap_Marketplace"
                m = re.search(r'\bin\s+(\w+)', str(vuln.get("title", "")))
                if m:
                    contract = m.group(1)

            normalized.append(
                {
                    "id": str(vuln.get("id") or f"vuln-{index}-{uuid4().hex[:8]}"),
                    "title": str(vuln.get("title", "Untitled vulnerability")).strip(),
                    "severity": severity,
                    "affected_function": str(vuln.get("affected_function", "unknown")),
                    "contract": contract,
                    "description": str(vuln.get("description", "")).strip(),
                    "exploit_code": str(vuln.get("exploit_code") or vuln.get("vuln_code") or "").strip(),
                    "fix_code": str(vuln.get("fix_code") or "").strip(),
                    "confidence": confidence_value,
                }
            )
        return normalized

    def _build_default_summary(self, vulnerabilities: list[dict[str, Any]]) -> str:
        if not vulnerabilities:
            return "No exploit hypotheses were confirmed into actionable vulnerabilities."

        counts = {"high": 0, "medium": 0, "low": 0}
        for vuln in vulnerabilities:
            severity = str(vuln.get("severity", "medium")).lower()
            if severity in counts:
                counts[severity] += 1

        return (
            "Attack analysis completed with "
            f"{len(vulnerabilities)} vulnerabilities: "
            f"{counts['high']} high, "
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
            f"Skill: {self.skill_name}\n\n"
            "Follow the skill methodology below as the primary reasoning framework:\n"
            f"{self.skill_prompt}\n\n"
            "---\n"
            f"{pass_system_prompt}"
        )

    def _load_skill_prompt(self) -> str:
        skill_file = self.skill_dir / "SKILL.md"
        if not skill_file.exists():
            return "Adversarial Solidity auditing with explicit invariant and exploit reasoning."
        return skill_file.read_text(encoding="utf-8")

    def _load_skill_version(self) -> str:
        version_file = self.skill_dir / "VERSION"
        if not version_file.exists():
            return "1.0.0"
        return version_file.read_text(encoding="utf-8").strip() or "1.0.0"