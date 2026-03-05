from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any
from uuid import uuid4

from core.solodit_client import SoloditClient

from ..base_agent import BaseAgent


class AttackAgentGamma(BaseAgent):
    def __init__(self) -> None:
        super().__init__(
            name="AttackAgentGamma",
            role="Attack lane gamma focused on signatures, DoS/griefing, external-call edges, and broad vuln sweeps",
            skill_keys=[
                "quillai-signature-replay",
                "quillai-dos-griefing",
                "quillai-external-call",
                "quillai-input-arithmetic",
                "scv-scan",
                "scv-scan-cheatsheet",
            ],
        )
        self.angle = "supply_chain_signatures_dos_36vuln_sweep"
        self._scv_reference_dir = (
            Path(__file__).resolve().parents[2] / "skills" / "scv-scan" / "references"
        )
        self._cheatsheet_file = self._scv_reference_dir / "CHEATSHEET.md"

    async def run(self, context: dict) -> dict:
        scoped_context = self._scope_context(context)
        self.log_step(
            "attack_gamma_run_started",
            {
                "angle": self.angle,
                "scope_keys": list(scoped_context.keys()),
                "entry_points": len(scoped_context["entry_points"]),
                "invariants": len(scoped_context["invariants"]),
            },
        )

        scv_vulns = await self._run_scv_sweep_pass(scoped_context)

        sig_ext_prompt = (
            "Find all 5 signature replay types: same-chain, cross-chain, cross-contract, nonce-skip, expired. "
            "Verify EIP-712 domain separators, ecrecover safety. Then audit all external calls: unchecked return "
            "values, fee-on-transfer tokens, rebasing tokens, missing ERC20 return values (USDT pattern), push vs "
            "pull payment risks."
        )
        sig_ext_vulns = await self._run_generic_pass(
            pass_name="signatures_external_calls",
            pass_prompt=sig_ext_prompt,
            scoped_context=scoped_context,
        )

        dos_input_prompt = (
            "Find: unbounded loops, gas limit exhaustion, external call failure DoS, 63/64 gas griefing, storage "
            "bloat. Then audit all input validation: precision loss, rounding exploitation, ERC4626 inflation attacks, "
            "unsafe casting, unchecked blocks."
        )
        dos_input_vulns = await self._run_generic_pass(
            pass_name="dos_input_safety",
            pass_prompt=dos_input_prompt,
            scoped_context=scoped_context,
        )

        all_vulnerabilities = [*scv_vulns, *sig_ext_vulns, *dos_input_vulns]
        normalized_vulns = self._dedupe_vulnerabilities(all_vulnerabilities)

        result = {
            "agent": "gamma",
            "angle": self.angle,
            "passes": ["scv_scan", "signatures_external_calls", "dos_input_safety"],
            "vulnerabilities": normalized_vulns,
        }
        self.log_step(
            "attack_gamma_run_completed",
            {"total_vulnerabilities": len(normalized_vulns)},
        )
        solodit = SoloditClient()
        if solodit.available and normalized_vulns:
            for vuln in normalized_vulns:
                real_findings = await solodit.search_findings(
                    keywords=vuln.get("title", ""),
                    tags=["Signature Replay", "DoS", "Integer Overflow", "Input Validation"],
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
            raise ValueError(f"AttackAgentGamma missing required context keys: {missing}")

        unexpected = [key for key in sorted(context.keys()) if key not in required_keys]
        if unexpected:
            self.log_step("attack_gamma_context_isolated", {"ignored_keys": unexpected})

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

    async def _run_scv_sweep_pass(self, scoped_context: dict[str, Any]) -> list[dict[str, Any]]:
        self.log_step("attack_gamma_scv_pass_started", {})

        cheat_entries = self._parse_scv_cheatsheet()
        syntactic_candidates = self._run_scv_syntactic_subpass(
            contract_code=scoped_context["contract_code"],
            cheat_entries=cheat_entries,
        )
        semantic_candidates = await self._run_scv_semantic_subpass(
            scoped_context=scoped_context,
            cheat_entries=cheat_entries,
        )
        merged_candidates = self._merge_scv_candidates(
            syntactic_candidates=syntactic_candidates,
            semantic_candidates=semantic_candidates,
        )

        vulnerabilities: list[dict[str, Any]] = []
        for index, candidate in enumerate(merged_candidates, start=1):
            evaluated = await self._evaluate_scv_candidate(
                scoped_context=scoped_context,
                candidate=candidate,
                index=index,
            )
            if evaluated is None:
                continue
            vulnerabilities.append(evaluated)

        self.log_step(
            "attack_gamma_scv_pass_completed",
            {
                "syntactic_candidates": len(syntactic_candidates),
                "semantic_candidates": len(semantic_candidates),
                "merged_candidates": len(merged_candidates),
                "vulnerabilities": len(vulnerabilities),
            },
        )
        return vulnerabilities

    def _parse_scv_cheatsheet(self) -> list[dict[str, Any]]:
        if not self._cheatsheet_file.exists():
            self.log_step(
                "attack_gamma_scv_cheatsheet_missing",
                {"path": str(self._cheatsheet_file)},
            )
            return []

        text = self._cheatsheet_file.read_text(encoding="utf-8")
        lines = text.splitlines()
        entries: list[dict[str, Any]] = []
        current: dict[str, Any] | None = None
        collecting_keywords = False

        for raw_line in lines:
            line = raw_line.strip()

            if line.startswith("## "):
                if current:
                    current.setdefault("keywords", [])
                    entries.append(current)
                current = {
                    "title": line[3:].strip(),
                    "reference_file": "",
                    "keywords": [],
                }
                collecting_keywords = False
                continue

            if current is None:
                continue

            if line.startswith("**Reference:**"):
                match = re.search(r"`([^`]+)`", line)
                if match:
                    current["reference_file"] = match.group(1).strip()
                continue

            if line.startswith("### Grep-able keywords"):
                collecting_keywords = True
                continue

            if collecting_keywords and line.startswith("---"):
                collecting_keywords = False
                continue

            if collecting_keywords:
                tokens = re.findall(r"`([^`]+)`", line)
                for token in tokens:
                    cleaned = token.strip()
                    if cleaned and cleaned not in current["keywords"]:
                        current["keywords"].append(cleaned)

        if current:
            current.setdefault("keywords", [])
            entries.append(current)

        valid_entries = [e for e in entries if e.get("reference_file")]
        self.log_step(
            "attack_gamma_scv_cheatsheet_parsed",
            {"entry_count": len(valid_entries)},
        )
        return valid_entries

    def _run_scv_syntactic_subpass(
        self, contract_code: str, cheat_entries: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        lower_code = contract_code.lower()
        candidates: list[dict[str, Any]] = []

        for entry in cheat_entries:
            hits: list[str] = []
            for keyword in entry.get("keywords", []):
                kw = str(keyword).strip()
                if not kw:
                    continue
                if kw.lower() in lower_code:
                    hits.append(kw)

            if not hits:
                continue

            candidates.append(
                {
                    "candidate_type": "syntactic",
                    "title": entry.get("title", ""),
                    "reference_file": entry.get("reference_file", ""),
                    "trigger_keywords": hits[:12],
                    "reason": f"Matched {len(hits)} keyword trigger(s)",
                    "confidence": 0.45,
                    "affected_function": "unknown",
                }
            )

        self.log_step(
            "attack_gamma_scv_syntactic_completed",
            {"candidate_count": len(candidates)},
        )
        return candidates

    async def _run_scv_semantic_subpass(
        self, scoped_context: dict[str, Any], cheat_entries: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        reference_files = [entry.get("reference_file", "") for entry in cheat_entries]
        system_extra = (
            "SCV Scan semantic sub-pass. Read through logic for issues with no grep signature. "
            "Prioritize cross-function reentrancy and missing access control. "
            "Return ONLY valid JSON: "
            "{\"candidates\": [{\"title\": str, \"reference_file\": str, \"affected_function\": str, "
            "\"reason\": str, \"confidence\": number}]}. "
            "reference_file must be one of the provided reference files."
        )
        payload = {
            "contract_code": scoped_context["contract_code"],
            "entry_points": scoped_context["entry_points"],
            "invariants": scoped_context["invariants"],
            "allowed_reference_files": reference_files,
        }
        messages = [{"role": "user", "content": json.dumps(payload, default=str)}]
        self.log_step(
            "attack_gamma_scv_semantic_started",
            {"reference_files": len(reference_files)},
        )

        llm_output = await self.call_llm(system_extra=system_extra, messages=messages)
        parsed = self._parse_json_output(llm_output)
        candidates = parsed.get("candidates", [])
        if not isinstance(candidates, list):
            candidates = []

        normalized: list[dict[str, Any]] = []
        allowed = {rf for rf in reference_files if rf}
        for item in candidates:
            if not isinstance(item, dict):
                continue
            reference_file = str(item.get("reference_file", "")).strip()
            if reference_file not in allowed:
                continue
            confidence = self._normalize_confidence(item.get("confidence", 0.5))
            normalized.append(
                {
                    "candidate_type": "semantic",
                    "title": str(item.get("title", reference_file.replace(".md", ""))).strip(),
                    "reference_file": reference_file,
                    "trigger_keywords": [],
                    "reason": str(item.get("reason", "")).strip(),
                    "confidence": confidence,
                    "affected_function": str(item.get("affected_function", "unknown")).strip(),
                }
            )

        self.log_step(
            "attack_gamma_scv_semantic_completed",
            {"candidate_count": len(normalized)},
        )
        return normalized

    def _merge_scv_candidates(
        self,
        syntactic_candidates: list[dict[str, Any]],
        semantic_candidates: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        merged: dict[str, dict[str, Any]] = {}

        for candidate in [*syntactic_candidates, *semantic_candidates]:
            reference_file = str(candidate.get("reference_file", "")).strip()
            if not reference_file:
                continue

            existing = merged.get(reference_file)
            if existing is None:
                merged[reference_file] = dict(candidate)
                continue

            combined_keywords = {
                *existing.get("trigger_keywords", []),
                *candidate.get("trigger_keywords", []),
            }
            existing["trigger_keywords"] = sorted([kw for kw in combined_keywords if kw])
            existing["confidence"] = max(
                self._normalize_confidence(existing.get("confidence", 0.0)),
                self._normalize_confidence(candidate.get("confidence", 0.0)),
            )
            reasons = [str(existing.get("reason", "")).strip(), str(candidate.get("reason", "")).strip()]
            existing["reason"] = " | ".join([reason for reason in reasons if reason])
            if existing.get("affected_function", "unknown") == "unknown":
                existing["affected_function"] = candidate.get("affected_function", "unknown")

        return list(merged.values())

    async def _evaluate_scv_candidate(
        self, scoped_context: dict[str, Any], candidate: dict[str, Any], index: int
    ) -> dict[str, Any] | None:
        reference_file = str(candidate.get("reference_file", "")).strip()
        reference_path = self._scv_reference_dir / reference_file
        if not reference_path.exists():
            self.log_step(
                "attack_gamma_scv_reference_missing",
                {"reference_file": reference_file},
            )
            return None

        reference_text = reference_path.read_text(encoding="utf-8")
        system_extra = (
            "SCV Scan candidate evaluation. Use the provided reference's Detection Heuristics and False Positives "
            "sections to determine whether this candidate is a real issue in the contract. "
            "Return ONLY valid JSON with shape: "
            "{\"is_real_issue\": bool, "
            "\"title\": str, "
            "\"severity\": \"low|medium|high|critical\", "
            "\"confidence\": number, "
            "\"affected_function\": str, "
            "\"description\": str, "
            "\"exploit_code_solidity\": str, "
            "\"quillai_severity_matrix\": object}."
        )
        payload = {
            "candidate": candidate,
            "reference_file": reference_file,
            "reference_text": reference_text,
            "contract_code": scoped_context["contract_code"],
            "entry_points": scoped_context["entry_points"],
        }
        messages = [{"role": "user", "content": json.dumps(payload, default=str)}]
        llm_output = await self.call_llm(system_extra=system_extra, messages=messages)
        parsed = self._parse_json_output(llm_output)

        if not parsed.get("is_real_issue", False):
            return None

        vulnerability = self._normalize_vulnerability(
            value=parsed,
            pass_name="scv_scan",
            index=index,
        )
        if not vulnerability["title"]:
            vulnerability["title"] = str(candidate.get("title", reference_file.replace(".md", "")))
        if vulnerability["affected_function"] == "unknown":
            vulnerability["affected_function"] = str(candidate.get("affected_function", "unknown"))
        return vulnerability

    async def _run_generic_pass(
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
            "attack_gamma_pass_started",
            {
                "pass": pass_name,
                "message_count": len(messages),
                "prompt_preview": pass_prompt[:300],
            },
        )

        llm_output = await self.call_llm(system_extra=system_extra, messages=messages)
        parsed = self._parse_json_output(llm_output)
        raw_vulns = parsed.get("vulnerabilities", [])
        if not isinstance(raw_vulns, list):
            raw_vulns = []

        normalized = [
            self._normalize_vulnerability(item, pass_name, idx)
            for idx, item in enumerate(raw_vulns, start=1)
        ]
        self.log_step(
            "attack_gamma_pass_completed",
            {"pass": pass_name, "vulnerability_count": len(normalized)},
        )
        return normalized

    def _normalize_vulnerability(
        self, value: Any, pass_name: str, index: int
    ) -> dict[str, Any]:
        if not isinstance(value, dict):
            value = {"description": str(value)}

        severity = str(value.get("severity", "medium")).strip().lower()
        if severity not in {"low", "medium", "high", "critical"}:
            severity = "medium"

        confidence = self._normalize_confidence(value.get("confidence", 0.0))

        matrix = value.get("quillai_severity_matrix", {})
        if not isinstance(matrix, dict):
            matrix = {}

        vuln_id = (
            str(value.get("id", "")).strip()
            or f"gamma-{pass_name}-{index}-{uuid4().hex[:8]}"
        )

        return {
            "id": vuln_id,
            "title": str(value.get("title", "Untitled vulnerability")).strip(),
            "severity": severity,
            "confidence": confidence,
            "affected_function": str(value.get("affected_function", "unknown")).strip(),
            "description": str(value.get("description", "")).strip(),
            "exploit_code_solidity": str(value.get("exploit_code_solidity", "")).strip(),
            "pass_found_in": pass_name,
            "quillai_severity_matrix": matrix,
        }

    @staticmethod
    def _normalize_confidence(raw_confidence: Any) -> float:
        try:
            value = float(raw_confidence)
        except (TypeError, ValueError):
            value = 0.0
        return max(0.0, min(1.0, value))

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
                "attack_gamma_parse_failed",
                {"error": str(exc), "raw_preview": llm_output[:900]},
            )
            return {}
