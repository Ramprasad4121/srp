from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from ..base_agent import BaseAgent


class ForkAgent(BaseAgent):
    KNOWN_FORKS = [
        "Uniswap V2",
        "Uniswap V3",
        "Compound V2",
        "Aave V2",
        "Aave V3",
        "Curve",
        "Balancer",
        "MakerDAO",
        "Yearn",
        "GMX",
        "Synthetix",
    ]

    def __init__(self) -> None:
        super().__init__(
            name="ForkAgent",
            role="Identifies fork lineage and inherited risk from base protocol vulnerabilities",
            skill_keys=["ethskills-concepts", "tob-audit-context"],
        )
        self.threat_db_path = Path("./data/threat_intel.json")

    async def run(self, context: dict) -> dict:
        self.log_step("fork_run_started", {"context_keys": list(context.keys())})

        contract_code = self._resolve_contract_code(context)
        if not contract_code:
            raise ValueError("ForkAgent requires contract source via context['contract_code'] or contract_paths")

        fork_profile = await self._detect_fork_profile(contract_code, context)
        base_protocol = str(fork_profile.get("base_protocol") or "").strip()
        similarity_pct = self._to_similarity(fork_profile.get("similarity_pct", 0))
        modifications = self._to_str_list(fork_profile.get("modifications", []))
        is_fork = bool(fork_profile.get("is_fork", False)) and bool(base_protocol)

        inherited_vulns: list[dict[str, Any]] = []
        fixed_by_fork: list[dict[str, Any]] = []
        worsened_by_fork: list[dict[str, Any]] = []

        if is_fork:
            threat_db = self._load_threat_db(context.get("threat_intel_db_path"))
            relevant = self._filter_base_protocol_vulns(base_protocol, threat_db)
            self.log_step(
                "fork_vuln_candidates_loaded",
                {
                    "base_protocol": base_protocol,
                    "threat_db_total": len(threat_db),
                    "relevant_vulns": len(relevant),
                },
            )

            if relevant:
                classified = await self._classify_vulnerability_inheritance(
                    contract_code=contract_code,
                    base_protocol=base_protocol,
                    vulnerabilities=relevant,
                    modifications=modifications,
                )
                inherited_vulns = classified["inherited_vulns"]
                fixed_by_fork = classified["fixed_by_fork"]
                worsened_by_fork = classified["worsened_by_fork"]

        result = {
            "is_fork": is_fork,
            "base_protocol": base_protocol if is_fork else "",
            "similarity_pct": similarity_pct if is_fork else 0,
            "modifications": modifications if is_fork else [],
            "inherited_vulns": inherited_vulns,
            "fixed_by_fork": fixed_by_fork,
            "worsened_by_fork": worsened_by_fork,
        }
        self.log_step(
            "fork_run_completed",
            {
                "is_fork": result["is_fork"],
                "base_protocol": result["base_protocol"],
                "similarity_pct": result["similarity_pct"],
                "inherited_vulns": len(result["inherited_vulns"]),
                "fixed_by_fork": len(result["fixed_by_fork"]),
                "worsened_by_fork": len(result["worsened_by_fork"]),
            },
        )
        return result

    async def _detect_fork_profile(self, contract_code: str, context: dict) -> dict[str, Any]:
        system_extra = (
            "Is this a fork of a known protocol? "
            "Known forks: Uniswap V2/V3, Compound V2, Aave V2/V3, Curve, Balancer, MakerDAO, "
            "Yearn, GMX, Synthetix. What % similarity? What was modified?\n\n"
            "Return ONLY valid JSON with keys: "
            "is_fork (bool), base_protocol (str), similarity_pct (number 0-100), modifications (array of strings)."
        )
        payload = {
            "contract_name": str(context.get("contract_name", "")).strip(),
            "description": str(context.get("raw_input", "")).strip(),
            "known_forks": self.KNOWN_FORKS,
            "contract_code": contract_code[:24000],
        }

        try:
            llm_output = await self.call_llm(
                system_extra=system_extra,
                messages=[{"role": "user", "content": json.dumps(payload, default=str)}],
            )
            parsed = self._parse_json_output(llm_output)
        except Exception as exc:  # pragma: no cover - env/network dependent
            self.log_step("fork_detect_llm_failed", {"error": str(exc)})
            parsed = {}

        is_fork = bool(parsed.get("is_fork", False))
        base_protocol = str(parsed.get("base_protocol", "")).strip()
        similarity_pct = self._to_similarity(parsed.get("similarity_pct", 0))
        modifications = self._to_str_list(parsed.get("modifications", []))

        if not base_protocol and is_fork:
            base_protocol = self._infer_base_from_code(contract_code)
        if not base_protocol:
            is_fork = False

        self.log_step(
            "fork_profile_detected",
            {
                "is_fork": is_fork,
                "base_protocol": base_protocol,
                "similarity_pct": similarity_pct,
                "modifications_count": len(modifications),
            },
        )
        return {
            "is_fork": is_fork,
            "base_protocol": base_protocol,
            "similarity_pct": similarity_pct,
            "modifications": modifications,
        }

    async def _classify_vulnerability_inheritance(
        self,
        contract_code: str,
        base_protocol: str,
        vulnerabilities: list[dict[str, Any]],
        modifications: list[str],
    ) -> dict[str, list[dict[str, Any]]]:
        payload = {
            "base_protocol": base_protocol,
            "fork_modifications": modifications,
            "contract_code": contract_code[:26000],
            "known_vulnerabilities": [
                {
                    "threat_key": self._threat_key(v),
                    "protocol": v.get("protocol"),
                    "attack_vector": v.get("attack_vector"),
                    "vulnerable_pattern": v.get("vulnerable_pattern"),
                    "affected_function_signature": v.get("affected_function_signature"),
                    "exploit_code_snippet": v.get("exploit_code_snippet"),
                }
                for v in vulnerabilities[:200]
            ],
        }
        system_extra = (
            "For each known vulnerability, classify status in this fork: "
            "inherited, fixed_by_fork, worsened_by_fork, or not_applicable. "
            "Consider modifications and implementation details.\n\n"
            "Return ONLY valid JSON with shape: "
            "{\"assessments\": [{\"threat_key\": str, \"status\": str, \"reason\": str}]}."
        )

        try:
            llm_output = await self.call_llm(
                system_extra=system_extra,
                messages=[{"role": "user", "content": json.dumps(payload, default=str)}],
            )
            parsed = self._parse_json_output(llm_output)
        except Exception as exc:  # pragma: no cover - env/network dependent
            self.log_step("fork_classify_llm_failed", {"error": str(exc)})
            parsed = {}

        assessments = parsed.get("assessments", [])
        if not isinstance(assessments, list):
            assessments = []
        by_key = {self._threat_key(v): v for v in vulnerabilities}

        inherited: list[dict[str, Any]] = []
        fixed: list[dict[str, Any]] = []
        worsened: list[dict[str, Any]] = []

        for item in assessments:
            if not isinstance(item, dict):
                continue
            key = str(item.get("threat_key", "")).strip()
            if not key or key not in by_key:
                continue
            status = str(item.get("status", "")).strip().lower()
            reason = str(item.get("reason", "")).strip()
            enriched = {
                "threat_key": key,
                "reason": reason,
                "threat": by_key[key],
            }
            if status == "inherited":
                inherited.append(enriched)
            elif status == "fixed_by_fork":
                fixed.append(enriched)
            elif status == "worsened_by_fork":
                worsened.append(enriched)

        if not assessments and vulnerabilities:
            inherited = self._fallback_inherited(vulnerabilities, contract_code)

        return {
            "inherited_vulns": inherited,
            "fixed_by_fork": fixed,
            "worsened_by_fork": worsened,
        }

    def _resolve_contract_code(self, context: dict) -> str:
        code = str(context.get("contract_code", "")).strip()
        if code:
            return code

        contract_paths = context.get("contract_paths", [])
        if not isinstance(contract_paths, list):
            return ""

        chunks: list[str] = []
        for raw_path in contract_paths:
            path = Path(str(raw_path).strip())
            if not path.exists() or path.suffix.lower() != ".sol":
                continue
            try:
                chunks.append(path.read_text(encoding="utf-8"))
            except OSError:
                continue

        return "\n\n".join(chunks).strip()

    def _load_threat_db(self, override_path: Any) -> list[dict[str, Any]]:
        path = self.threat_db_path
        if isinstance(override_path, str) and override_path.strip():
            path = Path(override_path.strip())
        if not path.is_absolute():
            path = Path.cwd() / path
        if not path.exists():
            self.log_step("fork_threat_db_missing", {"path": str(path)})
            return []

        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            self.log_step("fork_threat_db_load_failed", {"path": str(path), "error": str(exc)})
            return []
        if not isinstance(payload, list):
            return []
        return [item for item in payload if isinstance(item, dict)]

    def _filter_base_protocol_vulns(
        self,
        base_protocol: str,
        threats: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        aliases = self._protocol_aliases(base_protocol)
        matched: list[dict[str, Any]] = []
        for threat in threats:
            protocol = str(threat.get("protocol", "")).strip().lower()
            if not protocol:
                continue
            if any(alias in protocol for alias in aliases):
                matched.append(threat)
        return matched

    def _fallback_inherited(
        self,
        vulnerabilities: list[dict[str, Any]],
        contract_code: str,
    ) -> list[dict[str, Any]]:
        code = contract_code.lower()
        inherited: list[dict[str, Any]] = []
        for vuln in vulnerabilities:
            signature = str(vuln.get("affected_function_signature", "")).strip().lower()
            pattern = str(vuln.get("vulnerable_pattern", "")).strip().lower()
            if (signature and signature in code) or (pattern and pattern in code):
                inherited.append(
                    {
                        "threat_key": self._threat_key(vuln),
                        "reason": "Fallback match found vulnerable signature/pattern in fork source.",
                        "threat": vuln,
                    }
                )
        return inherited

    @staticmethod
    def _infer_base_from_code(contract_code: str) -> str:
        code = contract_code.lower()
        markers = {
            "Uniswap V2": ["uniswapv2", "k_last", "swapexacttokensfortokens"],
            "Uniswap V3": ["uniswapv3", "ticks", "sqrtpricex96"],
            "Compound V2": ["comptroller", "ctoken", "accrueinterest"],
            "Aave V2": ["lendingpool", "aave", "flashloan"],
            "Aave V3": ["pooladdressesprovider", "aave", "emode"],
            "Curve": ["curve", "amplification", "virtual_price"],
            "Balancer": ["balancer", "weightedpool", "vault"],
            "MakerDAO": ["maker", "vat", "jug", "dai"],
            "Yearn": ["yearn", "vault", "strategist"],
            "GMX": ["gmx", "positionrouter", "glp"],
            "Synthetix": ["synthetix", "synth", "exchanger"],
        }
        for protocol, tokens in markers.items():
            if any(token in code for token in tokens):
                return protocol
        return ""

    @staticmethod
    def _parse_json_output(raw: str) -> dict[str, Any]:
        from srp.core.utils import parse_llm_json
        return parse_llm_json(raw)

    @staticmethod
    def _protocol_aliases(base_protocol: str) -> set[str]:
        text = base_protocol.lower()
        aliases = {text}
        normalized = re.sub(r"[^a-z0-9]+", " ", text).strip()
        if normalized:
            aliases.add(normalized)
        aliases.update(token for token in normalized.split() if token)
        if "uniswap" in normalized and "v2" in normalized:
            aliases.update({"uniswap v2", "uniswapv2"})
        if "uniswap" in normalized and "v3" in normalized:
            aliases.update({"uniswap v3", "uniswapv3"})
        if "compound" in normalized and "v2" in normalized:
            aliases.update({"compound v2", "compoundv2"})
        if "aave" in normalized and "v2" in normalized:
            aliases.update({"aave v2", "aavev2"})
        if "aave" in normalized and "v3" in normalized:
            aliases.update({"aave v3", "aavev3"})
        return aliases

    @staticmethod
    def _to_similarity(value: Any) -> int:
        try:
            score = int(round(float(value)))
        except (TypeError, ValueError):
            score = 0
        return max(0, min(100, score))

    @staticmethod
    def _to_str_list(value: Any) -> list[str]:
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        if value in (None, ""):
            return []
        return [str(value).strip()]

    @staticmethod
    def _threat_key(threat: dict[str, Any]) -> str:
        parts = [
            str(threat.get("protocol", "")).strip().lower(),
            str(threat.get("date", "")).strip().lower(),
            str(threat.get("amount_usd", "")).strip().lower(),
            str(threat.get("attack_vector", "")).strip().lower(),
            str(threat.get("vulnerable_pattern", "")).strip().lower(),
            str(threat.get("affected_function_signature", "")).strip().lower(),
        ]
        return "|".join(parts)
