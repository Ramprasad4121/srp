"""
FlashLoanHunter — Specialized agent for flash loan attack vectors in lending protocols.

Threat model: health factor manipulation in single transaction, callback reentrancy,
single-block index manipulation, flash loan + oracle manipulation combos.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from uuid import uuid4

from agents.base_agent import BaseAgent


class FlashLoanHunter(BaseAgent):
    """Hunts for flash loan attack vectors in lending protocols."""

    def __init__(self, model: str = "meta/llama-3.1-405b-instruct") -> None:
        super().__init__(
            name="FlashLoanHunter",
            role="Lending domain specialist — hunts flash loan attack vectors, callback reentrancy, and single-tx exploits",
            skill_keys=["audit-firm-1-solidity-auditor", "quillai-reentrancy"],
            model=model,
        )
        self.lending_skill = self._load_lending_skill()

    def _load_lending_skill(self) -> str:
        """Load the lending domain skill file."""
        skill_path = Path(__file__).resolve().parents[3] / "skills" / "domains" / "lending.md"
        if skill_path.is_file():
            return skill_path.read_text(encoding="utf-8")
        return ""

    async def run(self, context: dict) -> dict:
        """Run flash loan-focused audit on the lending protocol.

        Args:
            context: Pipeline context with contract_map, recon_output, protocol_intent, etc.

        Returns:
            Dict with 'vulnerabilities' list in standard finding schema.
        """
        self.log_step("flash_loan_hunt_started", {"context_keys": list(context.keys())})

        contract_map = context.get("contract_map", {})
        recon_output = context.get("recon_output", {})
        protocol_intent = context.get("protocol_intent", {})
        entry_points = recon_output.get("entry_points", {})
        external_calls = recon_output.get("external_calls", [])

        if isinstance(contract_map, dict):
            contract_source = "\n".join(
                f"--- {name} ---\n{code[:5000]}" for name, code in contract_map.items()
            )
        else:
            contract_source = str(contract_map)[:10000]

        invariant_context = ""
        if isinstance(protocol_intent, dict):
            invariants = protocol_intent.get("invariants", [])
            if invariants:
                invariant_context = "Protocol-declared invariants:\n" + "\n".join(
                    f"- {inv.get('id', 'N/A')}: {inv.get('description', '')}" for inv in invariants
                )

        system_prompt = f"""
{self.lending_skill}

You are FLASH LOAN HUNTER — a specialist in flash loan attack vectors against lending protocols.

Your SOLE focus: find ways flash loans can be used to exploit the protocol in a single transaction.

{invariant_context}

External calls detected (may include flash loan interfaces): {json.dumps(external_calls)[:2000]}

Specific checks you MUST perform:
1. HEALTH FACTOR MANIPULATION: Can a flash loan be used to temporarily inflate collateral, borrow against it, then withdraw — leaving the position underwater after the flash loan is repaid?
2. CALLBACK REENTRANCY: Does the flash loan callback (onFlashLoan, executeOperation, etc.) allow re-entering lending functions? Check: deposit, borrow, withdraw, repay, liquidate within the callback.
3. INDEX MANIPULATION: Can a flash loan deposit a large amount to manipulate supply/borrow indexes within one block, then withdraw after profiting from the distorted index?
4. ORACLE MANIPULATION COMBO: Can a flash loan be combined with a DEX trade to manipulate the on-chain oracle price (TWAP, spot), then use the distorted price to borrow more or avoid liquidation?
5. FLASH MINT vs FLASH LOAN: Does the protocol support flash minting of debt tokens? If so, can flash-minted tokens be used as collateral or to game reward calculations?
6. SAME-BLOCK BORROW+REPAY: Can a user borrow and repay in the same block/transaction to game interest calculations, reward accrual, or governance voting power?
7. COLLATERAL FACTOR GAMING: Can flash-loaned tokens be deposited as collateral to temporarily boost borrowing power beyond what the position would normally support?
8. LIQUIDATION GAMING: Can a flash loan be used to self-liquidate a position (from a second address) to capture the liquidation bonus?
9. ERC-777 / HOOKS: If the protocol supports tokens with transfer hooks (ERC-777), can flash loans trigger reentrancy through these hooks?
10. FLASH LOAN FEE BYPASS: Can the flash loan fee be avoided or reduced through creative routing?

Entry points detected: {json.dumps(entry_points)[:3000]}

Return ONLY valid JSON:
{{
  "vulnerabilities": [
    {{
      "id": "LEND-FL-001",
      "title": "string — specific vulnerability title",
      "severity": "critical|high|medium|low",
      "contract": "contract name",
      "description": "detailed description of the vulnerability and how to exploit it",
      "vuln_code": "the vulnerable code snippet",
      "fix_code": "the fixed code snippet",
      "exploit_code": "complete Foundry test exploit — use vm.startPrank(attacker), execute flash loan, demonstrate profit or broken invariant"
    }}
  ]
}}
"""
        user_payload = json.dumps(
            {"CONTRACT_CODE": contract_source[:15000]},
            indent=2,
            default=str,
        )
        if len(user_payload) > 15000:
            user_payload = user_payload[:15000] + "\n...[TRUNCATED]..."

        messages = [{"role": "user", "content": user_payload}]
        self.log_step("flash_loan_hunt_prompt_built", {"prompt_chars": len(system_prompt) + len(user_payload)})

        raw_response = await self.call_llm(
            system_extra=system_prompt,
            messages=messages,
            api_key=context.get("api_key"),
            max_tokens=4096,
            timeout=120.0,
        )
        self.log_step("flash_loan_hunt_llm_response", {"response_chars": len(raw_response)})

        parsed = self._parse_response(raw_response)
        vulnerabilities = self._normalize_findings(parsed.get("vulnerabilities", []))

        self.log_step("flash_loan_hunt_completed", {"finding_count": len(vulnerabilities)})
        return {"vulnerabilities": vulnerabilities}

    def _parse_response(self, raw: str) -> dict:
        """Parse LLM JSON response."""
        from core.utils import parse_llm_json
        return parse_llm_json(raw)

    def _normalize_findings(self, findings: Any) -> list[dict]:
        """Normalize findings to standard schema."""
        if not isinstance(findings, list):
            return []

        normalized: list[dict] = []
        for idx, f in enumerate(findings, start=1):
            if not isinstance(f, dict):
                continue

            severity = str(f.get("severity", "medium")).strip().lower()
            if severity not in {"critical", "high", "medium", "low"}:
                severity = "medium"

            normalized.append({
                "id": str(f.get("id", f"LEND-FL-{idx:03d}")),
                "title": str(f.get("title", "Untitled")).strip(),
                "severity": severity,
                "contract": str(f.get("contract", "")).strip(),
                "description": str(f.get("description", "")).strip(),
                "vuln_code": str(f.get("vuln_code", "")).strip(),
                "fix_code": str(f.get("fix_code", "")).strip(),
                "exploit_code": str(f.get("exploit_code", "")).strip(),
            })

        return normalized
