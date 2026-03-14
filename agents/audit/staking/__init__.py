"""
Staking Agent Army — 4 specialized domain agents for staking protocol audits.

Provides:
- RebasingMathVerifier
- SlashingPropagationChecker
- WithdrawalQueueAuditor
- RewardDistributionVerifier
- run_staking_army() — runs all 4 in parallel and merges findings
"""
from __future__ import annotations

from .rebasing_math_verifier import RebasingMathVerifier
from .slashing_propagation_checker import SlashingPropagationChecker
from .withdrawal_queue_auditor import WithdrawalQueueAuditor
from .reward_distribution_verifier import RewardDistributionVerifier

__all__ = [
    "RebasingMathVerifier",
    "SlashingPropagationChecker",
    "WithdrawalQueueAuditor",
    "RewardDistributionVerifier",
    "run_staking_army",
]


async def run_staking_army(context: dict) -> list[dict]:
    """Run all 4 staking agents in parallel and merge their findings.

    Args:
        context: Pipeline context with contract_map, recon_output, etc.

    Returns:
        Flat list of vulnerability finding dicts from all staking agents.
    """
    import asyncio

    agents = [
        RebasingMathVerifier(),
        SlashingPropagationChecker(),
        WithdrawalQueueAuditor(),
        RewardDistributionVerifier(),
    ]

    results = await asyncio.gather(
        *[agent.run(context) for agent in agents],
        return_exceptions=True,
    )

    merged_findings: list[dict] = []
    for i, result in enumerate(results):
        agent_name = agents[i].name
        if isinstance(result, Exception):
            print(f"[SRP] [StakingArmy] {agent_name} failed: {result}")
            continue
        if isinstance(result, dict):
            vulns = result.get("vulnerabilities", [])
            if isinstance(vulns, list):
                for vuln in vulns:
                    if isinstance(vuln, dict):
                        vuln["source_agent"] = agent_name
                merged_findings.extend(vulns)

    print(f"[SRP] [StakingArmy] {len(merged_findings)} findings from {len(agents)} agents")
    return merged_findings
