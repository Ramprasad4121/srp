from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any

from core.solodit_client import SoloditClient

from ..base_agent import BaseAgent


class ReconAgent(BaseAgent):
    def __init__(self) -> None:
        super().__init__(
            name="ReconAgent",
            role="Runs sc-auditor MAP recon with static tooling, entry-point mapping, and pattern cross-reference",
            skill_keys=[
                "sc-auditor-skill",
                "tob-entry-point",
                "tob-audit-context",
            ],
        )

    async def run(self, context: dict) -> dict:
        self.log_step("recon_run_started", {"context_keys": list(context.keys())})

        contract_paths = self._normalize_paths(context.get("contract_paths", []))
        if not contract_paths:
            raise ValueError("ReconAgent requires at least one contract path in context['contract_paths']")

        target_path = self._pick_analysis_target(contract_paths)
        sol_files = self._collect_sol_files(contract_paths)
        sources_text = self._load_sources(sol_files)

        self.log_step(
            "recon_inputs_ready",
            {
                "target_path": target_path,
                "contract_paths": contract_paths,
                "sol_file_count": len(sol_files),
            },
        )

        # Phase 1 — Static Analysis (Tools First)
        slither_findings, aderyn_findings, unified_findings = self._run_static_phase(target_path)

        # Phase 2 — Entry Point Mapping (Trail of Bits methodology)
        entry_points = await self._run_entrypoint_phase(sources_text, unified_findings)

        # Phase 3 — Solodit Cross-Reference via claudit
        solodit = SoloditClient()
        solodit_matches: list[dict[str, Any]] = []

        function_names = [
            str(ep.get("function_name", "")).strip() for ep in entry_points[:10] if ep.get("function_name")
        ]

        if solodit.available and function_names:
            solodit_matches = await solodit.match_contract_patterns(
                function_names=function_names,
                contract_type=context.get("contract_type", "")
            )
            self.log_step("solodit_cross_reference", {
                "searched_terms": function_names,
                "matches_found": len(solodit_matches),
                "source": "claudit-solodit-mcp"
            })
        else:
            self.log_step("solodit_cross_reference", {
                "status": "skipped",
                "reason": "SOLODIT_API_KEY not set"
            })

        # Phase 4 — System Map (sc-auditor MAP methodology)
        system_map, invariants = await self._run_system_map_phase(
            sources_text=sources_text,
            entry_points=entry_points,
            unified_findings=unified_findings,
            solodit_matches=solodit_matches,
        )

        result = {
            "slither_findings": slither_findings,
            "aderyn_findings": aderyn_findings,
            "entry_points": entry_points,
            "solodit_matches": solodit_matches,
            "system_map": system_map,
            "invariants": invariants,
        }
        self.log_step(
            "recon_run_completed",
            {
                "slither_findings": len(slither_findings),
                "aderyn_findings": len(aderyn_findings),
                "entry_points": len(entry_points),
                "solodit_matches": len(solodit_matches),
                "invariants": len(invariants),
            },
        )
        return result

    def _run_static_phase(self, target_path: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
        self.log_step("phase_1_static_analysis_started", {"target_path": target_path})

        slither_out = Path("slither_out.json")
        aderyn_out = Path("aderyn_out.json")

        slither_proc = self._run_command(["slither", target_path, "--json", str(slither_out)], "slither")
        aderyn_proc = self._run_command(["aderyn", target_path, "--output", str(aderyn_out)], "aderyn")

        slither_findings = self._parse_slither_output(slither_out, slither_proc)
        aderyn_findings = self._parse_aderyn_output(aderyn_out, aderyn_proc)

        unified_findings = [*slither_findings, *aderyn_findings]
        self.log_step(
            "phase_1_static_analysis_completed",
            {
                "slither_findings": len(slither_findings),
                "aderyn_findings": len(aderyn_findings),
                "unified_findings": len(unified_findings),
            },
        )
        return slither_findings, aderyn_findings, unified_findings

    async def _run_entrypoint_phase(
        self, sources_text: str, unified_findings: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        self.log_step("phase_2_entrypoint_mapping_started", {"findings_count": len(unified_findings)})

        system_prompt = (
            "Phase 2 - Entry Point Mapping using Trail of Bits style analysis. "
            "Identify all external/public state-changing functions. "
            "Return ONLY valid JSON with shape: "
            "{\"entry_points\": [{\"function_name\": str, \"visibility\": str, \"modifiers\": [str], "
            "\"state_changes\": [str], \"external_calls\": [str]}]}. "
            "Only include state-changing entry points."
        )
        payload = {
            "sources": sources_text,
            "static_findings": unified_findings[:300],
        }

        response = await self.call_llm(
            system_extra=system_prompt,
            messages=[{"role": "user", "content": json.dumps(payload, default=str)}],
        )

        parsed = self._parse_json(response, default={"entry_points": []})
        entry_points = parsed.get("entry_points", [])
        if not isinstance(entry_points, list):
            entry_points = []
        normalized = [ep for ep in entry_points if isinstance(ep, dict)]

        self.log_step("phase_2_entrypoint_mapping_completed", {"entry_points": len(normalized)})
        return normalized

    async def _run_system_map_phase(
        self,
        sources_text: str,
        entry_points: list[dict[str, Any]],
        unified_findings: list[dict[str, Any]],
        solodit_matches: list[dict[str, Any]],
    ) -> tuple[dict[str, Any], list[Any]]:
        self.log_step("phase_4_system_map_started", {"entry_points": len(entry_points)})

        system_prompt = (
            "Phase 4 - Build full system map using sc-auditor MAP methodology. "
            "Return ONLY valid JSON with shape: "
            "{\"system_map\": {\"components\": [str], \"trust_boundaries\": [str], \"upgrade_patterns\": [str]}, "
            "\"invariants\": [str]}. "
            "Capture architecture, trust boundaries, protocol invariants, and upgrade risks."
        )
        payload = {
            "sources": sources_text,
            "entry_points": entry_points,
            "static_findings": unified_findings[:300],
            "solodit_matches": solodit_matches[:200],
        }
        response = await self.call_llm(
            system_extra=system_prompt,
            messages=[{"role": "user", "content": json.dumps(payload, default=str)}],
        )
        parsed = self._parse_json(response, default={"system_map": {}, "invariants": []})

        system_map = parsed.get("system_map", {})
        invariants = parsed.get("invariants", [])
        if not isinstance(system_map, dict):
            system_map = {}
        if not isinstance(invariants, list):
            invariants = [invariants] if invariants else []

        self.log_step(
            "phase_4_system_map_completed",
            {"components": len(system_map.get("components", [])), "invariants": len(invariants)},
        )
        return system_map, invariants

    def _run_command(self, command: list[str], tool_name: str) -> dict[str, Any]:
        try:
            proc = subprocess.run(command, check=False, capture_output=True, text=True)
        except FileNotFoundError as exc:
            self.log_step(
                "tool_execution_failed",
                {"tool": tool_name, "command": command, "error": str(exc)},
            )
            return {"returncode": 127, "stdout": "", "stderr": str(exc)}

        self.log_step(
            "tool_execution_completed",
            {
                "tool": tool_name,
                "command": command,
                "returncode": proc.returncode,
                "stderr_preview": (proc.stderr or "")[:500],
            },
        )
        return {"returncode": proc.returncode, "stdout": proc.stdout, "stderr": proc.stderr}

    def _parse_slither_output(self, output_file: Path, proc: dict[str, Any]) -> list[dict[str, Any]]:
        if not output_file.exists():
            self.log_step(
                "slither_output_missing",
                {"returncode": proc.get("returncode"), "stderr": proc.get("stderr", "")[:500]},
            )
            return []

        data = self._parse_json(output_file.read_text(encoding="utf-8"), default={})
        detectors = data.get("results", {}).get("detectors", [])
        if not isinstance(detectors, list):
            detectors = []

        findings: list[dict[str, Any]] = []
        for item in detectors:
            if not isinstance(item, dict):
                continue
            findings.append(
                {
                    "source": "slither",
                    "title": item.get("check"),
                    "severity": item.get("impact"),
                    "confidence": item.get("confidence"),
                    "description": item.get("description"),
                    "elements": item.get("elements", []),
                }
            )
        return findings

    def _parse_aderyn_output(self, output_file: Path, proc: dict[str, Any]) -> list[dict[str, Any]]:
        if not output_file.exists():
            self.log_step(
                "aderyn_output_missing",
                {"returncode": proc.get("returncode"), "stderr": proc.get("stderr", "")[:500]},
            )
            return []

        data = self._parse_json(output_file.read_text(encoding="utf-8"), default={})
        if isinstance(data, list):
            raw_findings = data
        elif isinstance(data, dict):
            raw_findings = data.get("findings", data.get("issues", data.get("results", [])))
            if not isinstance(raw_findings, list):
                raw_findings = []
        else:
            raw_findings = []

        findings: list[dict[str, Any]] = []
        for item in raw_findings:
            if not isinstance(item, dict):
                continue
            findings.append(
                {
                    "source": "aderyn",
                    "title": item.get("title", item.get("name", item.get("check"))),
                    "severity": item.get("severity", item.get("impact")),
                    "description": item.get("description", item.get("message")),
                    "location": item.get("location", item.get("path")),
                }
            )
        return findings

    def _normalize_paths(self, raw_paths: Any) -> list[str]:
        if isinstance(raw_paths, list):
            items = raw_paths
        elif raw_paths:
            items = [raw_paths]
        else:
            items = []
        return [str(path) for path in items if str(path).strip()]

    def _pick_analysis_target(self, contract_paths: list[str]) -> str:
        first = Path(contract_paths[0]).expanduser()
        if not first.is_absolute():
            first = Path.cwd() / first
        return str(first)

    def _collect_sol_files(self, contract_paths: list[str]) -> list[Path]:
        files: list[Path] = []
        seen: set[str] = set()
        for raw in contract_paths:
            path = Path(raw).expanduser()
            if not path.is_absolute():
                path = Path.cwd() / path
            if path.is_file() and path.suffix == ".sol":
                resolved = str(path.resolve())
                if resolved not in seen:
                    seen.add(resolved)
                    files.append(path.resolve())
                continue
            if path.is_dir():
                for sol in sorted(path.rglob("*.sol")):
                    resolved = str(sol.resolve())
                    if resolved not in seen:
                        seen.add(resolved)
                        files.append(sol.resolve())
        return files

    def _load_sources(self, sol_files: list[Path]) -> str:
        chunks: list[str] = []
        for file_path in sol_files:
            try:
                content = file_path.read_text(encoding="utf-8")
                chunks.append(f"File: {file_path}\n```solidity\n{content}\n```")
            except OSError as exc:
                self.log_step(
                    "source_read_failed",
                    {"path": str(file_path), "error": str(exc)},
                )
        return "\n\n".join(chunks)

    def _parse_json(self, text: str, default: Any) -> Any:
        payload = text.strip()
        if payload.startswith("```"):
            lines = payload.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            payload = "\n".join(lines).strip()
        try:
            return json.loads(payload)
        except json.JSONDecodeError:
            return default
