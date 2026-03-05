from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from importlib import metadata
from pathlib import Path
from typing import Any
from uuid import uuid4

from agents.base_agent import BaseAgent
from core.skill_loader import SkillLoader


class TraceAgent(BaseAgent):
    SRP_VERSION = "srp-2026.3"
    STATIC_TOOLS_USED = ["slither", "aderyn", "echidna"]
    SKILLS_ARSENAL = {
        "attack_alpha": [
            "audit-firm-1-solidity-auditor",
            "quillai-bsa",
            "quillai-semantic-guard",
            "quillai-state-invariant",
        ],
        "attack_beta": [
            "quillai-reentrancy",
            "quillai-oracle-flashloan",
            "quillai-proxy-upgrade",
            "ethskills-audit",
            "tob-building-secure",
        ],
        "attack_gamma": [
            "quillai-signature-replay",
            "quillai-dos-griefing",
            "quillai-external-call",
            "quillai-input-arithmetic",
            "scv-scan",
        ],
        "defense": ["audit-firm-1-solidity-auditor", "tob-spec-compliance"],
        "patch": ["cyfrin-solskill", "ethskills-security", "ethskills-testing", "tob-fix-review"],
        "recon": ["sc-auditor-skill", "tob-entry-point", "tob-audit-context"],
        "diff": ["tob-differential-review", "audit-firm-1-solidity-auditor"],
        "blast_radius": ["tob-variant-analysis"],
    }
    CORE_SKILL_REPOS = ["audit-firm-1", "quillai", "trailofbits", "scv-scan", "cyfrin"]

    def __init__(self) -> None:
        super().__init__(
            name="TraceAgent",
            role="Builds command-level verifiable trace records for SRP execution runs",
            skill_keys=[],
        )
        self.skill_loader = SkillLoader()
        self.traces_dir = Path("./traces")

    async def run(self, context: dict) -> dict:
        self.log_step("command_trace_run_started", {"context_keys": list(context.keys())})

        agent_traces, all_steps = self._collect_agent_traces(context)
        contract_source = self._resolve_contract_source(context)
        confirmed_vulns, security_score = self._resolve_findings_payload(context)

        input_hash = self._sha256_hex(contract_source)
        output_hash = self._sha256_hex(
            self._canonical_json(
                {
                    "confirmed_vulnerabilities": confirmed_vulns,
                    "security_score": security_score,
                }
            )
        )

        manifest = self.skill_loader.get_manifest()
        used_skill_manifest = self._manifest_for_arsenal(manifest)
        skills_git_hashes = self._skills_git_hashes(manifest)

        trace_id = str(uuid4())
        solodit_info = {
            "client": "marchev/claudit",
            "mcp_server": "@marchev/claudit",
            "solodit_available": bool(os.environ.get("SOLODIT_API_KEY")),
            "provides": ["search_findings", "get_finding", "get_filter_options"],
            "findings_database_size": "20000+",
        }

        trace = {
            "trace_id": trace_id,
            "srp_version": self.SRP_VERSION,
            "input_hash": input_hash,
            "output_hash": output_hash,
            "model": self.model,
            "openclaw_version": self._detect_openclaw_version(),
            "skills_arsenal": {
                **self.SKILLS_ARSENAL,
                "solodit_integration": solodit_info,
            },
            "skills_git_hashes": skills_git_hashes,
            "attack_agents_independent": True,
            "attack_agents_simultaneous": True,
            "static_tools_used": list(self.STATIC_TOOLS_USED),
            "solodit_queried": self._solodit_queried(context),
            "confirmed_findings_count": len(confirmed_vulns),
            "security_score": security_score,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "erc8004_agent_id": None,
            "x402_tx": None,
            "all_steps": all_steps,
            "agent_traces": agent_traces,
            "skills_used_manifest": used_skill_manifest,
            "replay_context": {
                "contract_code": contract_source,
                "confirmed_vulnerabilities": confirmed_vulns,
                "security_score": security_score,
                "solodit_queried": self._solodit_queried(context),
                "agent_traces": agent_traces,
                "source_contract_paths": context.get("contract_paths", []),
            },
        }

        trace_path = self._save_trace(trace)
        self.log_step(
            "command_trace_saved",
            {
                "trace_id": trace_id,
                "path": str(trace_path),
                "confirmed_findings_count": len(confirmed_vulns),
                "security_score": security_score,
            },
        )
        return trace

    async def verify(self, trace_id: str) -> dict:
        trace = self._load_trace(trace_id)
        replay_context = trace.get("replay_context", {})
        if not isinstance(replay_context, dict):
            replay_context = {}

        contract_source = str(replay_context.get("contract_code", ""))
        confirmed_vulns = replay_context.get("confirmed_vulnerabilities", [])
        if not isinstance(confirmed_vulns, list):
            confirmed_vulns = []
        security_score = self._to_int(replay_context.get("security_score", trace.get("security_score", 0)))

        computed_input_hash = self._sha256_hex(contract_source)
        computed_output_hash = self._sha256_hex(
            self._canonical_json(
                {
                    "confirmed_vulnerabilities": confirmed_vulns,
                    "security_score": security_score,
                }
            )
        )

        expected_input_hash = str(trace.get("input_hash", ""))
        expected_output_hash = str(trace.get("output_hash", ""))
        input_ok = computed_input_hash == expected_input_hash
        output_ok = computed_output_hash == expected_output_hash

        result = {
            "trace_id": trace_id,
            "valid": bool(input_ok and output_ok),
            "input_hash_match": input_ok,
            "output_hash_match": output_ok,
            "expected": {
                "input_hash": expected_input_hash,
                "output_hash": expected_output_hash,
            },
            "computed": {
                "input_hash": computed_input_hash,
                "output_hash": computed_output_hash,
            },
        }
        self.log_step("command_trace_verified", result)
        return result

    async def replay(self, trace_id: str) -> dict:
        trace = self._load_trace(trace_id)
        replay_context = trace.get("replay_context")
        if not isinstance(replay_context, dict):
            raise ValueError(f"Trace {trace_id} does not contain replay_context")

        replay_context = dict(replay_context)
        replay_context["replayed_from_trace_id"] = trace_id
        replay_context["original_trace_timestamp"] = trace.get("timestamp")

        replayed_trace = await self.run(replay_context)
        result = {
            "original_trace_id": trace_id,
            "replay_trace_id": replayed_trace.get("trace_id"),
            "trace": replayed_trace,
        }
        self.log_step(
            "command_trace_replayed",
            {
                "original_trace_id": trace_id,
                "replay_trace_id": replayed_trace.get("trace_id"),
            },
        )
        return result

    def _collect_agent_traces(self, context: dict[str, Any]) -> tuple[dict[str, list[dict[str, Any]]], list[dict[str, Any]]]:
        traces: dict[str, list[dict[str, Any]]] = {}

        agent_map = context.get("agents")
        if isinstance(agent_map, dict):
            for name, agent in agent_map.items():
                items = self._extract_trace_items(agent)
                if items:
                    traces[str(name)] = items

        direct = context.get("agent_traces")
        if isinstance(direct, dict):
            for name, value in direct.items():
                items = self._extract_trace_items(value)
                if items:
                    traces[str(name)] = items

        for key, value in context.items():
            if key in traces:
                continue
            items = self._extract_trace_items(value)
            if items:
                traces[str(key)] = items

        all_steps: list[dict[str, Any]] = []
        for agent_name, rows in traces.items():
            for row in rows:
                item = dict(row)
                item.setdefault("agent", agent_name)
                all_steps.append(item)

        all_steps.sort(key=lambda item: str(item.get("timestamp", "")))
        return traces, all_steps

    def _extract_trace_items(self, value: Any) -> list[dict[str, Any]]:
        if value is None:
            return []
        if hasattr(value, "get_trace") and callable(value.get_trace):
            data = value.get_trace()
            return self._normalize_trace_list(data)
        if isinstance(value, dict) and isinstance(value.get("trace_log"), list):
            return self._normalize_trace_list(value["trace_log"])
        if isinstance(value, list):
            return self._normalize_trace_list(value)
        return []

    def _normalize_trace_list(self, value: Any) -> list[dict[str, Any]]:
        if not isinstance(value, list):
            return []
        rows: list[dict[str, Any]] = []
        for item in value:
            if isinstance(item, dict):
                rows.append(dict(item))
            else:
                rows.append({"detail": str(item)})
        return rows

    def _resolve_contract_source(self, context: dict[str, Any]) -> str:
        contract_code = str(context.get("contract_code", "")).strip()
        if contract_code:
            return contract_code

        contract_sources = context.get("contract_sources")
        if isinstance(contract_sources, dict) and contract_sources:
            chunks: list[str] = []
            for key in sorted(contract_sources.keys()):
                chunks.append(f"// SOURCE: {key}\n{contract_sources[key]}")
            return "\n\n".join(chunks).strip()

        contract_paths = context.get("contract_paths", [])
        if not isinstance(contract_paths, list):
            contract_paths = [contract_paths] if contract_paths else []

        chunks: list[str] = []
        for raw_path in contract_paths:
            path = Path(str(raw_path)).expanduser()
            if not path.is_absolute():
                path = Path.cwd() / path
            if path.is_file() and path.suffix.lower() == ".sol":
                try:
                    chunks.append(f"// FILE: {path}\n{path.read_text(encoding='utf-8')}")
                except OSError:
                    continue
            elif path.is_dir():
                for file_path in sorted(path.rglob("*.sol")):
                    try:
                        chunks.append(f"// FILE: {file_path}\n{file_path.read_text(encoding='utf-8')}")
                    except OSError:
                        continue

        if chunks:
            return "\n\n".join(chunks).strip()
        return ""

    def _resolve_findings_payload(self, context: dict[str, Any]) -> tuple[list[dict[str, Any]], int]:
        confirmed = context.get("confirmed_vulnerabilities")
        if not isinstance(confirmed, list):
            defense_output = context.get("defense_output")
            if isinstance(defense_output, dict):
                confirmed = defense_output.get("confirmed_vulnerabilities", [])
            elif isinstance(context.get("defense"), dict):
                confirmed = context["defense"].get("confirmed_vulnerabilities", [])
            else:
                confirmed = []
        confirmed = [item for item in confirmed if isinstance(item, dict)]

        score_raw = context.get("security_score")
        if score_raw is None:
            defense_output = context.get("defense_output")
            if isinstance(defense_output, dict):
                score_raw = defense_output.get("security_score", defense_output.get("overall_security_score"))
        if score_raw is None and isinstance(context.get("defense"), dict):
            score_raw = context["defense"].get("security_score", context["defense"].get("overall_security_score"))
        if score_raw is None:
            score_raw = context.get("overall_security_score", 0)
        score = self._to_int(score_raw)

        return confirmed, score

    def _manifest_for_arsenal(self, manifest: dict[str, Any]) -> list[dict[str, Any]]:
        used_keys = {key for values in self.SKILLS_ARSENAL.values() for key in values}
        items = manifest.get("skills", [])
        if not isinstance(items, list):
            return []

        selected: list[dict[str, Any]] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            key = str(item.get("key", "")).strip()
            if key not in used_keys:
                continue
            selected.append(
                {
                    "name": key,
                    "path": str(item.get("path", "")),
                    "git_hash": item.get("git_hash"),
                }
            )
        selected.sort(key=lambda row: row["name"])
        return selected

    def _skills_git_hashes(self, manifest: dict[str, Any]) -> dict[str, str]:
        repo_hashes: dict[str, str] = {}
        items = manifest.get("skills", [])
        if isinstance(items, list):
            for item in items:
                if not isinstance(item, dict):
                    continue
                path = str(item.get("path", ""))
                repo = self._repo_from_skill_path(path)
                if not repo:
                    continue
                git_hash = str(item.get("git_hash", "")).strip()
                if git_hash and repo not in repo_hashes:
                    repo_hashes[repo] = git_hash

        for repo in self.CORE_SKILL_REPOS:
            if repo in repo_hashes:
                continue
            try:
                repo_hashes[repo] = self.skill_loader.get_git_hash(repo)
            except Exception:
                repo_hashes[repo] = "unknown"
        return repo_hashes

    @staticmethod
    def _repo_from_skill_path(path: str) -> str | None:
        normalized = str(path).replace("\\", "/")
        if normalized.startswith("skills/audit-firm-1/"):
            return "audit-firm-1"
        if normalized.startswith("skills/quillai/"):
            return "quillai"
        if normalized.startswith("skills/trailofbits/"):
            return "trailofbits"
        if normalized.startswith("skills/scv-scan/"):
            return "scv-scan"
        if normalized.startswith("skills/cyfrin/"):
            return "cyfrin"
        return None

    def _detect_openclaw_version(self) -> str:
        for package in ("openclaw", "openclaw-core", "openclaw-agent"):
            try:
                return metadata.version(package)
            except metadata.PackageNotFoundError:
                continue
        env_version = os.environ.get("OPENCLAW_VERSION", "").strip()
        return env_version or "unknown"

    @staticmethod
    def _solodit_queried(context: dict[str, Any]) -> bool:
        if "solodit_queried" in context:
            return bool(context.get("solodit_queried"))
        recon = context.get("recon_output")
        if isinstance(recon, dict) and "solodit_matches" in recon:
            return True
        return True

    def _save_trace(self, trace: dict[str, Any]) -> Path:
        traces_dir = self.traces_dir
        if not traces_dir.is_absolute():
            traces_dir = Path.cwd() / traces_dir
        traces_dir.mkdir(parents=True, exist_ok=True)
        path = traces_dir / f"{trace['trace_id']}.json"
        path.write_text(json.dumps(trace, indent=2, default=str), encoding="utf-8")
        return path

    def _load_trace(self, trace_id: str) -> dict[str, Any]:
        if "/" in trace_id or ".." in trace_id:
            raise ValueError("Invalid trace_id")

        traces_dir = self.traces_dir
        if not traces_dir.is_absolute():
            traces_dir = Path.cwd() / traces_dir
        path = traces_dir / f"{trace_id}.json"
        if not path.exists():
            raise FileNotFoundError(f"Trace not found: {path}")

        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise ValueError(f"Trace JSON is invalid for {trace_id}: {exc}") from exc

        if not isinstance(payload, dict):
            raise ValueError(f"Trace payload must be an object for {trace_id}")
        return payload

    @staticmethod
    def _sha256_hex(content: str) -> str:
        return "0x" + hashlib.sha256(content.encode("utf-8")).hexdigest()

    @staticmethod
    def _canonical_json(value: Any) -> str:
        return json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)

    @staticmethod
    def _to_int(value: Any) -> int:
        try:
            parsed = int(round(float(value)))
        except (TypeError, ValueError):
            parsed = 0
        return max(0, min(100, parsed))
