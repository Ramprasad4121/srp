"""
Solodit Intelligence Phase — 4-agent system for cross-referencing with Solodit's 20k+ smart contract security findings.

Threat model: missing vulnerabilities, false positives, severity underestimation
"""
from __future__ import annotations

from typing import Any

from srp.agents.base_agent import BaseAgent


async def run_solodit_phase(context: dict) -> list[dict]:
    """Run full Solodit intelligence phase.

    Args:
        context: Pipeline context with contract_map, recon_output, protocol_intent, etc.

    Returns:
        List of confirmed Solodit findings with mappings.
    """
    from .solodit_fetcher import SoloditFetcher
    from .solodit_mapper import SoloditMapper
    from .solodit_verifier import SoloditVerifier

    fetcher = SoloditFetcher()
    mapper = SoloditMapper()
    verifier = SoloditVerifier()
    crosschecker = SoloditCrosschecker()

    # Phase 1: Fetch relevant Solodit findings
    try:
        fetcher_results = await fetcher.run(context)
        if not fetcher_results.get('findings'):
            return []
    except Exception as e:
        raise RuntimeError(f"Solodit fetch failed: {e}")

    # Phase 2: Map findings to current codebase
    try:
        mapper_results = await mapper.run({**context, **fetcher_results})
    except Exception as e:
        raise RuntimeError(f"Solodit mapping failed: {e}")

    # Phase 3: Verify mappings exist in current code
    try:
        verifier_results = await verifier.run({**context, **mapper_results})
    except Exception as e:
        raise RuntimeError(f"Solodit verification failed: {e}")

    return verifier_results.get('confirmed_findings', [])