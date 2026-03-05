from __future__ import annotations

import hashlib
import json
import os
from typing import Any

from web3 import Web3


_POLICY_ABI = [
    {
        "inputs": [{"internalType": "bytes32", "name": "intentHash", "type": "bytes32"}],
        "name": "isIntentApproved",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function",
    }
]


class ERC8004Policy:
    def __init__(self, rpc_url: str, contract_address: str = None) -> None:
        # Always source RPC_URL from environment first.
        self.rpc_url = os.environ.get("RPC_URL", rpc_url)
        self.contract_address = contract_address
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url)) if self.rpc_url else None

    def check_policy(self, intent: dict) -> dict:
        if not self.contract_address:
            return {
                "approved": True,
                "reason": "local_mode",
                "policy_id": "local-0",
            }

        if not self.w3:
            return {
                "approved": False,
                "reason": "missing_rpc_url",
                "policy_id": str(self.contract_address),
            }

        if not self.w3.is_connected():
            return {
                "approved": False,
                "reason": "rpc_unreachable",
                "policy_id": str(self.contract_address),
            }

        if not Web3.is_address(self.contract_address):
            return {
                "approved": False,
                "reason": "invalid_contract_address",
                "policy_id": str(self.contract_address),
            }

        try:
            checksum_address = Web3.to_checksum_address(self.contract_address)
            contract = self.w3.eth.contract(address=checksum_address, abi=_POLICY_ABI)

            intent_hash = self._intent_hash(intent)
            approved = bool(contract.functions.isIntentApproved(intent_hash).call())

            chain_id = self.w3.eth.chain_id
            return {
                "approved": approved,
                "reason": "approved_onchain" if approved else "rejected_onchain",
                "policy_id": f"{chain_id}:{checksum_address}",
            }
        except Exception as exc:
            return {
                "approved": False,
                "reason": f"policy_check_error:{exc}",
                "policy_id": str(self.contract_address),
            }

    def _intent_hash(self, intent: dict[str, Any]) -> bytes:
        payload = json.dumps(intent, sort_keys=True, separators=(",", ":"), default=str)
        return hashlib.sha256(payload.encode("utf-8")).digest()
