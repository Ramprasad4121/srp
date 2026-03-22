"""
EconomicAttackAgent — D2
Specializes in economic attack vectors: flash loans, sandwich attacks,
oracle manipulation, MEV extraction, and token economic exploits.
"""
from __future__ import annotations

import json
from typing import Any

from .base_agent import BaseAgent


class EconomicAttackAgent(BaseAgent):
    """
    EconomicAttackAgent focuses on economic and incentive-level attacks.

    Inputs (from context):
        - contract_map: dict[str, str]  — {contract_name: source_code}
        - recon_output: dict            — recon agent output
        - domain: str                   — protocol domain (amm, lending, staking, etc.)
        - vulnerabilities: list         — attack agent findings (for economic impact assessment)

    Outputs:
        - economic_attacks: list[dict]  — economic attack scenarios with impact estimates
        - economic_summary: str         — summary of economic risk surface
        - max_extractable_value: float  — estimated maximum extractable value in USD
    """

    FLASH_LOAN_PROVIDERS = [
        "Aave V3 (up to $1B in USDC/WETH/WBTC)",
        "Uniswap V3 (up to $500M in ETH pairs)",
        "dYdX (up to $100M in USDC)",
        "Balancer (up to $200M in multiple tokens)",
        "Euler (up to $200M — before exploit)",
        "MakerDAO DSS Flash (up to $500M DAI)",
    ]

    ECONOMIC_ATTACK_CLASSES = [
        "Flash loan collateral inflation",
        "Flash loan reserve manipulation",
        "Oracle TWAP manipulation via large swap",
        "Sandwich attack on slippage-sensitive operations",
        "JIT liquidity extraction",
        "MEV-boosted liquidation griefing",
        "Epoch boundary reward farming",
        "Governance vote buying via flash loan",
        "Price impact cascade (cascading liquidations)",
        "Fee vault front-running",
        "Donation attack on ERC4626 vault",
        "Interest rate manipulation via utilization",
        "Funding rate manipulation on perpetuals",
    ]

    def __init__(self, model: str = "claude-sonnet-4-6") -> None:
        super().__init__(
            name="EconomicAttackAgent",
            role="Economic attack specialist — flash loans, MEV, oracle manipulation, incentive exploits",
            skill_keys=["audit-firm-1-solidity-auditor"],
            model=model,
        )

    async def run(self, context: dict) -> dict:
        self.log_step("economic_attack_run_started", {"context_keys": list(context.keys())})

        contract_map = context.get("contract_map", {})
        recon_output = context.get("recon_output", {})
        domain = context.get("domain", "unknown")
        prior_vulnerabilities = context.get("vulnerabilities", [])

        if not isinstance(contract_map, dict):
            contract_map = {}

        # Phase 1: Identify economic attack surface
        economic_surface = await self._assess_economic_surface(
            contract_map, recon_output, domain
        )

        # Phase 2: Generate economic attack scenarios
        attack_scenarios = await self._generate_economic_attacks(
            contract_map, economic_surface, domain
        )

        # Phase 3: Estimate economic impact
        economic_analysis = await self._estimate_impact(
            contract_map, attack_scenarios, prior_vulnerabilities
        )

        result = {
            "economic_attacks": economic_analysis.get("attacks", []),
            "economic_summary": economic_analysis.get("summary", ""),
            "max_extractable_value": economic_analysis.get("max_extractable_value_usd", 0.0),
            "flash_loan_required": economic_analysis.get("flash_loan_required", False),
            "risk_rating": economic_analysis.get("risk_rating", "medium"),
        }

        self.log_step("economic_attack_run_completed", {
            "attack_count": len(result["economic_attacks"]),
            "max_ev": result["max_extractable_value"],
        })
        return result

    async def _assess_economic_surface(
        self, contract_map: dict, recon_output: dict, domain: str
    ) -> dict[str, Any]:
        self.log_step("economic_surface_assessment_started", {"domain": domain})

        system_prompt = (
            "You are EconomicAttackAgent assessing economic attack surface. "
            "Identify all economic pressure points: "
            "1) Functions that read or depend on external price oracles "
            "2) Functions that can be called with flash-loaned capital "
            "3) Functions whose outcomes depend on token balances or reserves "
            "4) Functions that move large amounts of value (liquidation, harvest, swap) "
            "5) Time-dependent functions (epoch boundaries, funding rate snapshots, TWAP windows) "
            "6) Functions with significant reward or fee accumulation "
            f"Protocol domain: {domain} "
            f"Known flash loan providers available to attackers: {', '.join(self.FLASH_LOAN_PROVIDERS[:3])} "
            "Return ONLY valid JSON with keys: "
            "oracle_dependent_functions (list of function names), "
            "flash_loan_amplifiable (list of function names with reason), "
            "time_sensitive_operations (list), "
            "value_accumulation_points (list of contract.function with estimated TVL), "
            "economic_invariants (list: invariants whose violation has economic impact)."
        )

        contracts = list(contract_map.keys())
        entry_points = recon_output.get("entry_points", {})

        user_payload = {
            "contracts": contracts,
            "domain": domain,
            "entry_points": entry_points,
            "CONTRACT_CODE": {k: v[:3000] for k, v in contract_map.items()},  # Truncate per contract
        }

        result = await self._execute_json_pass("economic_surface", system_prompt, user_payload)
        if not isinstance(result, dict):
            result = {}
        self.log_step("economic_surface_assessment_completed", {})
        return result

    async def _generate_economic_attacks(
        self, contract_map: dict, economic_surface: dict, domain: str
    ) -> dict[str, Any]:
        self.log_step("economic_attacks_generation_started", {})

        system_prompt = (
            "You are EconomicAttackAgent generating economic attack scenarios. "
            "For each economic pressure point identified, generate a concrete attack scenario. "
            "Each attack must specify: "
            "1) Required capital (flash loan amount or owned capital) "
            "2) Step-by-step attack sequence "
            "3) Profit calculation in USD "
            "4) Probability of success (0.0-1.0) "
            "5) Required conditions (oracle lag, low liquidity, etc.) "
            f"Attack classes to consider: {', '.join(self.ECONOMIC_ATTACK_CLASSES[:6])} "
            "IMPORTANT: Only output REALISTIC attacks. If a sandwich attack requires "
            "$100M capital for $10 profit, it is not realistic. "
            "severity: high = profit > $100K or systemic risk; "
            "medium = profit $10K-$100K; low = profit < $10K. "
            "Return ONLY valid JSON with keys: "
            "attacks (array: title, severity, attack_class, capital_required_usd, "
            "attack_steps, estimated_profit_usd, success_probability, conditions, exploit_code)."
        )

        user_payload = {
            "domain": domain,
            "contracts": list(contract_map.keys()),
            "oracle_dependent_functions": economic_surface.get("oracle_dependent_functions", []),
            "flash_loan_amplifiable": economic_surface.get("flash_loan_amplifiable", []),
            "time_sensitive_operations": economic_surface.get("time_sensitive_operations", []),
            "value_accumulation_points": economic_surface.get("value_accumulation_points", []),
            "economic_invariants": economic_surface.get("economic_invariants", []),
        }

        result = await self._execute_json_pass("economic_attacks", system_prompt, user_payload)
        if not isinstance(result, dict):
            result = {}
        self.log_step("economic_attacks_generation_completed", {
            "attack_count": len(result.get("attacks", []))
        })
        return result

    async def _estimate_impact(
        self, contract_map: dict, attack_scenarios: dict, prior_vulnerabilities: list
    ) -> dict[str, Any]:
        self.log_step("economic_impact_estimation_started", {})

        attacks = attack_scenarios.get("attacks", [])
        if not attacks:
            return {
                "attacks": [],
                "summary": "No economically viable attack scenarios identified.",
                "max_extractable_value_usd": 0.0,
                "flash_loan_required": False,
                "risk_rating": "low",
            }

        system_prompt = (
            "You are EconomicAttackAgent estimating total economic impact. "
            "Review the attack scenarios and: "
            "1) Calculate max_extractable_value_usd = maximum single-transaction profit "
            "2) Set flash_loan_required = True if any attack requires flash loans "
            "3) Set risk_rating = 'high' if any attack > $100K profit, 'medium' if > $10K, 'low' otherwise "
            "4) Write a 2-3 sentence summary of the economic risk surface "
            "5) Combine with prior vulnerability findings to assess amplified risk "
            "Return ONLY valid JSON with keys: "
            "attacks (same list, reordered by estimated_profit_usd descending), "
            "summary (string), "
            "max_extractable_value_usd (number), "
            "flash_loan_required (boolean), "
            "risk_rating (string: high|medium|low)."
        )

        user_payload = {
            "attacks": attacks,
            "prior_vulnerability_count": len(prior_vulnerabilities),
            "prior_high_severity_count": sum(
                1 for v in prior_vulnerabilities
                if isinstance(v, dict) and v.get("severity") == "high"
            ),
        }

        result = await self._execute_json_pass("economic_impact", system_prompt, user_payload)
        if not isinstance(result, dict):
            result = {
                "attacks": attacks,
                "summary": "Economic impact estimation failed.",
                "max_extractable_value_usd": 0.0,
                "flash_loan_required": any(
                    "flash" in str(a.get("attack_class", "")).lower()
                    for a in attacks
                ),
                "risk_rating": "medium",
            }
        self.log_step("economic_impact_estimation_completed", {
            "max_ev": result.get("max_extractable_value_usd", 0.0),
            "risk_rating": result.get("risk_rating", "unknown"),
        })
        return result

    async def _execute_json_pass(
        self,
        pass_name: str,
        system_prompt: str,
        payload: dict[str, Any],
        timeout: float | None = None,
    ) -> dict[str, Any]:
        user_prompt = json.dumps(payload, indent=2, default=str)
        if len(user_prompt) > 20000:
            user_prompt = user_prompt[:20000] + "\n...[TRUNCATED]..."

        messages = [{"role": "user", "content": user_prompt}]
        llm_output = await self.call_llm(
            system_extra=system_prompt, messages=messages, timeout=timeout
        )

        try:
            return self.parse_json(llm_output)
        except Exception as exc:
            self.log_step(f"{pass_name}_parse_failed", {"error": str(exc)})
            return {}
