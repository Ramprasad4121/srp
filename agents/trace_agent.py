from __future__ import annotations

import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from .base_agent import BaseAgent


class TraceAgent(BaseAgent):
    def __init__(self, model: str = "claude-sonnet-4-20250514") -> None:
        super().__init__(
            name="TraceAgent",
            role="Produces a verifiable cryptographic trace of the full audit run",
        )

    async def run(self, context: dict) -> dict:
        self.log_step("trace_run_started", {"context_keys": list(context.keys())})

        collected = self._collect_agent_traces(context)
        skill_sequence = collected["skill_sequence"]
        all_steps = collected["all_steps"]
        self.log_step(
            "trace_agent_logs_collected",
            {
                "skill_sequence": skill_sequence,
                "all_step_count": len(all_steps),
            },
        )

        input_hash, input_meta = self._compute_input_hash(context)
        self.log_step(
            "trace_input_hash_computed",
            {
                "input_hash": input_hash,
                "sol_file_count": input_meta["sol_file_count"],
                "failed_files": input_meta["failed_files"],
            },
        )

        output_hash = self._compute_output_hash(context)
        self.log_step("trace_output_hash_computed", {"output_hash": output_hash})

        skills_used = self._build_skills_used()
        self.log_step("trace_skills_resolved", {"skills_used": skills_used})

        assumptions = self._normalize_assumptions(context.get("assumptions", []))
        confidence = self._derive_confidence(context)
        timestamp = datetime.now(timezone.utc).isoformat()
        trace_id = str(uuid4())

        if self.name not in skill_sequence:
            skill_sequence = [*skill_sequence, self.name]

        trace = {
            "trace_id": trace_id,
            "input_hash": input_hash,
            "output_hash": output_hash,
            "agent_version": "srp-2026.1",
            "model": self.model,
            "skill_sequence": skill_sequence,
            "skills_used": skills_used,
            "all_steps": all_steps,
            "assumptions": assumptions,
            "confidence": confidence,
            "timestamp": timestamp,
            "erc8004_agent_id": None,
            "x402_tx": None,
        }

        trace_path = self._save_trace(trace)
        self.log_step("trace_saved", {"path": str(trace_path)})
        self.log_step("trace_run_completed", {"trace_id": trace_id})

        return trace

    def _collect_agent_traces(self, context: dict) -> dict[str, Any]:
        agent_order = [
            ("IntentAgent", "intent"),
            ("ReconAgent", "recon"),
            ("AttackAgent", "attack"),
            ("DefenseAgent", "defense"),
        ]
        all_steps: list[dict[str, Any]] = []
        skill_sequence: list[str] = []

        for agent_name, prefix in agent_order:
            trace_items = self._get_trace_items(context, agent_name, prefix)
            if not trace_items:
                continue

            skill_sequence.append(agent_name)
            for item in trace_items:
                if isinstance(item, dict):
                    step = dict(item)
                else:
                    step = {"detail": str(item)}
                step.setdefault("agent", agent_name)
                all_steps.append(step)

        all_steps = self._sort_steps(all_steps)
        return {
            "skill_sequence": skill_sequence,
            "all_steps": all_steps,
        }

    def _get_trace_items(self, context: dict, agent_name: str, prefix: str) -> list:
        # Preferred: packed map like {"IntentAgent": [...]} or {"intent": [...]}.
        agent_traces = context.get("agent_traces", {})
        if isinstance(agent_traces, dict):
            for key in (agent_name, prefix):
                value = agent_traces.get(key)
                items = self._extract_trace_items(value)
                if items:
                    return items

        # Common direct keys for traces or agent objects.
        candidate_keys = [
            f"{prefix}_trace",
            f"{prefix}_trace_log",
            f"{prefix}_agent",
            agent_name,
            agent_name.lower(),
        ]
        for key in candidate_keys:
            if key not in context:
                continue
            items = self._extract_trace_items(context.get(key))
            if items:
                return items

        return []

    def _extract_trace_items(self, value: Any) -> list:
        if value is None:
            return []
        if isinstance(value, list):
            return value
        if isinstance(value, dict):
            if isinstance(value.get("trace_log"), list):
                return value["trace_log"]
            return [value]
        if hasattr(value, "get_trace") and callable(value.get_trace):
            trace = value.get_trace()
            return trace if isinstance(trace, list) else []
        return []

    def _compute_input_hash(self, context: dict) -> tuple[str, dict[str, Any]]:
        contract_paths = context.get("contract_paths", [])
        if not isinstance(contract_paths, list):
            contract_paths = [contract_paths]

        sol_files = self._collect_sol_files(contract_paths)
        source_chunks: list[str] = []
        failed_files: list[dict[str, str]] = []

        for file_path in sorted(sol_files):
            try:
                content = Path(file_path).read_text(encoding="utf-8")
                source_chunks.append(f"FILE:{file_path}\n{content}\n")
            except OSError as exc:
                failed_files.append({"path": file_path, "error": str(exc)})

        if source_chunks:
            input_blob = "\n".join(source_chunks)
        else:
            fallback_source = context.get("contract_sources", context.get("raw_input", ""))
            input_blob = self._to_canonical_json(fallback_source)

        digest = hashlib.sha256(input_blob.encode("utf-8")).hexdigest()
        meta = {"sol_file_count": len(sol_files), "failed_files": failed_files}
        return digest, meta

    def _collect_sol_files(self, contract_paths: list[Any]) -> list[str]:
        discovered: list[str] = []
        seen: set[str] = set()

        for raw_path in contract_paths:
            if raw_path is None:
                continue

            path = Path(str(raw_path)).expanduser()
            if not path.is_absolute():
                path = Path.cwd() / path

            if path.is_file() and path.suffix == ".sol":
                resolved = str(path.resolve())
                if resolved not in seen:
                    seen.add(resolved)
                    discovered.append(resolved)
                continue

            if path.is_dir():
                for sol_file in sorted(path.rglob("*.sol")):
                    resolved = str(sol_file.resolve())
                    if resolved not in seen:
                        seen.add(resolved)
                        discovered.append(resolved)

        return discovered

    def _compute_output_hash(self, context: dict) -> str:
        final_findings = context.get("final_findings")
        if final_findings is None:
            if "defense_output" in context:
                final_findings = context["defense_output"]
            elif "reviewed_vulnerabilities" in context or "overall_security_score" in context:
                final_findings = {
                    "reviewed_vulnerabilities": context.get("reviewed_vulnerabilities", []),
                    "overall_security_score": context.get("overall_security_score"),
                }
            else:
                final_findings = {
                    "vulnerabilities": context.get("vulnerabilities", []),
                    "attack_summary": context.get("attack_summary", ""),
                }

        findings_blob = self._to_canonical_json(final_findings)
        return hashlib.sha256(findings_blob.encode("utf-8")).hexdigest()

    def _derive_confidence(self, context: dict) -> float:
        explicit = context.get("confidence")
        if explicit is not None:
            return self._clamp_float(explicit, minimum=0.0, maximum=1.0, default=0.5)

        overall_security_score = context.get("overall_security_score")
        if overall_security_score is None and isinstance(context.get("defense_output"), dict):
            overall_security_score = context["defense_output"].get("overall_security_score")
        if overall_security_score is not None:
            score = self._clamp_float(
                overall_security_score, minimum=0.0, maximum=100.0, default=50.0
            )
            return round(score / 100.0, 4)

        vulnerabilities = context.get("vulnerabilities", [])
        if isinstance(vulnerabilities, list) and vulnerabilities:
            confidence_values: list[float] = []
            for vulnerability in vulnerabilities:
                if not isinstance(vulnerability, dict):
                    continue
                if "confidence" not in vulnerability:
                    continue
                confidence_values.append(
                    self._clamp_float(vulnerability["confidence"], 0.0, 1.0, 0.0)
                )
            if confidence_values:
                return round(sum(confidence_values) / len(confidence_values), 4)

        return 0.5

    def _normalize_assumptions(self, assumptions: Any) -> list[str]:
        if assumptions is None:
            return []
        if isinstance(assumptions, list):
            return [str(item).strip() for item in assumptions if str(item).strip()]
        assumption = str(assumptions).strip()
        return [assumption] if assumption else []

    def _build_skills_used(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "solidity-auditor",
                "source": "audit-skills",
                "git_hash": self._resolve_skills_git_hash(),
                "applied_to": ["AttackAgent", "DefenseAgent"],
            }
        ]

    def _resolve_skills_git_hash(self) -> str:
        try:
            result = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd="./audit-skills",
                check=True,
                capture_output=True,
                text=True,
            )
            git_hash = result.stdout.strip()
            return git_hash or "unknown"
        except (FileNotFoundError, subprocess.SubprocessError):
            return "unknown"

    def _save_trace(self, trace: dict[str, Any]) -> Path:
        traces_dir = Path.cwd() / "traces"
        traces_dir.mkdir(parents=True, exist_ok=True)
        trace_path = traces_dir / f"{trace['trace_id']}.json"
        trace_path.write_text(json.dumps(trace, indent=2, default=str), encoding="utf-8")
        return trace_path

    def _sort_steps(self, steps: list[dict[str, Any]]) -> list[dict[str, Any]]:
        # Keep deterministic ordering while preferring timestamps when present.
        return sorted(steps, key=lambda step: str(step.get("timestamp", "")))

    def _to_canonical_json(self, value: Any) -> str:
        return json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)

    def _clamp_float(
        self, value: Any, minimum: float, maximum: float, default: float
    ) -> float:
        try:
            float_value = float(value)
        except (TypeError, ValueError):
            return default
        return max(minimum, min(maximum, float_value))
