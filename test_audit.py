#!/usr/bin/env python3
"""Test SRP audit on SecondSwap - runs the audit pipeline directly."""
import asyncio
import os
import sys
from pathlib import Path

# Load .env first
from dotenv import load_dotenv
load_dotenv()

# Add SRP to path
SRP_ROOT = Path(__file__).parent
if str(SRP_ROOT) not in sys.path:
    sys.path.insert(0, str(SRP_ROOT))

from core.orchestrator import SRPOrchestrator
from core.project import SRPProject

os.chdir("/Users/ramprasadgoud/Desktop/ETH/2024-12-secondswap")
os.environ["SRP_PROJECT_ROOT"] = "/Users/ramprasadgoud/Desktop/ETH/2024-12-secondswap"

async def main():
    # Check environment
    api_key = os.environ.get("NVIDIA_API_KEY")
    print(f"API Key present: {bool(api_key)} (len={len(api_key) if api_key else 0})")

    project = SRPProject(".")
    config = project.load()
    print(f"Project: {config['project_name']}")
    print(f"Contracts: {config['total_contracts']}")
    print(f"Compiler: {config['compiler_version']}")

    # Get contracts
    contracts_dir = Path("contracts")
    sol_files = list(contracts_dir.rglob("*.sol"))
    sol_files = [f for f in sol_files if not any(p in str(f) for p in ["node_modules", ".git"])]
    print(f"\nFound {len(sol_files)} Solidity files to audit")

    contract_paths = [str(f) for f in sol_files]

    print("\n" + "="*60)
    print("STARTING SRP AUDIT")
    print("="*60)

    orchestrator = SRPOrchestrator()

    result = await orchestrator.run_full_audit(
        raw_input="Audit all SecondSwap contracts for security vulnerabilities. Focus on reentrancy, access control, invariant violations.",
        contract_paths=contract_paths,
        budget_usd=50.0,
    )

    print("\n" + "="*60)
    print("AUDIT COMPLETE")
    print("="*60)

    # Print results
    trace = result.get("trace", {})
    attack = result.get("attack", {})
    defense = result.get("defense", {})

    print(f"\nTrace ID: {trace.get('trace_id', 'N/A')}")
    print(f"Score: {defense.get('overall_security_score', 'N/A')}/100")

    vulns = attack.get("vulnerabilities", [])
    print(f"\nVulnerabilities found: {len(vulns)}")

    for i, v in enumerate(vulns[:5], 1):
        print(f"\n{i}. {v.get('title', 'Unknown')}")
        print(f"   Severity: {v.get('severity', 'unknown')}")
        print(f"   Function: {v.get('affected_function', 'unknown')}")

    return result

if __name__ == "__main__":
    result = asyncio.run(main())
