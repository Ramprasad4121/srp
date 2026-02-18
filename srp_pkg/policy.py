"""
SRP Core: ERC-8004 Policy Client

ERC-8004 (Trustless Agents) - Live on Ethereum mainnet since Jan 29, 2026.
Every SRP execution intent MUST be approved by on-chain policy.
No approval → no execution. This is not negotiable.

ERC-8004 provides:
- Identity Registry (ERC-721 based agent identities)
- Reputation Registry (on-chain feedback signals)
- Validation Registry (cryptographic task verification)
"""

import json
import os
from dataclasses import dataclass
from typing import List, Optional, Tuple
from pathlib import Path


# ERC-8004 mainnet deployment (Jan 29, 2026)
ERC8004_IDENTITY_REGISTRY_MAINNET = "0x..."   # TODO: fill after mainnet deploy
ERC8004_IDENTITY_REGISTRY_SEPOLIA = "0x..."   # TODO: fill with testnet address

# SRP Policy contract addresses (deploy from contracts/SRPPolicy.sol)
SRP_POLICY_MAINNET = ""
SRP_POLICY_SEPOLIA = ""


@dataclass
class AgentRegistration:
    """ERC-8004 agent registration file (the agent's on-chain passport)."""
    agent_id: int
    registry: str
    name: str = "SRP Security Reasoning Agent"
    description: str = "Verifiable security reasoning protocol agent"
    version: str = "srp-0.1"
    endpoints: List[dict] = None
    supported_trust: List[str] = None

    def __post_init__(self):
        if self.endpoints is None:
            self.endpoints = [
                {"name": "CLI", "endpoint": "local://srp"},
                {"name": "API", "endpoint": "http://localhost:8404/srp"}
            ]
        if self.supported_trust is None:
            self.supported_trust = ["reputation", "crypto-economic"]

    def to_registration_file(self) -> dict:
        """ERC-8004 compliant registration file format."""
        return {
            "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
            "name": self.name,
            "description": self.description,
            "version": self.version,
            "endpoints": self.endpoints,
            "supportedTrust": self.supported_trust,
            "capabilities": [
                "security-reasoning",
                "evm-audit",
                "solana-audit",
                "exploit-simulation",
                "invariant-discovery"
            ]
        }


@dataclass
class PolicyConfig:
    """Local policy configuration (mirrors on-chain policy contract state)."""
    allowed_skills: List[str]
    max_reasoning_depth: int
    max_budget_usdc: float
    exploit_sim_allowed: bool
    human_in_loop_required: bool = False
    active: bool = True

    @classmethod
    def default(cls) -> "PolicyConfig":
        return cls(
            allowed_skills=[
                "business-logic-analyzer",
                "invariant-discovery",
                "evm-foundry-audit",
                "solana-anchor-audit",
                "solana-vulnerability-scanner",
                "attack-hypothesis",
                "exploit-simulation",
                "web3-security-learning",
                "token-integration-analyzer",
                "audit-prep-assistant",
            ],
            max_reasoning_depth=5,
            max_budget_usdc=100.0,
            exploit_sim_allowed=True,
            human_in_loop_required=False,
        )

    def save(self, path: str = "srp.policy.json"):
        with open(path, "w") as f:
            json.dump({
                "allowed_skills": self.allowed_skills,
                "max_reasoning_depth": self.max_reasoning_depth,
                "max_budget_usdc": self.max_budget_usdc,
                "exploit_sim_allowed": self.exploit_sim_allowed,
                "human_in_loop_required": self.human_in_loop_required,
                "active": self.active,
            }, f, indent=2)

    @classmethod
    def load(cls, path: str = "srp.policy.json") -> "PolicyConfig":
        with open(path) as f:
            data = json.load(f)
        return cls(**data)


