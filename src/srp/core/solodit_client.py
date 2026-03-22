import aiohttp
import json
import os
from typing import Optional


class SoloditClient:
    """
    Direct Solodit API client for SRP agents.
    Used when claudit MCP server is not available (fallback).
    Primary usage is via claudit MCP — this is the fallback.
    """

    BASE_URL = "https://solodit.cyfrin.io/api"

    def __init__(self):
        self.api_key = os.environ.get("SOLODIT_API_KEY", "")
        self.available = bool(self.api_key)

    async def search_findings(
        self,
        keywords: str,
        severity: list = ["HIGH", "CRITICAL"],
        tags: list = None,
        firms: list = None,
        protocol: str = None,
        sort_by: str = "Quality",
        page_size: int = 10,
        reported: str = "alltime"
    ) -> list:
        """Search Solodit for real-world findings matching a pattern."""
        if not self.available:
            return []

        params = {
            "keywords": keywords,
            "severity": severity,
            "sort_by": sort_by,
            "sort_direction": "Desc",
            "page": 1,
            "page_size": page_size,
            "reported": reported
        }
        if tags:
            params["tags"] = tags
        if firms:
            params["firms"] = firms
        if protocol:
            params["protocol"] = protocol

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.BASE_URL}/findings/search",
                    json=params,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return data.get("results", [])
                    return []
        except Exception:
            return []

    async def get_finding(self, finding_id: str) -> dict:
        """Get full details for a specific finding by ID or slug."""
        if not self.available:
            return {}
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.BASE_URL}/findings/{finding_id}",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as resp:
                    if resp.status == 200:
                        return await resp.json()
                    return {}
        except Exception:
            return {}

    async def get_latest_threats(self, days: int = 30) -> list:
        """Get brand new findings from last N days — live threat feed."""
        return await self.search_findings(
            keywords="",
            severity=["HIGH", "CRITICAL"],
            sort_by="Recency",
            reported=str(days),
            page_size=50
        )

    async def match_contract_patterns(self, function_names: list, contract_type: str = "") -> list:
        """
        For a list of function names found in a contract,
        search Solodit for real findings that match these patterns.
        Returns deduplicated findings sorted by quality score.
        """
        all_findings = []
        seen_ids = set()

        # Search for each function name pattern
        search_terms = function_names[:5]  # limit to top 5 to avoid rate limits
        if contract_type:
            search_terms.append(contract_type)

        for term in search_terms:
            results = await self.search_findings(
                keywords=term,
                severity=["HIGH", "CRITICAL"],
                sort_by="Quality",
                page_size=5
            )
            for r in results:
                rid = r.get("id") or r.get("slug")
                if rid and rid not in seen_ids:
                    seen_ids.add(rid)
                    all_findings.append(r)

        return all_findings
