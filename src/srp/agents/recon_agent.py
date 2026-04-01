from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .base_agent import BaseAgent


class ReconAgent(BaseAgent):
    """Maps contract architecture and identifies entry points.
    
    Phase 2 — Architecture Mapping:
    Draw the system before reading it deeply. Identify trust boundaries and value flows.
    """
    def __init__(self, model: str = "meta/llama-3.1-405b-instruct") -> None:
        super().__init__(
            name="ReconAgent",
            role="Maps contract architecture, trust boundaries, and value flows",
        )

    async def run(self, context: dict) -> dict:
        self.log_step("recon_mapping_started", {"context_keys": list(context.keys())})

        contract_paths = context.get("contract_paths", [])
        sol_files = self._collect_sol_files(contract_paths)
        source_payload = self._build_source_payload(sol_files)

        system_prompt = (
            "You are a protocol architect performing Phase 2 Architecture Mapping. "
            "Analyze the Solidity sources and map the system architecture.\n\n"
            "Identify:\n"
            "1. All contracts and their ownership/roles.\n"
            "2. External calls (Trust boundaries: Oracles, Bridges, Tokens).\n"
            "3. Value flows (Where does money enter and leave?).\n"
            "4. Access control matrix.\n\n"
            "Return ONLY valid JSON with keys: "
            "contracts, external_calls, roles, value_flows, entry_points, access_control. "
            "value_flows must be an array of objects: {from, to, asset, action}."
        )
        
        user_prompt = (
            f"Solidity sources:\n{source_payload['sources_text'][:15000]}"
        )
        
        messages = [{"role": "user", "content": user_prompt}]
        llm_output = await self.call_llm(system_extra=system_prompt, messages=messages, max_tokens=4096)
        
        try:
            recon = self.parse_json(llm_output)
        except Exception:
            recon = {"contracts": [], "external_calls": [], "value_flows": []}

        self.log_step("recon_mapping_completed", {"contracts_found": len(recon.get("contracts", []))})
        return recon

    @staticmethod
    def _summarize_solidity(content: str) -> str:
        import re
        content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
        lines = content.splitlines()
        summary = []
        depth = 0
        
        for line in lines:
            line_str = line.strip()
            if not line_str or line_str.startswith("//"):
                continue
                
            if re.match(r'^(contract|interface|library|abstract\s+contract)\b', line_str):
                summary.append(line_str)
            elif depth == 1:
                if re.match(r'^(function|modifier|event|error|constructor|fallback|receive)\b', line_str):
                    summary.append("  " + line_str)
                elif line_str.endswith(";") or ";" in line_str:
                    if not line_str.startswith("return") and not line_str.startswith("require"):
                        summary.append("  " + line_str)
            
            # Simple brace depth tracking
            depth += line_str.count('{')
            depth -= line_str.count('}')
            
        return "\n".join(summary)

    def _collect_sol_files(self, contract_paths: list[Any]) -> list[str]:
        import os
        import glob
        discovered: list[str] = []
        seen: set[str] = set()

        for raw_path in contract_paths:
            if raw_path is None:
                continue
            path_str = str(raw_path)
            if os.path.isfile(path_str) and path_str.endswith(".sol"):
                discovered.append(os.path.abspath(path_str))
            elif os.path.isdir(path_str):
                pattern = os.path.join(path_str, "**/*.sol")
                for sol_file in sorted(glob.glob(pattern, recursive=True)):
                    discovered.append(os.path.abspath(sol_file))
        return discovered

    def _build_source_payload(self, sol_files: list[str]) -> dict[str, Any]:
        sources: list[str] = []
        for file_path in sol_files:
            try:
                content = Path(file_path).read_text(encoding="utf-8")
                sources.append(f"File: {file_path}\n```sol\n{content}\n```\n")
            except Exception:
                pass
        return {"sources_text": "\n".join(sources)}
