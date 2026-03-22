import asyncio
import os
import sys

sys.path.insert(0, "/Users/ramprasadgoud/Desktop/ETH/srp")
from agents.recon_agent import ReconAgent
from server import get_project, _write_contract_source
from pathlib import Path

def test():
    project_root = "/Users/ramprasadgoud/Desktop/ETH/2026-03-intuition"
    target_path = project_root + "/src"
    sources = {}
    exclude = {"node_modules", ".git", "lib", "cache", "out", "artifacts", ".srp"}
    sol_iterator = Path(target_path).rglob("*.sol")
    for sol_file in sol_iterator:
        skip = False
        for part in sol_file.parts:
            if part in exclude:
                skip = True
                break
        if skip:
            continue
        try:
            rel = sol_file.relative_to(project_root)
            sources[str(rel)] = sol_file.read_text(encoding="utf-8")
        except Exception:
            continue

    merged_code = "\n\n".join(
        f"// --- {name} ---\n{code}" for name, code in sources.items()
    )
    
    print(f"Original merged code size: {len(merged_code)} chars")
    
    # Simulate what ReconAgent receives
    # ReconAgent's _load_sol_sources prepends some text
    simulated_src = f"File: simulated.sol\n```sol\n{merged_code}\n```\n"
    
    summary = ReconAgent._summarize_solidity(simulated_src)
    print(f"Summarized code size: {len(summary)} chars")

if __name__ == "__main__":
    test()
