from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import aiohttp

from core.solodit_client import SoloditClient

from ..base_agent import BaseAgent


class ThreatIntelAgent(BaseAgent):
    OPENCLAW_HEARTBEAT_SECONDS = 6 * 60 * 60

    def __init__(self) -> None:
        super().__init__(
            name="ThreatIntelAgent",
            role="Tracks latest DeFi exploit intelligence and maps known exploit patterns to contracts",
            skill_keys=["ethskills-concepts"],
        )
        self.threat_db_path = "./data/threat_intel.json"

    async def scrape_latest_threats(self) -> list:
        self.log_step("threat_scrape_started", {})

        sources = [
            {"name": "rekt.news", "url": "https://rekt.news"},
            {"name": "defillama_hacks", "url": "https://defillama.com/hacks"},
            {
                "name": "defihacklabs",
                "url": "https://github.com/SunWeb3Sec/DeFiHackLabs",
            },
        ]

        existing = self._load_threat_db()
        existing_keys = {self._threat_key(item) for item in existing}
        all_threats: list[dict[str, Any]] = []

        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=35)) as session:
            for source in sources:
                source_name = source["name"]
                source_url = source["url"]
                try:
                    text = await self._fetch_text(session, source_url)
                    plain_text = self._to_plain_text(text)
                    source_threats = await self._extract_threats_from_source(
                        source_name=source_name,
                        source_url=source_url,
                        source_text=plain_text,
                    )
                    all_threats.extend(source_threats)
                    self.log_step(
                        "threat_scrape_source_completed",
                        {
                            "source": source_name,
                            "url": source_url,
                            "threats_extracted": len(source_threats),
                        },
                    )
                except Exception as exc:  # pragma: no cover - network dependent
                    self.log_step(
                        "threat_scrape_source_failed",
                        {"source": source_name, "url": source_url, "error": str(exc)},
                    )

        solodit = SoloditClient()
        if solodit.available:
            latest = await solodit.get_latest_threats(days=30)
            for finding in latest:
                threat = {
                    "protocol": finding.get("protocol", "unknown"),
                    "date": finding.get("reported_at", ""),
                    "amount_usd": 0,
                    "attack_vector": finding.get("title", ""),
                    "vulnerable_pattern": finding.get("content", "")[:500],
                    "affected_function_signature": "",
                    "source": "solodit",
                    "severity": finding.get("severity", ""),
                    "firm": finding.get("firm", ""),
                    "solodit_id": finding.get("id", "")
                }
                all_threats.append(threat)
            self.log_step("solodit_threat_feed", {
                "new_findings": len(latest),
                "source": "claudit-solodit-mcp"
            })

        deduped_new: list[dict[str, Any]] = []
        seen_new: set[str] = set()
        for threat in all_threats:
            key = self._threat_key(threat)
            if key in existing_keys or key in seen_new:
                continue
            seen_new.add(key)
            deduped_new.append(threat)

        if deduped_new:
            merged = [*existing, *deduped_new]
            self._save_threat_db(merged)

        self.log_step(
            "threat_scrape_completed",
            {"new_threats": len(deduped_new), "db_total": len(existing) + len(deduped_new)},
        )
        return deduped_new

    async def match_threats(self, contract_code: str) -> list:
        self.log_step(
            "threat_match_started",
            {"contract_code_chars": len(contract_code)},
        )

        threat_db = self._load_threat_db()
        if not threat_db:
            self.log_step("threat_match_empty_db", {})
            return []

        indexed = []
        for threat in threat_db[:300]:
            indexed.append(
                {
                    "threat_key": self._threat_key(threat),
                    "protocol": threat.get("protocol"),
                    "date": threat.get("date"),
                    "amount_usd": threat.get("amount_usd"),
                    "attack_vector": threat.get("attack_vector"),
                    "vulnerable_pattern": threat.get("vulnerable_pattern"),
                    "affected_function_signature": threat.get("affected_function_signature"),
                }
            )

        system_extra = (
            "Does this contract share vulnerable patterns with any of these known exploits? "
            "Be specific about function names and code patterns. "
            "Return ONLY valid JSON with shape: "
            "{\"matches\": [{\"threat_key\": str, \"similarity_score\": number, \"reason\": str, "
            "\"matched_function_names\": [str], \"matched_code_patterns\": [str]}]}. "
            "similarity_score must be 0.0-1.0."
        )
        payload = {
            "contract_code": contract_code,
            "known_threats": indexed,
        }

        try:
            llm_output = await self.call_llm(
                system_extra=system_extra,
                messages=[{"role": "user", "content": json.dumps(payload, default=str)}],
            )
            parsed = self._parse_json_output(llm_output)
        except Exception as exc:  # pragma: no cover - env/network dependent
            self.log_step("threat_match_llm_failed", {"error": str(exc)})
            return []

        matches = parsed.get("matches", [])
        if not isinstance(matches, list):
            matches = []

        by_key = {self._threat_key(item): item for item in threat_db}
        normalized: list[dict[str, Any]] = []
        for item in matches:
            if not isinstance(item, dict):
                continue
            threat_key = str(item.get("threat_key", "")).strip()
            if not threat_key or threat_key not in by_key:
                continue

            score = self._normalize_score(item.get("similarity_score", 0.0))
            normalized.append(
                {
                    "threat_key": threat_key,
                    "similarity_score": score,
                    "reason": str(item.get("reason", "")).strip(),
                    "matched_function_names": self._to_str_list(
                        item.get("matched_function_names", [])
                    ),
                    "matched_code_patterns": self._to_str_list(
                        item.get("matched_code_patterns", [])
                    ),
                    "threat": by_key[threat_key],
                }
            )

        normalized.sort(key=lambda row: row["similarity_score"], reverse=True)
        self.log_step("threat_match_completed", {"matches": len(normalized)})
        return normalized

    async def run_heartbeat(self) -> dict:
        new_threats = await self.scrape_latest_threats()
        return {
            "heartbeat_interval_seconds": self.OPENCLAW_HEARTBEAT_SECONDS,
            "new_threats": new_threats,
            "new_threat_count": len(new_threats),
        }

    async def run(self, context: dict) -> dict:
        contract_code = str(context.get("contract_code", "")).strip()
        if contract_code:
            matches = await self.match_threats(contract_code)
            return {"matches": matches}
        heartbeat = await self.run_heartbeat()
        return heartbeat

    def get_openclaw_config(self) -> dict[str, Any]:
        return {
            "handler": "run_heartbeat",
            "interval_seconds": self.OPENCLAW_HEARTBEAT_SECONDS,
        }

    async def _extract_threats_from_source(
        self, source_name: str, source_url: str, source_text: str
    ) -> list[dict[str, Any]]:
        snippet = source_text[:80000]
        system_extra = (
            "Extract DeFi exploit intelligence records from this source text. "
            "Return ONLY valid JSON with shape: "
            "{\"threats\": ["
            "{\"protocol\": str, \"date\": str, \"amount_usd\": number|null, \"attack_vector\": str, "
            "\"vulnerable_pattern\": str, \"affected_function_signature\": str, "
            "\"exploit_code_snippet\": str}"
            "]}. "
            "If unknown, use empty strings or null."
        )
        payload = {
            "source_name": source_name,
            "source_url": source_url,
            "source_text": snippet,
        }

        try:
            llm_output = await self.call_llm(
                system_extra=system_extra,
                messages=[{"role": "user", "content": json.dumps(payload, default=str)}],
            )
            parsed = self._parse_json_output(llm_output)
        except Exception as exc:  # pragma: no cover - env/network dependent
            self.log_step(
                "threat_extract_llm_failed",
                {"source": source_name, "error": str(exc)},
            )
            return []

        threats = parsed.get("threats", [])
        if not isinstance(threats, list):
            return []

        now_iso = datetime.now(timezone.utc).isoformat()
        normalized: list[dict[str, Any]] = []
        for threat in threats:
            if not isinstance(threat, dict):
                continue
            amount_usd = threat.get("amount_usd")
            if amount_usd in ("", None):
                amount_value = None
            else:
                try:
                    amount_value = float(amount_usd)
                except (TypeError, ValueError):
                    amount_value = None

            normalized.append(
                {
                    "protocol": str(threat.get("protocol", "")).strip(),
                    "date": str(threat.get("date", "")).strip(),
                    "amount_usd": amount_value,
                    "attack_vector": str(threat.get("attack_vector", "")).strip(),
                    "vulnerable_pattern": str(
                        threat.get("vulnerable_pattern", "")
                    ).strip(),
                    "affected_function_signature": str(
                        threat.get("affected_function_signature", "")
                    ).strip(),
                    "exploit_code_snippet": str(
                        threat.get("exploit_code_snippet", "")
                    ).strip(),
                    "source": source_name,
                    "source_url": source_url,
                    "scraped_at": now_iso,
                }
            )

        return normalized

    @staticmethod
    async def _fetch_text(session: aiohttp.ClientSession, url: str) -> str:
        async with session.get(url, allow_redirects=True) as response:
            response.raise_for_status()
            return await response.text()

    @staticmethod
    def _to_plain_text(text: str) -> str:
        scrubbed = re.sub(r"(?is)<script.*?>.*?</script>", " ", text)
        scrubbed = re.sub(r"(?is)<style.*?>.*?</style>", " ", scrubbed)
        scrubbed = re.sub(r"(?is)<[^>]+>", " ", scrubbed)
        scrubbed = re.sub(r"\s+", " ", scrubbed).strip()
        return scrubbed

    def _load_threat_db(self) -> list[dict[str, Any]]:
        path = Path(self.threat_db_path)
        if not path.is_absolute():
            path = Path.cwd() / path
        if not path.exists():
            return []
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(payload, list):
                return [item for item in payload if isinstance(item, dict)]
        except json.JSONDecodeError as exc:
            self.log_step("threat_db_load_failed", {"error": str(exc)})
        return []

    def _save_threat_db(self, threats: list[dict[str, Any]]) -> None:
        path = Path(self.threat_db_path)
        if not path.is_absolute():
            path = Path.cwd() / path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(threats, indent=2, default=str), encoding="utf-8")

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

    @staticmethod
    def _normalize_score(raw: Any) -> float:
        try:
            value = float(raw)
        except (TypeError, ValueError):
            value = 0.0
        return max(0.0, min(1.0, value))

    @staticmethod
    def _to_str_list(raw: Any) -> list[str]:
        if isinstance(raw, list):
            return [str(item).strip() for item in raw if str(item).strip()]
        if raw is None:
            return []
        value = str(raw).strip()
        return [value] if value else []

    def _parse_json_output(self, llm_output: str) -> dict[str, Any]:
        from core.utils import parse_llm_json
        parsed = parse_llm_json(llm_output)
        if not parsed:
            self.log_step(
                "threat_json_parse_failed",
                {"error": "parse error", "raw_preview": llm_output[:1000]},
            )
        return parsed
