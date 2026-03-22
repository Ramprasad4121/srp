"""
UpgradePatternAgent — D3
Analyzes proxy patterns, upgrade safety, storage layout compatibility,
and post-upgrade invariant preservation. Flags unsafe upgrade paths.
"""
from __future__ import annotations

import json
from typing import Any

from .base_agent import BaseAgent


class UpgradePatternAgent(BaseAgent):
    """
    UpgradePatternAgent analyzes smart contract upgrade safety.

    Inputs (from context):
        - contract_map: dict[str, str]  — {contract_name: source_code}
        - recon_output: dict            — recon output with proxy detection

    Outputs:
        - upgrade_findings: list[dict]  — upgrade safety issues found
        - storage_layout: dict          — analyzed storage slot mapping
        - upgrade_summary: str          — summary of upgrade risk
        - is_upgradeable: bool          — whether the protocol uses upgradeable contracts
    """

    # Known proxy patterns and their storage slot positions
    PROXY_PATTERNS = {
        "TransparentUpgradeableProxy": "implementation at slot keccak256('eip1967.proxy.implementation') - 1",
        "UUPS": "implementation at slot keccak256('eip1967.proxy.implementation') - 1, upgrade authorized in implementation",
        "Beacon": "beacon at slot keccak256('eip1967.proxy.beacon') - 1",
        "Diamond (EIP-2535)": "facet addresses in DiamondStorage struct",
        "Eternal Storage": "custom slot layout, often vulnerable to collision",
        "ProxyAdmin": "admin at slot keccak256('eip1967.proxy.admin') - 1",
    }

    # Known storage collision risks
    STORAGE_RISKS = [
        "Implementation has state variables declared before inherited contracts (inheritance ordering collision)",
        "New storage variables inserted in middle of layout (slot shifting)",
        "Mapping or dynamic array slot collision with fixed array",
        "Initialize function not protected against re-initialization",
        "`__gap` variable missing in upgradeable base contracts",
        "Delegatecall to untrusted address in implementation",
        "Self-destruct in implementation (destroys proxy logic)",
        "constructor() used instead of initializer() (state lost after upgrade)",
    ]

    def __init__(self, model: str = "claude-sonnet-4-6") -> None:
        super().__init__(
            name="UpgradePatternAgent",
            role="Upgrade safety specialist — proxy patterns, storage layout, post-upgrade invariants",
            skill_keys=["audit-firm-1-solidity-auditor"],
            model=model,
        )

    async def run(self, context: dict) -> dict:
        self.log_step("upgrade_run_started", {"context_keys": list(context.keys())})

        contract_map = context.get("contract_map", {})
        recon_output = context.get("recon_output", {})

        if not isinstance(contract_map, dict):
            contract_map = {}

        # Phase 1: Detect proxy pattern
        proxy_detection = await self._detect_proxy_pattern(contract_map, recon_output)

        is_upgradeable = proxy_detection.get("is_upgradeable", False)

        if not is_upgradeable:
            self.log_step("upgrade_not_upgradeable", {})
            return {
                "upgrade_findings": [],
                "storage_layout": {},
                "upgrade_summary": "Protocol does not use upgradeable proxy patterns.",
                "is_upgradeable": False,
                "proxy_pattern": None,
            }

        # Phase 2: Analyze storage layout
        storage_analysis = await self._analyze_storage_layout(contract_map, proxy_detection)

        # Phase 3: Check upgrade safety
        upgrade_safety = await self._check_upgrade_safety(
            contract_map, proxy_detection, storage_analysis
        )

        upgrade_findings = upgrade_safety.get("findings", [])

        self.log_step("upgrade_run_completed", {
            "is_upgradeable": is_upgradeable,
            "finding_count": len(upgrade_findings),
        })

        return {
            "upgrade_findings": upgrade_findings,
            "storage_layout": storage_analysis.get("layout", {}),
            "storage_collisions": storage_analysis.get("collisions", []),
            "upgrade_summary": upgrade_safety.get("summary", ""),
            "is_upgradeable": True,
            "proxy_pattern": proxy_detection.get("pattern", "unknown"),
        }

    async def _detect_proxy_pattern(
        self, contract_map: dict, recon_output: dict
    ) -> dict[str, Any]:
        self.log_step("proxy_detection_started", {})

        system_prompt = (
            "You are UpgradePatternAgent detecting proxy and upgrade patterns. "
            "Identify whether the protocol uses upgradeable contracts and which proxy pattern. "
            "Look for: "
            "1) delegatecall in fallback() "
            "2) EIP-1967 storage slots (keccak256 - 1 patterns) "
            "3) ITransparentUpgradeableProxy, UUPS, BeaconProxy, Diamond interfaces "
            "4) Initializable base class usage "
            "5) ProxyAdmin contract "
            "6) _authorizeUpgrade() function (UUPS) "
            f"Known proxy patterns: {list(self.PROXY_PATTERNS.keys())} "
            "Return ONLY valid JSON with keys: "
            "is_upgradeable (boolean), "
            "pattern (string: one of the known patterns or 'custom' or 'none'), "
            "proxy_contract (string: contract name), "
            "implementation_contract (string: contract name), "
            "admin_contract (string: contract name), "
            "upgrade_function (string: function name that performs upgrade), "
            "initializer_functions (list of function names)."
        )

        # Limit code sent to avoid context overflow
        compact_map = {k: v[:2000] for k, v in contract_map.items()}
        user_payload = {"contracts": list(contract_map.keys()), "CONTRACT_CODE": compact_map}

        result = await self._execute_json_pass("proxy_detection", system_prompt, user_payload)
        if not isinstance(result, dict):
            result = {"is_upgradeable": False, "pattern": "none"}
        self.log_step("proxy_detection_completed", {"pattern": result.get("pattern", "none")})
        return result

    async def _analyze_storage_layout(
        self, contract_map: dict, proxy_detection: dict
    ) -> dict[str, Any]:
        self.log_step("storage_layout_analysis_started", {})

        pattern = proxy_detection.get("pattern", "none")
        implementation = proxy_detection.get("implementation_contract", "")

        system_prompt = (
            "You are UpgradePatternAgent analyzing storage layout safety for upgrades. "
            f"Proxy pattern: {pattern} "
            f"Implementation contract: {implementation} "
            "Tasks: "
            "1) Map all state variables in order of declaration to storage slots (slot 0, 1, 2, ...) "
            "2) Identify mappings and dynamic arrays (they use slot + keccak for actual storage) "
            "3) Check: does the contract inherit from other contracts? What order? "
            "   (Inheritance order determines storage slot ordering!) "
            "4) Check for __gap variables in base contracts (required for upgradeable inheritance) "
            "5) Identify any storage slot collisions possible "
            f"Known storage risks: {self.STORAGE_RISKS[:4]} "
            "Return ONLY valid JSON with keys: "
            "layout (object: slot_number -> variable_info), "
            "inheritance_order (list of contract names in storage order), "
            "collisions (list of collision descriptions), "
            "gaps_present (boolean), "
            "gap_sizes (list of {contract, gap_size})."
        )

        impl_code = contract_map.get(implementation, "")
        if not impl_code:
            # Try first contract
            impl_code = list(contract_map.values())[0] if contract_map else ""

        user_payload = {
            "implementation_contract": implementation,
            "proxy_pattern": pattern,
            "implementation_code": impl_code[:5000],
            "all_contracts": list(contract_map.keys()),
        }

        result = await self._execute_json_pass("storage_layout", system_prompt, user_payload)
        if not isinstance(result, dict):
            result = {"layout": {}, "collisions": []}
        self.log_step("storage_layout_analysis_completed", {
            "collision_count": len(result.get("collisions", []))
        })
        return result

    async def _check_upgrade_safety(
        self,
        contract_map: dict,
        proxy_detection: dict,
        storage_analysis: dict,
    ) -> dict[str, Any]:
        self.log_step("upgrade_safety_check_started", {})

        system_prompt = (
            "You are UpgradePatternAgent performing upgrade safety analysis. "
            "Check ALL of the following: "
            "1) REINITIALIZER RISK: Is initialize() protected against re-call? Look for "
            "   missing initializer modifier or Initializable.sol usage. "
            "2) STORAGE COLLISION: Any variables inserted in wrong position for future upgrades? "
            "3) SELF-DESTRUCT RISK: Does implementation use selfdestruct? Fatal for proxy. "
            "4) CONSTRUCTOR RISK: Uses constructor instead of initializer? State is lost. "
            "5) DELEGATECALL RISK: Does implementation delegatecall to user-supplied address? "
            "6) AUTHORIZATION: Is _authorizeUpgrade() or upgrade() properly access-controlled? "
            "7) GAP RISK: Missing __gap in base upgradeable contracts? "
            "8) FUNCTION CLASHING: Do proxy admin functions clash with implementation functions? "
            "For each issue found, provide severity (high/medium/low), "
            "affected contract, description, and recommended fix. "
            "Return ONLY valid JSON with keys: "
            "findings (array: id, title, severity, contract, affected_function, "
            "description, recommendation, confidence), "
            "summary (string: 2-3 sentences on upgrade risk level)."
        )

        user_payload = {
            "proxy_pattern": proxy_detection.get("pattern"),
            "proxy_contract": proxy_detection.get("proxy_contract"),
            "implementation_contract": proxy_detection.get("implementation_contract"),
            "upgrade_function": proxy_detection.get("upgrade_function"),
            "initializer_functions": proxy_detection.get("initializer_functions", []),
            "storage_collisions": storage_analysis.get("collisions", []),
            "gaps_present": storage_analysis.get("gaps_present", False),
            "known_risks": self.STORAGE_RISKS,
        }

        result = await self._execute_json_pass("upgrade_safety", system_prompt, user_payload)
        if not isinstance(result, dict):
            result = {"findings": [], "summary": "Upgrade safety check failed."}
        self.log_step("upgrade_safety_check_completed", {
            "finding_count": len(result.get("findings", []))
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
