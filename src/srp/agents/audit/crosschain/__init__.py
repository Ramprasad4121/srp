"""
Cross-Chain Agent Army — 4 specialized domain agents for cross-chain messaging audits.

Provides:
- CCIPSecurityAuditor
- LayerZeroAuditor
- MessageOrderingChecker
- BridgeAssetReconciler
- run_crosschain_army() — runs all 4 in parallel and merges findings
"""
from __future__ import annotations

from .ccip_security_auditor import CCIPSecurityAuditor
from .layerzero_auditor import LayerZeroAuditor
from .message_ordering_checker import MessageOrderingChecker
from .bridge_asset_reconciler import BridgeAssetReconciler

__all__ = [
    "CCIPSecurityAuditor",
    "LayerZeroAuditor",
    "MessageOrderingChecker",
    "BridgeAssetReconciler",
    "run_crosschain_army",
]


async def run_crosschain_army(context: dict) -> list[dict]:
    """Run all 4 cross-chain agents in parallel and merge their findings.

    Args:
        context: Pipeline context with contract_map, recon_output, etc.

    Returns:
        Flat list of vulnerability finding dicts from all cross-chain agents.
    """
    import asyncio

    agents = [
        CCIPSecurityAuditor(),
        LayerZeroAuditor(),
        MessageOrderingChecker(),
        BridgeAssetReconciler(),
    ]

    results = await asyncio.gather(
        *[agent.run(context) for agent in agents],
        return_exceptions=True,
    )

    merged_findings: list[dict] = []
    for i, result in enumerate(results):
        agent_name = agents[i].name
        if isinstance(result, Exception):
            print(f"[SRP] [CrossChainArmy] {agent_name} failed: {result}")
            continue
        if isinstance(result, dict):
            vulns = result.get("vulnerabilities", [])
            if isinstance(vulns, list):
                for vuln in vulns:
                    if isinstance(vuln, dict):
                        vuln["source_agent"] = agent_name
                merged_findings.extend(vulns)

    print(f"[SRP] [CrossChainArmy] {len(merged_findings)} findings from {len(agents)} agents")
    return merged_findings
