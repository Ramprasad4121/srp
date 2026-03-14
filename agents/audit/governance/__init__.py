"""
Governance Agent Army — 4 specialized domain agents for DAO governance audits.

Provides:
- VoteManipulationHunter
- TimelockBypassChecker
- ProposalOrderingAnalyzer
- QuorumManipulationHunter
- run_governance_army() — runs all 4 in parallel and merges findings
"""
from __future__ import annotations

from .vote_manipulation_hunter import VoteManipulationHunter
from .timelock_bypass_checker import TimelockBypassChecker
from .proposal_ordering_analyzer import ProposalOrderingAnalyzer
from .quorum_manipulation_hunter import QuorumManipulationHunter

__all__ = [
    "VoteManipulationHunter",
    "TimelockBypassChecker",
    "ProposalOrderingAnalyzer",
    "QuorumManipulationHunter",
    "run_governance_army",
]


async def run_governance_army(context: dict) -> list[dict]:
    """Run all 4 governance agents in parallel and merge their findings.

    Args:
        context: Pipeline context with contract_map, recon_output, etc.

    Returns:
        Flat list of vulnerability finding dicts from all governance agents.
    """
    import asyncio

    agents = [
        VoteManipulationHunter(),
        TimelockBypassChecker(),
        ProposalOrderingAnalyzer(),
        QuorumManipulationHunter(),
    ]

    results = await asyncio.gather(
        *[agent.run(context) for agent in agents],
        return_exceptions=True,
    )

    merged_findings: list[dict] = []
    for i, result in enumerate(results):
        agent_name = agents[i].name
        if isinstance(result, Exception):
            print(f"[SRP] [GovernanceArmy] {agent_name} failed: {result}")
            continue
        if isinstance(result, dict):
            vulns = result.get("vulnerabilities", [])
            if isinstance(vulns, list):
                for vuln in vulns:
                    if isinstance(vuln, dict):
                        vuln["source_agent"] = agent_name
                merged_findings.extend(vulns)

    print(f"[SRP] [GovernanceArmy] {len(merged_findings)} findings from {len(agents)} agents")
    return merged_findings
