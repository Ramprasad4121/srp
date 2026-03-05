from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any
from uuid import uuid4

from core.solodit_client import SoloditClient

from ..base_agent import BaseAgent


class AttackAgentBeta(BaseAgent):
    def __init__(self) -> None:
        super().__init__(
            name="AttackAgentBeta",
            role="Attack lane beta focused on EVM reentrancy, oracle/flash-loan, and proxy/upgrade risk",
            skill_keys=[
                "quillai-reentrancy",
                "quillai-oracle-flashloan",
                "quillai-proxy-upgrade",
                "ethskills-audit",
                "tob-building-secure",
            ],
        )
        self.angle = "evm_reentrancy_oracles_proxies"

    async def run(self, context: dict) -> dict:
        scoped_context = self._scope_context(context)
        self.log_step(
            "attack_beta_run_started",
            {
                "angle": self.angle,
                "scope_keys": list(scoped_context.keys()),
                "entry_points": len(scoped_context["entry_points"]),
                "invariants": len(scoped_context["invariants"]),
            },
        )

        pass_specs = [
            (
                "reentrancy",
                (
                    "Detect ALL reentrancy variants: classic (withdraw-before-update), cross-function, "
                    "cross-contract, read-only reentrancy, and ERC-777/ERC-1155 callback reentrancy. "
                    "Build call graph. Verify CEI pattern compliance for every external call."
                ),
            ),
            (
                "oracle_flashloan",
                (
                    "Classify every oracle used (Chainlink, TWAP, spot price). Check for: stale prices, "
                    "circular dependencies, single-block TWAP manipulation, flash loan atomicity exploitation. "
                    "For lending protocols, find the price manipulation vector."
                ),
            ),
            (
                "proxy_upgrade",
                (
                    "Detect: storage layout collisions, uninitialized implementations, function selector clashing, "
                    "upgrade path vulnerabilities. Covers Transparent, UUPS, Beacon, Diamond (EIP-2535), "
                    "Minimal proxy patterns."
                ),
            ),
            (
                "ethskills_checklist",
                (
                    "Run this contract through the full ethskills audit checklist. Focus on AMM, lending, oracle, "
                    "proxy, governance, and bridge domains. Flag every checklist item that applies."
                ),
            ),
        ]

        all_vulnerabilities: list[dict[str, Any]] = []
        for pass_name, pass_prompt in pass_specs:
            pass_vulns = await self._run_pass(
                pass_name=pass_name,
                pass_prompt=pass_prompt,
                scoped_context=scoped_context,
            )
            all_vulnerabilities.extend(pass_vulns)

        echidna_findings = self._run_echidna(scoped_context, context)
        normalized_vulns = self._dedupe_vulnerabilities(all_vulnerabilities)

        result = {
            "agent": "beta",
            "angle": self.angle,
            "passes": [
                "reentrancy",
                "oracle_flashloan",
                "proxy_upgrade",
                "ethskills_checklist",
            ],
            "vulnerabilities": normalized_vulns,
            "echidna_findings": echidna_findings,
        }
        self.log_step(
            "attack_beta_run_completed",
            {
                "total_vulnerabilities": len(normalized_vulns),
                "echidna_findings": len(echidna_findings),
            },
        )
        solodit = SoloditClient()
        if solodit.available and normalized_vulns:
            for vuln in normalized_vulns:
                real_findings = await solodit.search_findings(
                    keywords=vuln.get("title", ""),
                    tags=["Reentrancy", "Oracle", "Flash Loan", "Proxy"],
                    severity=["HIGH", "CRITICAL"],
                    sort_by="Quality",
                    page_size=3
                )
                if real_findings:
                    vuln["solodit_references"] = [
                        {
                            "id": f.get("id"),
                            "title": f.get("title"),
                            "severity": f.get("severity"),
                            "firm": f.get("firm")
                        }
                        for f in real_findings
                    ]
                    vuln["confidence"] = min(1.0, vuln.get("confidence", 0.5) + 0.15)
                    self.log_step("solodit_validation", {
                        "vuln": vuln["title"],
                        "references_found": len(real_findings),
                        "confidence_boosted": True
                    })
        return result

    def _scope_context(self, context: dict[str, Any]) -> dict[str, Any]:
        required_keys = {"contract_code", "system_map", "entry_points", "invariants"}
        missing = [key for key in sorted(required_keys) if key not in context]
        if missing:
            raise ValueError(f"AttackAgentBeta missing required context keys: {missing}")

        unexpected = [key for key in sorted(context.keys()) if key not in required_keys]
        if unexpected:
            self.log_step("attack_beta_context_isolated", {"ignored_keys": unexpected})

        entry_points = context.get("entry_points", [])
        invariants = context.get("invariants", [])
        system_map = context.get("system_map", {})

        if not isinstance(entry_points, list):
            entry_points = [entry_points]
        if not isinstance(invariants, list):
            invariants = [invariants]
        if not isinstance(system_map, dict):
            system_map = {}

        return {
            "contract_code": str(context.get("contract_code", "")),
            "system_map": system_map,
            "entry_points": entry_points,
            "invariants": invariants,
        }

    async def _run_pass(
        self, pass_name: str, pass_prompt: str, scoped_context: dict[str, Any]
    ) -> list[dict[str, Any]]:
        system_extra = (
            f"{pass_prompt}\n\n"
            "Return ONLY valid JSON with shape: "
            "{\"vulnerabilities\": ["
            "{\"id\": str, \"title\": str, \"severity\": \"low|medium|high|critical\", "
            "\"confidence\": number, \"affected_function\": str, \"description\": str, "
            "\"exploit_code_solidity\": str, \"quillai_severity_matrix\": object}"
            "]}."
        )
        user_payload = {
            "context": scoped_context,
            "pass": pass_name,
            "angle": self.angle,
        }
        messages = [{"role": "user", "content": json.dumps(user_payload, default=str)}]
        self.log_step(
            "attack_beta_pass_started",
            {
                "pass": pass_name,
                "message_count": len(messages),
                "prompt_preview": pass_prompt[:300],
            },
        )

        raw_output = await self.call_llm(system_extra=system_extra, messages=messages)
        parsed = self._parse_json_output(raw_output)
        raw_vulns = parsed.get("vulnerabilities", [])
        if not isinstance(raw_vulns, list):
            raw_vulns = []

        normalized = [
            self._normalize_vulnerability(item, pass_name, idx)
            for idx, item in enumerate(raw_vulns, start=1)
        ]
        self.log_step(
            "attack_beta_pass_completed",
            {"pass": pass_name, "vulnerability_count": len(normalized)},
        )
        return normalized

    def _run_echidna(
        self, scoped_context: dict[str, Any], original_context: dict[str, Any]
    ) -> list[dict[str, Any]]:
        path_value = original_context.get("contract_path")
        if not path_value:
            contract_paths = original_context.get("contract_paths", [])
            if isinstance(contract_paths, list) and contract_paths:
                path_value = contract_paths[0]

        if not path_value:
            self.log_step("echidna_skipped", {"reason": "no contract path in context"})
            return []

        target_path = Path(str(path_value)).expanduser()
        if not target_path.is_absolute():
            target_path = Path.cwd() / target_path
        target_path = target_path.resolve()

        command = [
            "echidna",
            str(target_path),
            "--config",
            "echidna.yaml",
            "--format",
            "json",
        ]

        self.log_step("echidna_started", {"command": command, "target_path": str(target_path)})
        try:
            proc = subprocess.run(command, check=False, capture_output=True, text=True)
        except FileNotFoundError as exc:
            self.log_step("echidna_skipped", {"reason": "not installed", "error": str(exc)})
            return []

        self.log_step(
            "echidna_completed",
            {
                "returncode": proc.returncode,
                "stdout_preview": (proc.stdout or "")[:500],
                "stderr_preview": (proc.stderr or "")[:500],
            },
        )

        output = (proc.stdout or "").strip()
        if not output:
            return []

        try:
            data = json.loads(output)
        except json.JSONDecodeError:
            return [{"raw_output": output, "returncode": proc.returncode}]

        if isinstance(data, list):
            return [item for item in data if isinstance(item, dict)]
        if isinstance(data, dict):
            findings = data.get("findings", data.get("tests", []))
            if isinstance(findings, list):
                return [item for item in findings if isinstance(item, dict)]
            return [data]
        return []

    def _normalize_vulnerability(
        self, value: Any, pass_name: str, index: int
    ) -> dict[str, Any]:
        if not isinstance(value, dict):
            value = {"description": str(value)}

        severity = str(value.get("severity", "medium")).strip().lower()
        if severity not in {"low", "medium", "high", "critical"}:
            severity = "medium"

        confidence = value.get("confidence", 0.0)
        try:
            confidence_value = float(confidence)
        except (TypeError, ValueError):
            confidence_value = 0.0
        confidence_value = max(0.0, min(1.0, confidence_value))

        matrix = value.get("quillai_severity_matrix", {})
        if not isinstance(matrix, dict):
            matrix = {}

        vuln_id = (
            str(value.get("id", "")).strip()
            or f"beta-{pass_name}-{index}-{uuid4().hex[:8]}"
        )

        return {
            "id": vuln_id,
            "title": str(value.get("title", "Untitled vulnerability")).strip(),
            "severity": severity,
            "confidence": confidence_value,
            "affected_function": str(value.get("affected_function", "unknown")).strip(),
            "description": str(value.get("description", "")).strip(),
            "exploit_code_solidity": str(value.get("exploit_code_solidity", "")).strip(),
            "pass_found_in": pass_name,
            "quillai_severity_matrix": matrix,
        }

    def _dedupe_vulnerabilities(
        self, vulnerabilities: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        deduped: list[dict[str, Any]] = []
        seen: set[str] = set()

        for item in vulnerabilities:
            key = "|".join(
                [
                    str(item.get("title", "")).lower(),
                    str(item.get("affected_function", "")).lower(),
                    str(item.get("description", "")).lower(),
                ]
            )
            if key in seen:
                continue
            seen.add(key)
            deduped.append(item)

        return deduped

    def _parse_json_output(self, llm_output: str) -> dict[str, Any]:
        text = llm_output.strip()
        if text.startswith("```"):
            lines = text.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            text = "\n".join(lines).strip()

        try:
            parsed = json.loads(text)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError as exc:
            self.log_step(
                "attack_beta_pass_parse_failed",
                {"error": str(exc), "raw_preview": llm_output[:800]},
            )
            return {}
