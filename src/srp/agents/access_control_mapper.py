"""
AccessControlMapper — D4
Maps the complete access control graph: roles, functions, privilege levels,
and role assignment paths. Identifies missing guards, privilege escalation,
and functions callable by unintended principals.
"""
from __future__ import annotations

import json
from typing import Any

from .base_agent import BaseAgent


class AccessControlMapper(BaseAgent):
    """
    AccessControlMapper builds a complete access control graph for a protocol.

    Inputs (from context):
        - contract_map: dict[str, str]  — {contract_name: source_code}
        - recon_output: dict            — recon output with entry points

    Outputs:
        - access_control_map: dict      — complete function → role mapping
        - privilege_graph: dict         — who can grant/revoke which roles
        - ac_findings: list[dict]       — access control vulnerabilities
        - ac_summary: str               — summary of access control posture
    """

    # Common Solidity access control patterns to detect
    ACCESS_PATTERNS = [
        "onlyOwner",
        "onlyRole(ROLE)",
        "require(msg.sender == owner)",
        "require(hasRole(ROLE, msg.sender))",
        "AccessControl.hasRole",
        "Ownable.transferOwnership",
        "AccessControlEnumerable",
        "OwnableUpgradeable",
        "msg.sender == admin",
        "_checkRole",
        "Timelock.queueTransaction",
        "Pausable.whenNotPaused",
        "modifier onlyAuthorized",
    ]

    # High-risk function patterns (should ALWAYS have access control)
    HIGH_RISK_FUNCTIONS = [
        "withdraw", "withdrawAll", "emergencyWithdraw",
        "setOracle", "setPrice", "updatePrice",
        "upgradeTo", "upgradeToAndCall", "_authorizeUpgrade",
        "setOwner", "transferOwnership", "renounceOwnership",
        "mint", "mintTo", "mintBatch",
        "grantRole", "revokeRole", "addAdmin",
        "setFee", "setProtocolFee", "setTreasury",
        "pause", "unpause", "emergencyPause",
        "selfDestruct", "kill",
        "initialize", "reinitialize",
        "setImplementation", "setAdmin",
    ]

    def __init__(self, model: str = "claude-sonnet-4-6") -> None:
        super().__init__(
            name="AccessControlMapper",
            role="Access control specialist — maps privilege graph, detects escalation paths and missing guards",
            skill_keys=["audit-firm-1-solidity-auditor"],
            model=model,
        )

    async def run(self, context: dict) -> dict:
        self.log_step("access_control_run_started", {"context_keys": list(context.keys())})

        contract_map = context.get("contract_map", {})
        recon_output = context.get("recon_output", {})

        if not isinstance(contract_map, dict):
            contract_map = {}

        # Phase 1: Map all roles and their holders
        role_map = await self._map_roles(contract_map)

        # Phase 2: Map function access control
        function_ac_map = await self._map_function_access_control(contract_map, recon_output)

        # Phase 3: Build privilege graph and find escalation paths
        privilege_analysis = await self._analyze_privilege_graph(
            contract_map, role_map, function_ac_map
        )

        # Phase 4: Identify access control vulnerabilities
        ac_findings = await self._find_ac_vulnerabilities(
            contract_map, function_ac_map, privilege_analysis
        )

        result = {
            "access_control_map": function_ac_map.get("function_map", {}),
            "roles": role_map.get("roles", []),
            "privilege_graph": privilege_analysis.get("privilege_graph", {}),
            "escalation_paths": privilege_analysis.get("escalation_paths", []),
            "ac_findings": ac_findings.get("findings", []),
            "unguarded_high_risk": function_ac_map.get("unguarded_high_risk", []),
            "ac_summary": ac_findings.get("summary", ""),
        }

        self.log_step("access_control_run_completed", {
            "roles_found": len(result["roles"]),
            "findings_count": len(result["ac_findings"]),
            "escalation_paths": len(result["escalation_paths"]),
        })
        return result

    async def _map_roles(self, contract_map: dict) -> dict[str, Any]:
        self.log_step("role_mapping_started", {})

        system_prompt = (
            "You are AccessControlMapper identifying all roles in the protocol. "
            "Find every named role: "
            "1) bytes32 constant roles: `bytes32 public constant ADMIN_ROLE = keccak256('ADMIN')` "
            "2) address state variables: `address public owner`, `address public governance` "
            "3) mapping roles: `mapping(address => bool) public isOperator` "
            "4) struct-based roles: role embedded in user struct "
            "5) enum-based roles "
            "6) Inherited roles from OpenZeppelin (DEFAULT_ADMIN_ROLE, PAUSER_ROLE, MINTER_ROLE) "
            "For each role, identify: "
            "- role name and type (bytes32/address/mapping/bool) "
            "- how it is initially set (constructor, initializer, hardcoded) "
            "- how it can be granted (grantRole, direct assignment, governance vote) "
            "- how it can be revoked "
            "- whether a single EOA currently holds it "
            "Return ONLY valid JSON with keys: "
            "roles (array: name, type, initial_holder, grant_mechanism, revoke_mechanism, "
            "is_single_eoa, is_multisig, is_timelock, risk_level)."
        )

        compact_map = {k: v[:3000] for k, v in contract_map.items()}
        user_payload = {"contracts": list(contract_map.keys()), "CONTRACT_CODE": compact_map}

        result = await self._execute_json_pass("role_mapping", system_prompt, user_payload)
        if not isinstance(result, dict):
            result = {"roles": []}
        self.log_step("role_mapping_completed", {"role_count": len(result.get("roles", []))})
        return result

    async def _map_function_access_control(
        self, contract_map: dict, recon_output: dict
    ) -> dict[str, Any]:
        self.log_step("function_ac_mapping_started", {})

        entry_points = recon_output.get("entry_points", {})

        system_prompt = (
            "You are AccessControlMapper mapping access control for every external/public function. "
            "For each function: "
            "1) List all access control modifiers and require statements that guard it "
            "2) Determine who can call it: ANYONE|OWNER|ROLE_X|ADMIN|GOVERNANCE|etc. "
            "3) Flag as HIGH_RISK if it matches sensitive patterns (withdraw, mint, upgrade, etc.) "
            "4) Check: does it have NO access control? If so, should it? "
            "5) Check: is the access control correctly placed? (not bypassable via delegatecall, etc.) "
            f"High-risk function names to specifically check: {self.HIGH_RISK_FUNCTIONS[:10]} "
            "Return ONLY valid JSON with keys: "
            "function_map (object: contract.function -> "
            "{caller: string, modifiers: list, checks: list, is_high_risk: bool, has_guard: bool}), "
            "unguarded_high_risk (list of contract.function strings with zero access control), "
            "public_no_guard (list of all public functions with ZERO access control)."
        )

        compact_map = {k: v[:2500] for k, v in contract_map.items()}
        user_payload = {
            "contracts": list(contract_map.keys()),
            "entry_points": entry_points,
            "high_risk_patterns": self.HIGH_RISK_FUNCTIONS[:10],
            "CONTRACT_CODE": compact_map,
        }

        result = await self._execute_json_pass("function_ac", system_prompt, user_payload)
        if not isinstance(result, dict):
            result = {"function_map": {}, "unguarded_high_risk": [], "public_no_guard": []}
        self.log_step("function_ac_mapping_completed", {
            "functions_mapped": len(result.get("function_map", {})),
            "unguarded_high_risk": len(result.get("unguarded_high_risk", [])),
        })
        return result

    async def _analyze_privilege_graph(
        self, contract_map: dict, role_map: dict, function_ac_map: dict
    ) -> dict[str, Any]:
        self.log_step("privilege_graph_analysis_started", {})

        roles = role_map.get("roles", [])
        function_map = function_ac_map.get("function_map", {})

        system_prompt = (
            "You are AccessControlMapper building the privilege graph. "
            "The privilege graph shows: WHO can become WHAT role. "
            "Your task: "
            "1) Build a graph: role A can grant role B (if grantRole for B requires role A) "
            "2) Find all paths from the lowest initial privilege to the highest "
            "3) Identify privilege escalation paths: can a low-privilege user become ADMIN? "
            "4) Identify circular authority: can role A grant role A? "
            "5) Identify uncontrolled escalation: can anyone assign a role by meeting trivial conditions? "
            "6) Check: is DEFAULT_ADMIN_ROLE secured? (it can grant all other roles) "
            "Return ONLY valid JSON with keys: "
            "privilege_graph (object: role -> {can_grant: list, can_revoke: list, governed_by: string}), "
            "escalation_paths (list: {from_role, to_role, via_function, steps_count, description}), "
            "circular_authority (list of role names), "
            "uncontrolled_roles (list of roles that can be self-assigned), "
            "admin_security (string: description of how DEFAULT_ADMIN_ROLE is secured)."
        )

        user_payload = {
            "roles": roles,
            "function_map_sample": dict(list(function_map.items())[:20]),  # Limit size
        }

        result = await self._execute_json_pass("privilege_graph", system_prompt, user_payload)
        if not isinstance(result, dict):
            result = {"privilege_graph": {}, "escalation_paths": []}
        self.log_step("privilege_graph_analysis_completed", {
            "escalation_paths": len(result.get("escalation_paths", []))
        })
        return result

    async def _find_ac_vulnerabilities(
        self, contract_map: dict, function_ac_map: dict, privilege_analysis: dict
    ) -> dict[str, Any]:
        self.log_step("ac_vulnerability_search_started", {})

        system_prompt = (
            "You are AccessControlMapper identifying access control vulnerabilities. "
            "Review the function access control map and privilege graph and identify: "
            "1) MISSING GUARD: High-risk function (withdraw, mint, upgrade) with no access control "
            "2) WRONG GUARD: Function guarded by wrong role (e.g., user can call admin function) "
            "3) PRIVILEGE ESCALATION: Path from low-privilege to high-privilege role "
            "4) SINGLE POINT OF FAILURE: Critical function controlled by single EOA (not multisig) "
            "5) CENTRALIZATION RISK: Admin role can do everything with no timelock "
            "6) ROLE NOT REVOCABLE: Critical role that cannot be revoked if compromised "
            "7) INITIALIZE VULNERABILITY: Initializer function callable by anyone "
            "For each finding: severity (high/medium/low), contract, function, "
            "description, and specific remediation. "
            "severity: high = exploit leads to fund loss; medium = privilege abuse without fund loss; "
            "low = centralization/governance risk. "
            "Return ONLY valid JSON with keys: "
            "findings (array: id, title, severity, contract, affected_function, "
            "description, recommendation, confidence), "
            "summary (string: 2-3 sentences on overall access control posture)."
        )

        user_payload = {
            "unguarded_high_risk": function_ac_map.get("unguarded_high_risk", []),
            "escalation_paths": privilege_analysis.get("escalation_paths", []),
            "circular_authority": privilege_analysis.get("circular_authority", []),
            "uncontrolled_roles": privilege_analysis.get("uncontrolled_roles", []),
            "admin_security": privilege_analysis.get("admin_security", ""),
            "public_no_guard_count": len(function_ac_map.get("public_no_guard", [])),
        }

        result = await self._execute_json_pass("ac_vulnerabilities", system_prompt, user_payload)
        if not isinstance(result, dict):
            result = {"findings": [], "summary": "Access control analysis failed."}
        self.log_step("ac_vulnerability_search_completed", {
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
