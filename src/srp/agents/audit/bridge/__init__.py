"""
Bridge Agent Army — 5 specialized domain agents for cross-chain bridge audits.

Provides:
- MessageValidationAuditor
- ReplayAttackHunter
- FinalityChecker
- SignatureVerificationAuditor
- LiquidityLockAnalyzer
- run_bridge_army() — runs all 5 in parallel
"""
from __future__ import annotations

from .message_validation_auditor import MessageValidationAuditor
from .replay_attack_hunter import ReplayAttackHunter
from .finality_checker import FinalityChecker
from .signature_verification_auditor import SignatureVerificationAuditor
from .liquidity_lock_analyzer import LiquidityLockAnalyzer

__all__ = [
    "MessageValidationAuditor",
    "ReplayAttackHunter",
    "FinalityChecker",
    "SignatureVerificationAuditor",
    "LiquidityLockAnalyzer",
    "run_bridge_army",
]


async def run_bridge_army(context: dict) -> list[dict]:
    """Run all 5 bridge agents in parallel."""
    import asyncio

    agents = [
        MessageValidationAuditor(),
        ReplayAttackHunter(),
        FinalityChecker(),
        SignatureVerificationAuditor(),
        LiquidityLockAnalyzer(),
    ]

    results = await asyncio.gather(
        *[agent.run(context) for agent in agents],
        return_exceptions=True,
    )

    merged_findings: list[dict] = []
    for i, result in enumerate(results):
        agent_name = agents[i].name
        if isinstance(result, Exception):
            print(f"[SRP] [BridgeArmy] {agent_name} failed: {result}")
            continue
        if isinstance(result, dict):
            vulns = result.get("vulnerabilities", [])
            if isinstance(vulns, list):
                for vuln in vulns:
                    if isinstance(vuln, dict):
                        vuln["source_agent"] = agent_name
                merged_findings.extend(vulns)

    print(f"[SRP] [BridgeArmy] {len(merged_findings)} findings from {len(agents)} agents")
    return merged_findings
