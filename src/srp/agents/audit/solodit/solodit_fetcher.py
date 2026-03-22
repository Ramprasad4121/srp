"""
SoloditFetcher — Queries Solodit API for relevant findings based on detected protocol type.

Threat model: missing relevant findings, incorrect protocol categorization, API rate limiting
"""
from __future__ import annotations

import json
import re
from typing import Any

from srp.agents.base_agent import BaseAgent


class SoloditFetcher(BaseAgent):
    """Fetches relevant Solodit findings for the current protocol."""

    def __init__(self, model: str = "meta/llama-3.1-405b-instruct") -> None:
        super().__init__(
            name="SoloditFetcher",
            role="Solodit intelligence — queries 20k+ security findings",
            skill_keys=["audit-firm-1-solidity-auditor"],
            model=model,
        )
        self.amm_skill = self._load_amm_skill()

    def _load_amm_skill(self) -> str:
        """Load the AMM domain skill file."""
        skill_path = Path(__file__).resolve().parents[3] / "skills" / "domains" / "amm.md"
        if skill_path.is_file():
            return skill_path.read_text(encoding="utf-8")
        return ""

    async def run(self, context: dict) -> dict:
        """Run Solodit fetch phase.

        Args:
            context: Pipeline context with contract_map, recon_output, protocol_intent, etc.

        Returns:
            Dict with 'findings' list from Solodit API.
        """
        self.log_step("solodit_fetch_started", {"context_keys": list(context.keys())})

        contract_map = context.get("contract_map", {})
        recon_output = context.get("recon_output", {})
        protocol_intent = context.get("protocol_intent", {})
        detected_domain = recon_output.get("detected_domain", "")

        # Build contract source summary for keyword extraction
        if isinstance(contract_map, dict):
            contract_source = "\n".join(
                f"--- {name} ---\n{code[:3000]}" for name, code in contract_map.items()
            )
        else:
            contract_source = str(contract_map)[:8000]

        # Extract keywords from function names and contract content
        keywords = self._extract_keywords(contract_source, detected_domain)

        # Map detected domain to Solodit protocol categories
        protocol_categories = self._map_domain_to_protocol_categories(detected_domain)

        # Build Solodit API request
        request_body = {
            "page": 1,
            "pageSize": 30,
            "filters": {
                "impact": ["HIGH", "MEDIUM"],
                "protocol_categories": protocol_categories,
                "keywords": keywords[:5],  # First 5 keywords
            },
            "sort_by": "Recency",
            "sort_direction": "Desc",
        }

        # Call Solodit API
        try:
            findings = await self._call_solodit_api(request_body)
        except Exception as e:
            self.log_step("solodit_fetch_failed", {"error": str(e)})
            return {"findings": []}

        self.log_step("solodit_fetch_completed", {
            "finding_count": len(findings),
            "protocol_categories": protocol_categories,
            "keywords_used": keywords[:5],
        })
        return {"findings": findings}

    def _extract_keywords(self, contract_source: str, detected_domain: str) -> list[str]:
        """Extract relevant keywords from contract source and domain."""
        # Extract function names
        func_names = re.findall(r"function\s+(\w+)[\\s(]", contract_source)

        # Extract contract names
        contract_names = re.findall(r"contract\s+(\w+)", contract_source)

        # Domain-specific keywords
        domain_keywords = {
            "amm": ["swap", "liquidity", "tick", "fee", "pool"],
            "lending": ["borrow", "lend", "collateral", "interest", "liquidation"],
            "bridge": ["bridge", "transfer", "crosschain", "message", "relayer"],
            "staking": ["stake", "reward", "unstake", "validator", "epoch"],
            "governance": ["vote", "proposal", "quorum", "timelock", "delegate"],
            "perpetuals": ["perpetual", "funding", "margin", "position", "index"],
            "crosschain": ["crosschain", "bridge", "message", "oracle", "relayer"],
        }

        # Combine all keywords
        all_keywords = (
            func_names +
            contract_names +
            domain_keywords.get(detected_domain, [])
        )

        # Filter to relevant security terms
        security_terms = [
            "reentrancy", "access", "control", "overflow", "underflow",
            "integer", "overflow", "unchecked", "unchecked", "math", "unchecked",
            "delegatecall", "call", "callcode", "staticcall", "send", "transfer",
            "approve", "transferFrom", "permit", "permit", "permit",
            "external", "internal", "public", "private", "view", "pure",
            "payable", "nonpayable", "fallback", "receive", "constructor",
            "modifier", "require", "assert", "revert", "panic", "error",
            "unchecked", "unchecked", "unchecked", "unchecked", "unchecked",
            "unchecked", "unchecked", "unchecked", "unchecked", "unchecked",
            "unchecked", "unchecked", "unchecked", "unchecked", "unchecked",
        ]

        # Keep only keywords that contain security terms
        filtered_keywords = [
            kw for kw in all_keywords
            if any(term in kw.lower() for term in security_terms)
        ]

        # Remove duplicates and limit to 10
        unique_keywords = list(set(filtered_keywords))
        return unique_keywords[:10]

    def _map_domain_to_protocol_categories(self, detected_domain: str) -> list[str]:
        """Map detected domain to Solodit protocol categories."""
        category_mapping = {
            "amm": ["DeFi"],
            "lending": ["Lending"],
            "bridge": ["Bridge"],
            "staking": ["Staking"],
            "governance": ["Governance"],
            "perpetuals": ["Perpetuals"],
            "crosschain": ["Crosschain"],
        }
        return category_mapping.get(detected_domain, [])

    async def _call_solodit_api(self, body: dict) -> list[dict]:
        """Call Solodit API with proper authentication."""
        api_key = os.environ.get("CYFRIN_API_KEY")
        if not api_key:
            raise RuntimeError("CYFRIN_API_KEY not set in environment")

        url = "https://solodit.cyfrin.io/api/v1/solodit/findings"
        headers = {
            "Content-Type": "application/json",
            "X-Cyfrin-API-Key": api_key,
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=body, headers=headers) as response:
                if response.status == 200:
                    return await response.json()
                elif response.status == 401:
                    raise RuntimeError("Invalid API key for Solodit")
                elif response.status == 429:
                    raise RuntimeError("Solodit API rate limited")
                else:
                    raise RuntimeError(f"Solodit API error: {response.status}")

    def _parse_response(self, raw: str) -> dict:
        """Parse LLM JSON response."""
        from srp.core.utils import parse_llm_json
        return parse_llm_json(raw)

    def _normalize_findings(self, findings: Any) -> list[dict]:
        """Normalize findings to standard schema."""
        if not isinstance(findings, list):
            return []
        normalized: list[dict] = []
        for idx, f in enumerate(findings, start=1):
            if not isinstance(f, dict):
                continue
            severity = str(f.get("impact", "medium")).strip().upper()
            if severity not in {"CRITICAL", "HIGH", "MEDIUM", "LOW"}:
                severity = "MEDIUM"
            normalized.append({
                "id": str(f.get("id", f"SOL-001-{idx:03d}")),
                "title": str(f.get("title", "Untitled")).strip(),
                "severity": severity,
                "contract": str(f.get("contract", "")).strip(),
                "description": str(f.get("description", "")).strip(),
                "vuln_code": str(f.get("vuln_code", "")).strip(),
                "fix_code": str(f.get("fix_code", "")).strip(),
                "exploit_code": str(f.get("exploit_code", "")).strip(),
                "solodit_url": str(f.get("url", "")).strip(),
                "solodit_id": str(f.get("id", "")).strip(),
                "protocol": str(f.get("protocol", "")).strip(),
                "firms": f.get("issues_issue_finders", []),
                "tags": f.get("tags", []),
            })
        return normalized