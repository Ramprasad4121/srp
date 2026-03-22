from __future__ import annotations

import json
import re
from collections import Counter
from typing import Any
from uuid import uuid4

from ..base_agent import BaseAgent


class DefenseAgent(BaseAgent):
    def __init__(self) -> None:
        super().__init__(
            name="DefenseAgent",
            role="Blue-team adjudicator across Alpha/Beta/Gamma findings with spec-compliance checks",
            skill_keys=["audit-firm-1-solidity-auditor", "tob-spec-compliance"],
        )

    async def run(self, context: dict) -> dict:
        handoff_context = self.get_handoff_context()
        system_extra = f"""
You are validating findings from 3 independent attack agents.

{handoff_context}

Apply the Devil's Advocate protocol to every finding.
Apply the QuillAI severity matrix.
Kill false positives aggressively.
"""
        self.log_step("defense_run_started", {"context_keys": list(context.keys())})

        merged_findings = self._collect_merged_findings(context)
        self.log_step(
            "defense_inputs_collected",
            {"incoming_findings": len(merged_findings)},
        )

        unique_findings = self._deduplicate_by_similarity(merged_findings)
        self.log_step(
            "defense_deduplicated",
            {"unique_findings": len(unique_findings)},
        )

        contract_code = str(context.get("contract_code", ""))
        documented_spec = self._resolve_documented_spec(context)

        confirmed_vulnerabilities: list[dict[str, Any]] = []
        false_positives: list[dict[str, Any]] = []
        unconfirmed: list[dict[str, Any]] = []
        quillai_severity_matrix: dict[str, Any] = {}
        devil_advocate_notes: list[dict[str, Any]] = []

        for finding in unique_findings:
            confirmation_count = len(finding.get("agents", []))
            confirmation_label = self._confirmation_label(confirmation_count)

            devil_result = await self._run_devil_advocate_protocol(
                finding=finding,
                contract_code=contract_code,
                documented_spec=documented_spec,
            )
            matrix = self._build_quillai_matrix(finding)
            final_severity = str(matrix["final_severity"])

            verdict = self._determine_verdict(
                confirmation_count=confirmation_count,
                exploitability=devil_result.get("exploitability", "uncertain"),
            )

            enriched = {
                "id": finding["id"],
                "title": finding["title"],
                "severity": finding["severity"],
                "final_severity": final_severity,
                "confidence": finding["confidence"],
                "affected_function": finding["affected_function"],
                "description": finding["description"],
                "exploit_code_solidity": finding["exploit_code_solidity"],
                "confirmation_count": confirmation_count,
                "confirmation_label": confirmation_label,
                "agents": finding.get("agents", []),
                "passes": finding.get("passes", []),
                "spec_compliance": devil_result.get("spec_compliance", "unknown"),
                "spec_notes": devil_result.get("spec_notes", ""),
                "devil_advocate": {
                    "mitigating_controls": devil_result.get("mitigating_controls", []),
                    "access_restrictions": devil_result.get("access_restrictions", []),
                    "value_constraints": devil_result.get("value_constraints", []),
                    "invariant_protections": devil_result.get("invariant_protections", []),
                    "not_exploitable_reasons": devil_result.get(
                        "not_exploitable_reasons", []
                    ),
                },
                "verdict": verdict,
            }

            quillai_severity_matrix[enriched["id"]] = matrix
            devil_advocate_notes.append(
                {
                    "finding_id": enriched["id"],
                    "title": enriched["title"],
                    "verdict": verdict,
                    "notes": devil_result.get("devil_advocate_notes", ""),
                }
            )

            if verdict == "confirmed":
                confirmed_vulnerabilities.append(enriched)
            elif verdict == "false_positive":
                false_positives.append(enriched)
            else:
                unconfirmed.append(enriched)

        security_score = self._compute_security_score(
            confirmed_vulnerabilities=confirmed_vulnerabilities,
            unconfirmed=unconfirmed,
        )

        result = {
            "confirmed_vulnerabilities": confirmed_vulnerabilities,
            "false_positives": false_positives,
            "unconfirmed": unconfirmed,
            "security_score": security_score,
            "quillai_severity_matrix": quillai_severity_matrix,
            "devil_advocate_notes": devil_advocate_notes,
        }
        self.log_step(
            "defense_run_completed",
            {
                "confirmed": len(confirmed_vulnerabilities),
                "false_positives": len(false_positives),
                "unconfirmed": len(unconfirmed),
                "security_score": security_score,
            },
        )
        return result

    def _collect_merged_findings(self, context: dict[str, Any]) -> list[dict[str, Any]]:
        findings: list[dict[str, Any]] = []

        def add_many(raw: Any, default_agent: str) -> None:
            if not isinstance(raw, list):
                return
            for item in raw:
                if not isinstance(item, dict):
                    item = {"description": str(item)}
                row = dict(item)
                row.setdefault("agent", default_agent)
                findings.append(row)

        add_many(context.get("combined_findings"), "combined")
        add_many(context.get("vulnerabilities"), "combined")
        add_many(context.get("all_attack_findings"), "combined")

        for key in ("attack_alpha", "attack_beta", "attack_gamma", "alpha", "beta", "gamma"):
            value = context.get(key)
            if not isinstance(value, dict):
                continue
            agent_name = str(value.get("agent", key.replace("attack_", "")))
            add_many(value.get("vulnerabilities", []), agent_name)

        attack_results = context.get("attack_results")
        if isinstance(attack_results, dict):
            for agent_key, payload in attack_results.items():
                if isinstance(payload, dict):
                    agent_name = str(payload.get("agent", agent_key))
                    add_many(payload.get("vulnerabilities", []), agent_name)

        normalized: list[dict[str, Any]] = []
        for item in findings:
            normalized.append(
                {
                    "id": str(item.get("id", "")).strip() or f"finding-{uuid4().hex[:8]}",
                    "title": str(item.get("title", "")).strip() or "Untitled finding",
                    "severity": self._normalize_severity(item.get("severity", "medium")),
                    "confidence": self._normalize_confidence(item.get("confidence", 0.0)),
                    "affected_function": str(item.get("affected_function", "unknown")).strip(),
                    "description": str(item.get("description", "")).strip(),
                    "exploit_code_solidity": str(
                        item.get("exploit_code_solidity", item.get("exploit_code", ""))
                    ).strip(),
                    "pass_found_in": str(item.get("pass_found_in", "")).strip(),
                    "agent": str(item.get("agent", "unknown")).strip().lower(),
                }
            )
        return normalized

    def _deduplicate_by_similarity(
        self, findings: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        clusters: list[dict[str, Any]] = []

        for finding in findings:
            tokens = self._token_signature(finding)
            best_index = -1
            best_score = 0.0
            for idx, cluster in enumerate(clusters):
                score = self._jaccard_similarity(tokens, cluster["tokens"])
                if score > best_score:
                    best_score = score
                    best_index = idx

            same_function = (
                best_index >= 0
                and finding["affected_function"] != "unknown"
                and clusters[best_index]["representative"]["affected_function"]
                == finding["affected_function"]
            )
            if best_index >= 0 and (best_score >= 0.55 or (same_function and best_score >= 0.35)):
                cluster = clusters[best_index]
                cluster["members"].append(finding)
                cluster["tokens"].update(tokens)
                cluster["agents"].add(finding["agent"])
                if finding["pass_found_in"]:
                    cluster["passes"].add(finding["pass_found_in"])
            else:
                clusters.append(
                    {
                        "representative": finding,
                        "members": [finding],
                        "tokens": set(tokens),
                        "agents": {finding["agent"]},
                        "passes": {finding["pass_found_in"]} if finding["pass_found_in"] else set(),
                    }
                )

        deduped: list[dict[str, Any]] = []
        for cluster in clusters:
            members = cluster["members"]
            representative = self._pick_representative(members)
            severities = [self._normalize_severity(item.get("severity", "medium")) for item in members]
            max_severity = max(severities, key=self._severity_rank)
            avg_conf = (
                sum(self._normalize_confidence(item.get("confidence", 0.0)) for item in members)
                / max(1, len(members))
            )
            deduped.append(
                {
                    "id": representative["id"],
                    "title": representative["title"],
                    "severity": max_severity,
                    "confidence": round(avg_conf, 4),
                    "affected_function": representative["affected_function"],
                    "description": representative["description"],
                    "exploit_code_solidity": representative["exploit_code_solidity"],
                    "agents": sorted(cluster["agents"]),
                    "passes": sorted([p for p in cluster["passes"] if p]),
                    "member_count": len(members),
                }
            )
        return deduped

    async def _run_devil_advocate_protocol(
        self, finding: dict[str, Any], contract_code: str, documented_spec: str
    ) -> dict[str, Any]:
        system_extra = (
            "Apply Devil's Advocate protocol: actively search for reasons this finding is NOT exploitable. "
            "Evaluate mitigating controls, access restrictions, value constraints, and invariant protections. "
            "Then run a spec-compliance check: does implementation match documented spec? "
            "Return ONLY valid JSON with keys: "
            "exploitability, mitigating_controls, access_restrictions, value_constraints, "
            "invariant_protections, not_exploitable_reasons, spec_compliance, spec_notes, devil_advocate_notes. "
            "exploitability must be one of: exploitable, not_exploitable, uncertain. "
            "spec_compliance must be one of: matches_spec, violates_spec, unknown."
        )
        payload = {
            "finding": finding,
            "documented_spec": documented_spec,
            "contract_code": contract_code,
        }
        messages = [{"role": "user", "content": json.dumps(payload, default=str)}]

        try:
            llm_output = await self.call_llm(system_extra=system_extra, messages=messages)
            parsed = self._parse_json_output(llm_output)
        except Exception as exc:
            self.log_step("defense_devil_advocate_llm_error", {"error": str(exc)})
            parsed = {}

        exploitability = str(parsed.get("exploitability", "uncertain")).strip().lower()
        if exploitability not in {"exploitable", "not_exploitable", "uncertain"}:
            exploitability = "uncertain"

        spec_compliance = str(parsed.get("spec_compliance", "unknown")).strip().lower()
        if spec_compliance not in {"matches_spec", "violates_spec", "unknown"}:
            spec_compliance = "unknown"

        return {
            "exploitability": exploitability,
            "mitigating_controls": self._to_str_list(parsed.get("mitigating_controls", [])),
            "access_restrictions": self._to_str_list(parsed.get("access_restrictions", [])),
            "value_constraints": self._to_str_list(parsed.get("value_constraints", [])),
            "invariant_protections": self._to_str_list(parsed.get("invariant_protections", [])),
            "not_exploitable_reasons": self._to_str_list(parsed.get("not_exploitable_reasons", [])),
            "spec_compliance": spec_compliance,
            "spec_notes": str(parsed.get("spec_notes", "")).strip(),
            "devil_advocate_notes": str(parsed.get("devil_advocate_notes", "")).strip(),
        }

    def _build_quillai_matrix(self, finding: dict[str, Any]) -> dict[str, Any]:
        passes = {str(p).strip().lower() for p in finding.get("passes", []) if str(p).strip()}
        semantic_guard_flag = "semantic_guard" in passes
        state_invariant_flag = "state_invariant" in passes
        cross_layer_critical = semantic_guard_flag and state_invariant_flag

        base_severity = self._normalize_severity(finding.get("severity", "medium"))
        final_severity = "critical" if cross_layer_critical else base_severity

        return {
            "layer_1_semantic_guard": semantic_guard_flag,
            "layer_2_state_invariant": state_invariant_flag,
            "cross_layer_critical": cross_layer_critical,
            "base_severity": base_severity,
            "final_severity": final_severity,
            "passes": sorted(list(passes)),
            "confirmation_count": len(finding.get("agents", [])),
        }

    def _determine_verdict(self, confirmation_count: int, exploitability: str) -> str:
        if exploitability == "not_exploitable":
            return "false_positive"
        if confirmation_count >= 3:
            return "confirmed"
        return "needs_more_info"

    def _compute_security_score(
        self,
        confirmed_vulnerabilities: list[dict[str, Any]],
        unconfirmed: list[dict[str, Any]],
    ) -> int:
        score = 100
        severity_penalty = {
            "critical": 25,
            "high": 15,
            "medium": 8,
            "low": 3,
        }

        for finding in confirmed_vulnerabilities:
            severity = self._normalize_severity(finding.get("final_severity", "medium"))
            score -= severity_penalty[severity]

        score -= 2 * len(unconfirmed)
        score = max(0, min(100, score))
        return int(score)

    @staticmethod
    def _resolve_documented_spec(context: dict[str, Any]) -> str:
        for key in ("spec", "documented_spec", "protocol_spec", "requirements", "README"):
            value = context.get(key)
            if value:
                return str(value)
        return ""

    @staticmethod
    def _confirmation_label(confirmation_count: int) -> str:
        if confirmation_count >= 3:
            return "confirmed"
        if confirmation_count == 2:
            return "probable"
        return "unconfirmed"

    @staticmethod
    def _normalize_severity(raw: Any) -> str:
        value = str(raw).strip().lower()
        return value if value in {"critical", "high", "medium", "low"} else "medium"

    @staticmethod
    def _severity_rank(severity: str) -> int:
        order = {"low": 1, "medium": 2, "high": 3, "critical": 4}
        return order.get(str(severity).lower(), 2)

    @staticmethod
    def _normalize_confidence(raw: Any) -> float:
        try:
            value = float(raw)
        except (TypeError, ValueError):
            value = 0.0
        return max(0.0, min(1.0, value))

    @staticmethod
    def _token_signature(finding: dict[str, Any]) -> set[str]:
        text = " ".join(
            [
                str(finding.get("title", "")),
                str(finding.get("affected_function", "")),
                str(finding.get("description", "")),
            ]
        ).lower()
        tokens = re.findall(r"[a-z0-9_]{3,}", text)
        return set(tokens)

    @staticmethod
    def _jaccard_similarity(a: set[str], b: set[str]) -> float:
        if not a or not b:
            return 0.0
        overlap = len(a.intersection(b))
        union = len(a.union(b))
        if union == 0:
            return 0.0
        return overlap / union

    @staticmethod
    def _pick_representative(members: list[dict[str, Any]]) -> dict[str, Any]:
        if not members:
            return {
                "id": f"finding-{uuid4().hex[:8]}",
                "title": "Untitled finding",
                "severity": "medium",
                "confidence": 0.0,
                "affected_function": "unknown",
                "description": "",
                "exploit_code_solidity": "",
            }

        title_counter = Counter(str(item.get("title", "")).strip() for item in members)
        most_common_title = title_counter.most_common(1)[0][0] if title_counter else ""
        if most_common_title:
            same_title = [item for item in members if str(item.get("title", "")).strip() == most_common_title]
            return max(same_title, key=lambda item: len(str(item.get("description", ""))))
        return max(members, key=lambda item: len(str(item.get("description", ""))))

    @staticmethod
    def _to_str_list(raw: Any) -> list[str]:
        if isinstance(raw, list):
            return [str(item).strip() for item in raw if str(item).strip()]
        if raw is None:
            return []
        value = str(raw).strip()
        return [value] if value else []

    def _parse_json_output(self, llm_output: str) -> dict[str, Any]:
        from srp.core.utils import parse_llm_json
        parsed = parse_llm_json(llm_output)
        if not parsed:
            self.log_step(
                "defense_parse_failed",
                {"error": "parse error", "raw_preview": llm_output[:1000]},
            )
        return parsed