class ERC8004PolicyClient:
    """
    Client for ERC-8004 policy enforcement.

    In local mode: enforces policy from srp.policy.json
    In chain mode: calls on-chain SRPPolicy.sol contract

    Every intent MUST be approved before execution begins.
    """

    def __init__(
        self,
        agent_id: int = 0,
        rpc_url: str = "",
        policy_contract: str = "",
        local_mode: bool = True,
    ):
        self.agent_id = agent_id
        self.rpc_url = rpc_url
        self.policy_contract = policy_contract
        self.local_mode = local_mode
        self._policy: Optional[PolicyConfig] = None

    def load_policy(self, path: str = "srp.policy.json") -> PolicyConfig:
        if Path(path).exists():
            self._policy = PolicyConfig.load(path)
        else:
            self._policy = PolicyConfig.default()
        return self._policy

    def approve_intent(
        self,
        intent_hash: str,
        skills: List[str],
        depth: int,
        budget_usdc: float,
        exploit_sim: bool = False,
    ) -> Tuple[bool, str]:
        """
        Submit execution intent for ERC-8004 policy approval.

        Returns (approved: bool, reason: str)

        In local mode: checks against srp.policy.json
        In chain mode: calls SRPPolicy.sol approveIntent()
        """
        if self.local_mode:
            return self._approve_local(intent_hash, skills, depth, budget_usdc, exploit_sim)
        else:
            return self._approve_onchain(intent_hash, skills, depth, budget_usdc, exploit_sim)

    def _approve_local(
        self,
        intent_hash: str,
        skills: List[str],
        depth: int,
        budget_usdc: float,
        exploit_sim: bool,
    ) -> Tuple[bool, str]:
        """Local policy enforcement (dev/testnet mode)."""
        policy = self._policy or self.load_policy()

        if not policy.active:
            return False, "Policy is inactive"

        if budget_usdc > policy.max_budget_usdc:
            return False, f"Budget ${budget_usdc} exceeds policy limit ${policy.max_budget_usdc}"

        if depth > policy.max_reasoning_depth:
            return False, f"Depth {depth} exceeds policy limit {policy.max_reasoning_depth}"

        if exploit_sim and not policy.exploit_sim_allowed:
            return False, "Exploit simulation not permitted by policy"

        for skill in skills:
            if skill not in policy.allowed_skills:
                return False, f"Skill '{skill}' not in policy allowlist"

        print(f"[ERC-8004] ✅ Intent approved (local policy)")
        print(f"[ERC-8004]    Hash: {intent_hash[:16]}...")
        print(f"[ERC-8004]    Agent ID: {self.agent_id}")
        return True, "approved"

    def _approve_onchain(
        self,
        intent_hash: str,
        skills: List[str],
        depth: int,
        budget_usdc: float,
        exploit_sim: bool,
    ) -> Tuple[bool, str]:
        """
        On-chain policy enforcement via SRPPolicy.sol.

        TODO: Implement web3.py call to SRPPolicy.approveIntent()
        Requires: web3.py, funded wallet, deployed SRPPolicy.sol
        """
        try:
            from web3 import Web3
            w3 = Web3(Web3.HTTPProvider(self.rpc_url))
            # TODO: Load ABI and call contract
            # contract = w3.eth.contract(address=self.policy_contract, abi=SRP_POLICY_ABI)
            # tx = contract.functions.approveIntent(...).transact()
            raise NotImplementedError("On-chain mode requires web3.py + deployed contract")
        except ImportError:
            return False, "web3.py not installed. Run: pip install web3"

    def record_execution(self, intent_hash: str, output_hash: str) -> bool:
        """Record completed execution on-chain (or locally)."""
        if self.local_mode:
            log_path = Path("srp-traces") / "executions.json"
            log_path.parent.mkdir(exist_ok=True)
            executions = []
            if log_path.exists():
                with open(log_path) as f:
                    executions = json.load(f)
            executions.append({
                "intent_hash": intent_hash,
                "output_hash": output_hash,
            })
            with open(log_path, "w") as f:
                json.dump(executions, f, indent=2)
            print(f"[ERC-8004] ✅ Execution recorded")
            return True
        return False

    def get_agent_reputation(self) -> dict:
        """Fetch agent reputation from ERC-8004 Reputation Registry."""
        return {
            "agent_id": self.agent_id,
            "total_executions": 0,
            "avg_confidence": 0.0,
            "note": "Reputation registry integration pending"
        }
