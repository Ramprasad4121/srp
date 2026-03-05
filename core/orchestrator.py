from __future__ import annotations

import inspect
from pathlib import Path
from collections.abc import Callable
from typing import Any

from agents.attack_agent import AttackAgent
from agents.defense_agent import DefenseAgent
from agents.intent_agent import IntentAgent
from agents.recon_agent import ReconAgent
from agents.report_agent import ReportAgent
from agents.trace_agent import TraceAgent


class SRPOrchestrator:
    def __init__(self) -> None:
        self.intent_agent = IntentAgent()
        self.recon_agent = ReconAgent()
        self.attack_agent = AttackAgent()
        self.defense_agent = DefenseAgent()
        self.trace_agent = TraceAgent()
        self.report_agent = ReportAgent()
        self.status_callback: Callable[[str, str, dict], Any] | None = None
        self.skills: dict[str, str] = {}

    def set_status_callback(self, fn) -> None:
        self.status_callback = fn

    def load_skills(self, skills_dir: str = "./skills") -> dict:
        skills_path = Path(skills_dir).expanduser()
        if not skills_path.is_absolute():
            skills_path = Path.cwd() / skills_path

        loaded: dict[str, str] = {}
        if not skills_path.exists() or not skills_path.is_dir():
            self.skills = loaded
            return loaded

        for entry in sorted(skills_path.iterdir()):
            if not entry.is_dir():
                continue

            skill_file = entry / "SKILL.md"
            if not skill_file.exists() or not skill_file.is_file():
                continue

            loaded[entry.name] = skill_file.read_text(encoding="utf-8")

        self.skills = loaded
        return loaded

    def select_skill(self, intent: dict) -> str:
        if not self.skills:
            self.load_skills()

        available = sorted(self.skills.keys())
        if not available:
            return "solidity-auditor"

        # Single skill setup currently defaults to the only loaded skill.
        if len(available) == 1:
            return available[0]

        needs = intent.get("skills_needed", intent.get("skills", []))
        if not isinstance(needs, list):
            needs = [needs] if needs else []
        needs = [str(item).strip().lower() for item in needs if str(item).strip()]

        task_text = " ".join(
            str(intent.get(key, "")).lower()
            for key in ("task", "task_description", "scope", "audit_scope", "raw_input")
        )
        contract_paths = intent.get("contract_paths", [])
        if not isinstance(contract_paths, list):
            contract_paths = [contract_paths]
        has_solidity_path = any(str(path).lower().endswith(".sol") for path in contract_paths)
        looks_like_solidity = has_solidity_path or ("solidity" in task_text) or ("evm" in task_text)

        if looks_like_solidity and "solidity-auditor" in self.skills:
            return "solidity-auditor"

        score_by_skill: dict[str, int] = {name: 0 for name in available}
        for need in needs:
            for skill_name in available:
                normalized_skill_name = skill_name.lower()
                if need == normalized_skill_name:
                    score_by_skill[skill_name] += 4
                    continue
                if need in normalized_skill_name or normalized_skill_name in need:
                    score_by_skill[skill_name] += 2
                    continue

                skill_tokens = [token for token in normalized_skill_name.replace("_", "-").split("-") if token]
                if any(token and token in need for token in skill_tokens):
                    score_by_skill[skill_name] += 1

        best_skill = max(available, key=lambda name: score_by_skill.get(name, 0))
        if score_by_skill.get(best_skill, 0) == 0 and "solidity-auditor" in self.skills:
            return "solidity-auditor"
        return best_skill

    async def run_full_audit(
        self, raw_input: str, contract_paths: list, budget_usd: float
    ) -> dict:
        loaded_skills = self.load_skills()
        context: dict[str, Any] = {
            "raw_input": raw_input,
            "contract_paths": contract_paths,
            "budget_usd": budget_usd,
            "available_skills": sorted(loaded_skills.keys()),
        }
        results: dict[str, Any] = {}

        try:
            intent = await self.intent_agent.run(context)
            results["intent"] = intent
            context["intent_output"] = intent
            context.update(intent)

            skill_selector_input = {
                "skills_needed": intent.get("skills", intent.get("skills_needed", [])),
                "task": intent.get("task", intent.get("task_description", "")),
                "scope": intent.get("scope", intent.get("audit_scope", "")),
                "raw_input": raw_input,
                "contract_paths": contract_paths,
            }
            selected_skill_name = self.select_skill(skill_selector_input)
            selected_skill_content = self.skills.get(selected_skill_name, "")
            context["selected_skill_name"] = selected_skill_name
            context["selected_skill_content"] = selected_skill_content
            context["selected_skill"] = {
                "name": selected_skill_name,
                "content": selected_skill_content,
                "source": "local-skills",
            }

            assumptions = context.get("assumptions", [])
            if not isinstance(assumptions, list):
                assumptions = []
            assumptions.append(f"selected_skill_name: {selected_skill_name}")
            assumptions.append(f"selected_skill_content: {selected_skill_content}")
            context["assumptions"] = assumptions

            await self._emit_status(
                "SkillSelector",
                "completed",
                {
                    "selected_skill_name": selected_skill_name,
                    "selected_skill_content_preview": selected_skill_content[:200],
                },
            )
            await self._emit_status("IntentAgent", "completed", intent)
        except Exception as exc:
            await self._emit_status("IntentAgent", "failed", {"error": str(exc)})
            raise

        try:
            recon = await self.recon_agent.run(context)
            results["recon"] = recon
            context["recon_output"] = recon
            context.update(
                {
                    "contract_map": recon.get("contract_map", {}),
                    "functions": recon.get("functions", []),
                    "state_vars": recon.get("state_vars", []),
                    "external_calls": recon.get("external_calls", []),
                    "entry_points": recon.get("entry_points", []),
                    "risk_surface": recon.get("risk_surface", []),
                }
            )
            await self._emit_status("ReconAgent", "completed", recon)
        except Exception as exc:
            await self._emit_status("ReconAgent", "failed", {"error": str(exc)})
            raise

        try:
            attack = await self.attack_agent.run(context)
            results["attack"] = attack
            context["attack_output"] = attack
            context.update(
                {
                    "vulnerabilities": attack.get("vulnerabilities", []),
                    "attack_summary": attack.get("attack_summary", ""),
                }
            )
            await self._emit_status("AttackAgent", "completed", attack)
        except Exception as exc:
            await self._emit_status("AttackAgent", "failed", {"error": str(exc)})
            raise

        try:
            defense = await self.defense_agent.run(context)
            results["defense"] = defense
            context["defense_output"] = defense
            context.update(
                {
                    "reviewed_vulnerabilities": defense.get(
                        "reviewed_vulnerabilities", []
                    ),
                    "overall_security_score": defense.get("overall_security_score"),
                    "final_findings": defense,
                }
            )
            await self._emit_status("DefenseAgent", "completed", defense)
        except Exception as exc:
            await self._emit_status("DefenseAgent", "failed", {"error": str(exc)})
            raise

        try:
            context["agent_traces"] = {
                "IntentAgent": self.intent_agent.get_trace(),
                "ReconAgent": self.recon_agent.get_trace(),
                "AttackAgent": self.attack_agent.get_trace(),
                "DefenseAgent": self.defense_agent.get_trace(),
            }
            trace = await self.trace_agent.run(context)
            results["trace"] = trace
            context["trace_output"] = trace
            context.update(
                {
                    "trace_id": trace.get("trace_id"),
                    "input_hash": trace.get("input_hash"),
                    "output_hash": trace.get("output_hash"),
                    "timestamp": trace.get("timestamp"),
                }
            )
            await self._emit_status("TraceAgent", "completed", trace)
        except Exception as exc:
            await self._emit_status("TraceAgent", "failed", {"error": str(exc)})
            raise

        try:
            report = await self.report_agent.run(context)
            results["report"] = report
            context["report_output"] = report
            await self._emit_status("ReportAgent", "completed", report)
        except Exception as exc:
            await self._emit_status("ReportAgent", "failed", {"error": str(exc)})
            raise

        return results

    async def _emit_status(self, step_name: str, status: str, data: dict) -> None:
        if self.status_callback is None:
            return

        callback_result = self.status_callback(step_name, status, data)
        if inspect.isawaitable(callback_result):
            await callback_result
