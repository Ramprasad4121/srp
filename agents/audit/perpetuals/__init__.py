"""
Perpetuals Agent Army — 4 specialized domain agents for perpetual futures audits.

Provides:
- FundingRateAuditor
- MarkPriceHunter
- MarginAccountingVerifier
- InsuranceFundAnalyzer
- run_perpetuals_army() — runs all 4 in parallel and merges findings
"""
from __future__ import annotations

from .funding_rate_auditor import FundingRateAuditor
from .mark_price_hunter import MarkPriceHunter
from .margin_accounting_verifier import MarginAccountingVerifier
from .insurance_fund_analyzer import InsuranceFundAnalyzer

__all__ = [
    "FundingRateAuditor",
    "MarkPriceHunter",
    "MarginAccountingVerifier",
    "InsuranceFundAnalyzer",
    "run_perpetuals_army",
]


async def run_perpetuals_army(context: dict) -> list[dict]:
    """Run all 4 perpetuals agents in parallel and merge their findings.

    Args:
        context: Pipeline context with contract_map, recon_output, etc.

    Returns:
        Flat list of vulnerability finding dicts from all perpetuals agents.
    """
    import asyncio

    agents = [
        FundingRateAuditor(),
        MarkPriceHunter(),
        MarginAccountingVerifier(),
        InsuranceFundAnalyzer(),
    ]

    results = await asyncio.gather(
        *[agent.run(context) for agent in agents],
        return_exceptions=True,
    )

    merged_findings: list[dict] = []
    for i, result in enumerate(results):
        agent_name = agents[i].name
        if isinstance(result, Exception):
            print(f"[SRP] [PerpetualsArmy] {agent_name} failed: {result}")
            continue
        if isinstance(result, dict):
            vulns = result.get("vulnerabilities", [])
            if isinstance(vulns, list):
                for vuln in vulns:
                    if isinstance(vuln, dict):
                        vuln["source_agent"] = agent_name
                merged_findings.extend(vulns)

    print(f"[SRP] [PerpetualsArmy] {len(merged_findings)} findings from {len(agents)} agents")
    return merged_findings
