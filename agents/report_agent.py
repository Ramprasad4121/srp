from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from uuid import uuid4

from .base_agent import BaseAgent


class ReportAgent(BaseAgent):
    def __init__(self, model: str = "claude-sonnet-4-20250514") -> None:
        super().__init__(
            name="ReportAgent",
            role="Compiles final human-readable audit report",
        )

    async def run(self, context: dict) -> dict:
        self.log_step("report_run_started", {"context_keys": list(context.keys())})

        report_inputs = self._collect_report_inputs(context)
        self.log_step(
            "report_inputs_collected",
            {
                "intent_keys": list(report_inputs["intent"].keys()),
                "recon_keys": list(report_inputs["recon"].keys()),
                "attack_keys": list(report_inputs["attack"].keys()),
                "defense_keys": list(report_inputs["defense"].keys()),
                "trace_keys": list(report_inputs["trace"].keys()),
            },
        )

        system_prompt = (
            "You are a senior smart contract security auditor writing a final report for clients. "
            "Produce a professional, clear Markdown report. "
            "Use concise technical language and actionable remediation guidance. "
            "Output Markdown only."
        )
        user_prompt = self._build_user_prompt(report_inputs)
        messages = [{"role": "user", "content": user_prompt}]
        self.log_step(
            "report_prompt_built",
            {
                "system_preview": system_prompt[:300],
                "user_prompt_chars": len(user_prompt),
                "message_count": len(messages),
            },
        )

        report_md = (await self.call_llm(system_extra=system_prompt, messages=messages)).strip()
        self.log_step(
            "report_llm_response_received",
            {
                "report_chars": len(report_md),
                "report_preview": report_md[:1000],
            },
        )

        if not report_md:
            self.log_step("report_llm_empty_response", {"fallback": "template"})
            report_md = self._build_fallback_report(report_inputs)

        report_md = self._ensure_required_sections(report_md, report_inputs)
        summary = self._extract_summary(report_md)
        self.log_step("report_summary_extracted", {"summary_preview": summary[:500]})

        trace_id = self._resolve_trace_id(report_inputs["trace"])
        report_path = self._save_report(trace_id, report_md)
        self.log_step(
            "report_saved",
            {"trace_id": trace_id, "report_path": str(report_path)},
        )

        result = {
            "report_md": report_md,
            "report_path": str(report_path),
            "summary": summary,
        }
        self.log_step("report_run_completed", {"result_keys": list(result.keys())})
        return result

    def _collect_report_inputs(self, context: dict) -> dict[str, Any]:
        intent = context.get("intent_output")
        if not isinstance(intent, dict):
            intent = {
                "task": context.get("task"),
                "scope": context.get("scope"),
                "risk_level": context.get("risk_level"),
                "skills": context.get("skills"),
                "budget": context.get("budget"),
            }

        recon = context.get("recon_output")
        if not isinstance(recon, dict):
            recon = {
                "contract_map": context.get("contract_map", {}),
                "functions": context.get("functions", []),
                "state_vars": context.get("state_vars", []),
                "external_calls": context.get("external_calls", []),
                "entry_points": context.get("entry_points", []),
                "risk_surface": context.get("risk_surface", []),
            }

        attack = context.get("attack_output")
        if not isinstance(attack, dict):
            attack = {
                "vulnerabilities": context.get("vulnerabilities", []),
                "attack_summary": context.get("attack_summary", ""),
            }

        defense = context.get("defense_output")
        if not isinstance(defense, dict):
            defense = {
                "reviewed_vulnerabilities": context.get("reviewed_vulnerabilities", []),
                "overall_security_score": context.get("overall_security_score"),
            }

        trace = context.get("trace_output")
        if not isinstance(trace, dict):
            trace = {
                "trace_id": context.get("trace_id"),
                "input_hash": context.get("input_hash"),
                "output_hash": context.get("output_hash"),
                "timestamp": context.get("timestamp"),
            }

        return {
            "intent": intent,
            "recon": recon,
            "attack": attack,
            "defense": defense,
            "trace": trace,
            "raw_input": context.get("raw_input", ""),
            "contract_paths": context.get("contract_paths", []),
            "assumptions": context.get("assumptions", []),
        }

    def _build_user_prompt(self, report_inputs: dict[str, Any]) -> str:
        required_sections = [
            "Executive Summary",
            "Scope & Methodology",
            "Critical Findings (from AttackAgent, validated by DefenseAgent)",
            "Risk Matrix Table (severity × likelihood)",
            "Detailed Vulnerability Breakdown (per finding with code snippets and fix)",
            "Security Score (from DefenseAgent)",
            "Recommendations",
            "Appendix: Reasoning Trace Hash",
        ]
        payload = json.dumps(report_inputs, indent=2, default=str)
        sections_text = "\n".join(f"- {section}" for section in required_sections)
        return (
            "Create the final audit report from these agent outputs.\n"
            "Requirements:\n"
            f"{sections_text}\n"
            "Use markdown headings and include code fences for exploit/fix/test snippets.\n"
            "For Critical Findings, cross-reference attack and defense outputs.\n"
            "Include a markdown risk matrix table (severity x likelihood).\n"
            "Use the trace output hash in the appendix as the reasoning trace hash.\n\n"
            "Agent outputs and context:\n"
            f"{payload}"
        )

    def _ensure_required_sections(self, report_md: str, report_inputs: dict[str, Any]) -> str:
        required_sections = [
            "Executive Summary",
            "Scope & Methodology",
            "Critical Findings (from AttackAgent, validated by DefenseAgent)",
            "Risk Matrix Table (severity × likelihood)",
            "Detailed Vulnerability Breakdown (per finding with code snippets and fix)",
            "Security Score (from DefenseAgent)",
            "Recommendations",
            "Appendix: Reasoning Trace Hash",
        ]
        lower_report = report_md.lower()
        missing: list[str] = []
        for section in required_sections:
            if section.lower() not in lower_report:
                missing.append(section)

        if not missing:
            return report_md

        appendix_hash = (
            report_inputs.get("trace", {}).get("output_hash")
            or report_inputs.get("trace", {}).get("input_hash")
            or "unavailable"
        )
        additions: list[str] = []
        for section in missing:
            additions.append(f"## {section}")
            if section == "Appendix: Reasoning Trace Hash":
                additions.append(f"Reasoning trace hash: `{appendix_hash}`")
            else:
                additions.append("Content unavailable in initial model output.")
            additions.append("")

        return f"{report_md.rstrip()}\n\n" + "\n".join(additions).rstrip() + "\n"

    def _build_fallback_report(self, report_inputs: dict[str, Any]) -> str:
        attack = report_inputs.get("attack", {})
        defense = report_inputs.get("defense", {})
        trace = report_inputs.get("trace", {})
        vulnerabilities = attack.get("vulnerabilities", [])
        vuln_count = len(vulnerabilities) if isinstance(vulnerabilities, list) else 0
        security_score = defense.get("overall_security_score", "N/A")
        reasoning_hash = trace.get("output_hash") or trace.get("input_hash") or "unavailable"

        return (
            "# Smart Contract Security Audit Report\n\n"
            "## Executive Summary\n"
            f"Assessment completed. {vuln_count} potential findings were identified.\n\n"
            "## Scope & Methodology\n"
            "Static review and adversarial reasoning were applied across provided contracts.\n\n"
            "## Critical Findings (from AttackAgent, validated by DefenseAgent)\n"
            "Findings require manual review due to unavailable model narrative output.\n\n"
            "## Risk Matrix Table (severity × likelihood)\n"
            "| Severity | Likelihood | Notes |\n"
            "|---|---|---|\n"
            "| Critical | Medium | Requires further validation |\n"
            "| High | Medium | Requires further validation |\n"
            "| Medium | Medium | Requires further validation |\n"
            "| Low | Low | Requires further validation |\n\n"
            "## Detailed Vulnerability Breakdown (per finding with code snippets and fix)\n"
            "Detailed breakdown unavailable from model output.\n\n"
            "## Security Score (from DefenseAgent)\n"
            f"Security Score: **{security_score} / 100**\n\n"
            "## Recommendations\n"
            "Prioritize validation and remediation of high-impact findings.\n\n"
            "## Appendix: Reasoning Trace Hash\n"
            f"Reasoning trace hash: `{reasoning_hash}`\n"
        )

    def _extract_summary(self, report_md: str) -> str:
        lines = report_md.splitlines()
        summary_lines: list[str] = []
        in_exec_summary = False

        for line in lines:
            stripped = line.strip()
            if stripped.startswith("#"):
                header = stripped.lstrip("#").strip().lower()
                if header == "executive summary":
                    in_exec_summary = True
                    continue
                if in_exec_summary:
                    break
            if in_exec_summary and stripped:
                summary_lines.append(stripped)
                if len(" ".join(summary_lines)) >= 300:
                    break

        if summary_lines:
            return " ".join(summary_lines)[:500]

        for line in lines:
            stripped = line.strip()
            if stripped and not stripped.startswith("#"):
                return stripped[:500]

        return "Audit report generated."

    def _resolve_trace_id(self, trace: dict[str, Any]) -> str:
        trace_id = trace.get("trace_id")
        if trace_id:
            return str(trace_id)
        return str(uuid4())

    def _save_report(self, trace_id: str, report_md: str) -> Path:
        reports_dir = Path.cwd() / "reports"
        reports_dir.mkdir(parents=True, exist_ok=True)
        report_path = reports_dir / f"{trace_id}.md"
        report_path.write_text(report_md, encoding="utf-8")
        return report_path
