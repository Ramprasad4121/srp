"""
TickMathAuditor — Specialized agent for concentrated liquidity tick math edge cases.

Threat model: tick boundary bugs, out-of-range liquidity, price overflow/underflow
at extreme ticks, incorrect tick spacing enforcement.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from srp.agents.base_agent import BaseAgent


class TickMathAuditor(BaseAgent):
    """Audits Uniswap V3-style tick math for boundary conditions and edge cases."""

    def __init__(self, model: str = "meta/llama-3.1-405b-instruct") -> None:
        super().__init__(
            name="TickMathAuditor",
            role="AMM domain specialist — audits concentrated liquidity tick math for edge cases",
            skill_keys=["audit-firm-1-solidity-auditor"],
            model=model,
        )
        self.amm_skill = self._load_amm_skill()

    def _load_amm_skill(self) -> str:
        """Load the AMM domain skill file."""
        skill_path = Path(__file__).resolve().parents[3] / "skills" / "domains" / "amm.md"
        if skill_path.is_file():
            return skill_path.read_text(encoding="utf-8")
        return ""

    async def run(self, context: dict) -> dict:
        """Run tick math-focused audit on the AMM protocol.

        Args:
            context: Pipeline context with contract_map, recon_output, protocol_intent, etc.

        Returns:
            Dict with 'vulnerabilities' list in standard finding schema.
        """
        self.log_step("tick_math_audit_started", {"context_keys": list(context.keys())})

        contract_map = context.get("contract_map", {})
        recon_output = context.get("recon_output", {})
        protocol_intent = context.get("protocol_intent", {})
        entry_points = recon_output.get("entry_points", {})

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
{self.amm_skill}

You are TICK MATH AUDITOR — a specialist in Uniswap V3-style concentrated liquidity tick math.

Your SOLE focus: find exploitable flaws in tick math, tick boundaries, and out-of-range behavior.

{invariant_context}

Specific checks you MUST perform:
1. TICK BOUNDARY: Can tick cross from MIN_TICK (-887272) or MAX_TICK (887272)? Does the protocol handle
   the boundaries correctly where liquidity goes to zero?

2. OUT-OF-RANGE LIQUIDITY: What happens when all liquidity is removed from a price range?
   Can swaps still execute? Can LP positions be created with zero liquidity?

3. TICK SPACING: Is tickSpacing enforced correctly? Can positions be minted at invalid ticks
   (not divisible by tickSpacing)?

4. PRICE OVERFLOW: At extreme ticks, does `getSqrtRatioAtTick` overflow? At tick 887272,
   the price is ~1.0001^887272, which can overflow uint256 if not handled.

5. LIQUIDITY MATH: Does `liquidityDelta` calculation handle negative values correctly?
   Can liquidity underflow when removing positions?

6. CROSSED TICKS: When a swap crosses a tick, is the liquidity net updated BEFORE or AFTER
   the swap calculation? Ordering matters for price impact.

7. OBSERVATION CARDINALITY: For TWAP, does observation cardinality overflow? Can old observations
   be overwritten, corrupting the TWAP?

8. FLASH PRECISION: When flash loans occur near tick boundaries, can precision errors accumulate?
   Check: the exact output amount calculation at boundary crossings.

9. TICK BITMAP: Is the tick bitmap correctly updated when liquidity is added/removed?
   Can the bitmap become inconsistent with actual liquidity positions?

10. ZERO LIQUIDITY SWAPS: Can swaps execute when there's no active liquidity?
    What price is returned? Can this be exploited to drain fees?

Entry points detected: {json.dumps(entry_points)[:3000]}

Look for these patterns:
- `getSqrtRatioAtTick` without overflow checks
- `getTickAtSqrtRatio` that could revert
- `mint` not validating tick % tickSpacing == 0
- `swap` not checking liquidity > 0
- Liquidity updates in wrong order relative to price calculation

Return ONLY valid JSON:
{{
  "vulnerabilities": [
    {{
      "id": "AMM-TICK-001",
      "title": "string — specific vulnerability title",
      "severity": "critical|high|medium|low",
      "contract": "contract name",
      "description": "detailed description of the vulnerability and how to exploit it",
      "vuln_code": "the vulnerable code snippet",
      "fix_code": "the fixed code snippet",
      "exploit_code": "exploit showing tick boundary manipulation"
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
        self.log_step("tick_math_audit_prompt_built", {"prompt_chars": len(system_prompt) + len(user_payload)})

        raw_response = await self.call_llm(
            system_extra=system_prompt,
            messages=messages,
            api_key=context.get("api_key"),
            max_tokens=4096,
            timeout=120.0,
        )
        self.log_step("tick_math_audit_llm_response", {"response_chars": len(raw_response)})

        parsed = self._parse_response(raw_response)
        vulnerabilities = self._normalize_findings(parsed.get("vulnerabilities", []))

        self.log_step("tick_math_audit_completed", {"finding_count": len(vulnerabilities)})
        return {"vulnerabilities": vulnerabilities}

    def _parse_response(self, raw: str) -> dict:
        """Parse LLM JSON response."""
        from srp.core.utils import parse_llm_json
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
                "id": str(f.get("id", f"AMM-TICK-{idx:03d}")),
                "title": f"Tick Math Boundary Bug in {f.get('contract', 'Unknown')} allows invariant violation",
                "severity": severity,
                "contract": str(f.get("contract", "")).strip(),
                "description": str(f.get("description", "")).strip(),
                "vuln_code": str(f.get("vuln_code", "")).strip(),
                "fix_code": str(f.get("fix_code", "")).strip(),
                "exploit_code": str(f.get("exploit_code", "")).strip(),
            })

        return normalized
