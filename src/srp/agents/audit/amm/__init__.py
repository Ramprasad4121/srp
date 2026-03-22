"""
AMM Agent Army — 5 specialized domain agents for AMM protocol audits.

Provides:
- InvariantVerifier
- PriceManipulationHunter
- TickMathAuditor
- CallbackReentrancyHunter
- FeeAccountingVerifier
- run_amm_army() — runs all 5 in parallel and merges findings
"""
from __future__ import annotations

from .invariant_verifier import InvariantVerifier
from .price_manipulation_hunter import PriceManipulationHunter
from .tick_math_auditor import TickMathAuditor
from .callback_reentrancy_hunter import CallbackReentrancyHunter
from .fee_accounting_verifier import FeeAccountingVerifier

__all__ = [
    "InvariantVerifier",
    "PriceManipulationHunter",
    "TickMathAuditor",
    "CallbackReentrancyHunter",
    "FeeAccountingVerifier",
    "run_amm_army",
]


async def run_amm_army(context: dict) -> list[dict]:
    """Run all 5 AMM agents in parallel and merge their findings.

    Args:
        context: Pipeline context with contract_map, recon_output, etc.

    Returns:
        Flat list of vulnerability finding dicts from all AMM agents.
    """
    import asyncio

    agents = [
        InvariantVerifier(),
        PriceManipulationHunter(),
        TickMathAuditor(),
        CallbackReentrancyHunter(),
        FeeAccountingVerifier(),
    ]

    results = await asyncio.gather(
        *[agent.run(context) for agent in agents],
        return_exceptions=True,
    )

    merged_findings: list[dict] = []
    for i, result in enumerate(results):
        agent_name = agents[i].name
        if isinstance(result, Exception):
            print(f"[SRP] [AMMArmy] {agent_name} failed: {result}")
            continue
        if isinstance(result, dict):
            vulns = result.get("vulnerabilities", [])
            if isinstance(vulns, list):
                # Tag each finding with the source agent
                for vuln in vulns:
                    if isinstance(vuln, dict):
                        vuln["source_agent"] = agent_name
                merged_findings.extend(vulns)

    print(f"[SRP] [AMMArmy] {len(merged_findings)} findings from {len(agents)} agents")
    return merged_findings
