"""
Lending Agent Army — 5 specialized domain agents for DeFi lending protocol audits.

Provides:
- LiquidationAuditor
- InterestRateAuditor
- OracleDependencyAuditor
- BadDebtAuditor
- FlashLoanHunter
- run_lending_army() — runs all 5 in parallel and merges findings
"""
from __future__ import annotations

from .liquidation_auditor import LiquidationAuditor
from .interest_rate_auditor import InterestRateAuditor
from .oracle_dependency_auditor import OracleDependencyAuditor
from .bad_debt_auditor import BadDebtAuditor
from .flash_loan_hunter import FlashLoanHunter

__all__ = [
    "LiquidationAuditor",
    "InterestRateAuditor",
    "OracleDependencyAuditor",
    "BadDebtAuditor",
    "FlashLoanHunter",
    "run_lending_army",
]


async def run_lending_army(context: dict) -> list[dict]:
    """Run all 5 lending agents in parallel and merge their findings.

    Args:
        context: Pipeline context with contract_map, recon_output, etc.

    Returns:
        Flat list of vulnerability finding dicts from all lending agents.
    """
    import asyncio

    agents = [
        LiquidationAuditor(),
        InterestRateAuditor(),
        OracleDependencyAuditor(),
        BadDebtAuditor(),
        FlashLoanHunter(),
    ]

    results = await asyncio.gather(
        *[agent.run(context) for agent in agents],
        return_exceptions=True,
    )

    merged_findings: list[dict] = []
    for i, result in enumerate(results):
        agent_name = agents[i].name
        if isinstance(result, Exception):
            print(f"[SRP] [LendingArmy] {agent_name} failed: {result}")
            continue
        if isinstance(result, dict):
            vulns = result.get("vulnerabilities", [])
            if isinstance(vulns, list):
                # Tag each finding with the source agent
                for vuln in vulns:
                    if isinstance(vuln, dict):
                        vuln["source_agent"] = agent_name
                        merged_findings.append(vuln)

    print(f"[SRP] [LendingArmy] {len(merged_findings)} findings from {len(agents)} agents")
    return merged_findings
