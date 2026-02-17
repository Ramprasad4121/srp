"""
SRP Core: x402 Budget Engine

x402 V2 - The HTTP-native payment protocol by Coinbase.
Live since May 2025. 100M+ payments processed. $24M+ settled.

Every SRP execution requires:
1. Payment intent created BEFORE execution
2. Budget locked BEFORE agent starts
3. Settlement AFTER output delivered

No payment → no execution. This is enforced at the protocol level.

x402 Flow:
  Client → HTTP request → Server → 402 Payment Required
  Client → PAYMENT-SIGNATURE header → Server → Facilitator → Verify
  Facilitator → Settle on-chain → Server → 200 OK + PAYMENT-RESPONSE
"""

import json
import hashlib
import time
import os
from dataclasses import dataclass, field
from typing import Optional, Dict, Any
from pathlib import Path
from datetime import datetime, timezone


# x402 V2 Facilitator endpoints
X402_FACILITATOR_MAINNET = "https://api.cdp.coinbase.com/platform/v1/x402"
X402_FACILITATOR_TESTNET = "https://api.cdp.coinbase.com/platform/v1/x402/testnet"

# Supported networks (CAIP-2 identifiers per x402 V2 spec)
NETWORKS = {
    "base": "eip155:8453",
    "base-sepolia": "eip155:84532",
    "solana": "solana:mainnet",
    "ethereum": "eip155:1",
}

# USDC contract addresses
USDC_ADDRESSES = {
    "eip155:8453": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",    # Base USDC
    "eip155:84532": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",   # Base Sepolia USDC
}

# Compute unit pricing (USDC per 1000 units)
COMPUTE_UNIT_PRICE_USDC = 0.001


@dataclass
class PaymentIntent:
    """
    x402 payment intent created before execution.
    Locked on-chain before agent starts reasoning.
    """
    intent_hash: str              # References ExecutionIntent hash
    amount_usdc: float
    recipient: str                # Executor address
    network: str = "eip155:84532"  # Base Sepolia by default
    token: str = "USDC"
    status: str = "pending"       # pending → locked → settled → refunded

    payment_id: str = ""
    created_at: str = ""
    locked_at: Optional[str] = None
    settled_at: Optional[str] = None

    amount_used_usdc: float = 0.0
    amount_refunded_usdc: float = 0.0

    # On-chain references
    lock_tx_hash: Optional[str] = None
    settle_tx_hash: Optional[str] = None

    # x402 protocol fields
    x402_payment_payload: Optional[dict] = None
    x402_payment_response: Optional[dict] = None

    def __post_init__(self):
        if not self.payment_id:
            self.payment_id = "srp-" + hashlib.sha256(
                f"{self.intent_hash}{time.time()}".encode()
            ).hexdigest()[:16]
        if not self.created_at:
            self.created_at = datetime.now(timezone.utc).isoformat()

    def is_locked(self) -> bool:
        return self.status == "locked"

    def to_dict(self) -> dict:
        return {
            "payment_id": self.payment_id,
            "intent_hash": self.intent_hash,
            "amount_usdc": self.amount_usdc,
            "recipient": self.recipient,
            "network": self.network,
            "token": self.token,
            "status": self.status,
            "created_at": self.created_at,
            "locked_at": self.locked_at,
            "settled_at": self.settled_at,
            "amount_used_usdc": self.amount_used_usdc,
            "amount_refunded_usdc": self.amount_refunded_usdc,
        }


class X402BudgetEngine:
    """
    x402 V2 budget engine for SRP executions.

    Implements the HTTP 402 payment protocol for pay-per-compute reasoning.
    Budget enforcement happens DURING execution, not just at the start.

    Modes:
    - local: Simulate payment (dev/testing)
    - testnet: Real x402 on Base Sepolia
    - mainnet: Real x402 on Base mainnet
    """

    def __init__(
        self,
        mode: str = "local",               # "local" | "testnet" | "mainnet"
        wallet_key: str = "",
        wallet_address: str = "",
        facilitator_url: str = "",
    ):
        self.mode = mode
        self.wallet_key = wallet_key
        self.wallet_address = wallet_address
        self.facilitator_url = facilitator_url or (
            X402_FACILITATOR_TESTNET if mode == "testnet" else X402_FACILITATOR_MAINNET
        )
        self._active_budgets: Dict[str, PaymentIntent] = {}

    def create_payment_intent(
        self,
        intent_hash: str,
        amount_usdc: float,
        executor_address: str = "srp-local",
    ) -> PaymentIntent:
        """
        Step 1: Create x402 payment intent before execution.
        This references the ERC-8004 approved ExecutionIntent.
        """
        network = "eip155:84532" if self.mode == "testnet" else "eip155:8453"

        payment = PaymentIntent(
            intent_hash=intent_hash,
            amount_usdc=amount_usdc,
            recipient=executor_address,
            network=network,
        )

        print(f"[x402] 📋 Payment intent created")
        print(f"[x402]    Payment ID: {payment.payment_id}")
        print(f"[x402]    Amount: ${amount_usdc:.4f} USDC")
        print(f"[x402]    Network: {network}")
        print(f"[x402]    Mode: {self.mode}")

        return payment

    def lock_budget(self, payment: PaymentIntent) -> bool:
        """
        Step 2: Lock budget BEFORE execution starts.

        In x402 flow:
        - Client sends PAYMENT-SIGNATURE header
        - Facilitator verifies + locks on-chain
        - Server confirms lock before proceeding

        No lock → no execution.
        """
        if self.mode == "local":
            return self._lock_local(payment)
        elif self.mode in ("testnet", "mainnet"):
            return self._lock_x402(payment)
        return False

    def _lock_local(self, payment: PaymentIntent) -> bool:
        """Simulate x402 lock for local development."""
        payment.status = "locked"
        payment.locked_at = datetime.now(timezone.utc).isoformat()
        payment.lock_tx_hash = "local-" + payment.payment_id

        self._active_budgets[payment.payment_id] = payment

        # Save to local ledger
        self._save_to_ledger(payment)

        print(f"[x402] ✅ Budget locked (local mode)")
        print(f"[x402]    ${payment.amount_usdc:.4f} USDC reserved")
        return True

    def _lock_x402(self, payment: PaymentIntent) -> bool:
        """
        Real x402 V2 payment lock.

        Flow per x402 V2 spec:
        1. GET resource → 402 Payment Required + PAYMENT-REQUIRED header
        2. Parse PaymentRequirements from header
        3. Construct PaymentPayload with EIP-712 signature
        4. POST with PAYMENT-SIGNATURE header
        5. Facilitator verifies + settles
        6. Resource returned with PAYMENT-RESPONSE header
        """
        try:
            import requests
            # TODO: Implement full x402 V2 flow
            # Requires: wallet with USDC, EIP-712 signing, facilitator call
            raise NotImplementedError(
                f"x402 {self.mode} mode requires funded wallet + CDP API key.\n"
                f"Set: SRP_WALLET_KEY, SRP_WALLET_ADDRESS env vars.\n"
                f"Docs: https://docs.cdp.coinbase.com/x402"
            )
        except ImportError:
            print("[x402] ❌ requests not installed")
            return False

    def check_budget_available(self, payment: PaymentIntent) -> bool:
        """
        Check if budget is still available during execution.
        Called before each reasoning pass to enforce spend limits.
        """
        return payment.is_locked() and payment.amount_used_usdc < payment.amount_usdc

    def charge_compute(
        self,
        payment: PaymentIntent,
        compute_units: int
    ) -> bool:
        """
        Charge for compute units used during a reasoning pass.
        Called after each pass to track spend against budget.
        """
        cost = compute_units * COMPUTE_UNIT_PRICE_USDC / 1000
        if payment.amount_used_usdc + cost > payment.amount_usdc:
            print(f"[x402] ⚠️  Budget would be exceeded. Stopping execution.")
            return False

        payment.amount_used_usdc += cost
        remaining = payment.amount_usdc - payment.amount_used_usdc
        print(f"[x402] 💳 Charged {compute_units} units (${cost:.4f} USDC). Remaining: ${remaining:.4f}")
        return True

    def settle_budget(
        self,
        payment: PaymentIntent,
        final_compute_units: int = 0,
    ) -> bool:
        """
        Step 3: Settle budget AFTER execution completes.
        Pays executor for compute used. Refunds remainder to user.
        """
        if not payment.is_locked():
            print("[x402] ❌ Cannot settle unlocked payment")
            return False

        amount_to_pay = payment.amount_used_usdc
        refund = payment.amount_usdc - amount_to_pay

        payment.status = "settled"
        payment.settled_at = datetime.now(timezone.utc).isoformat()
        payment.amount_refunded_usdc = refund

        self._save_to_ledger(payment)

        print(f"[x402] ✅ Budget settled")
        print(f"[x402]    Paid to executor:  ${amount_to_pay:.4f} USDC")
        print(f"[x402]    Refunded to user:  ${refund:.4f} USDC")
        if payment.settle_tx_hash:
            print(f"[x402]    TX: {payment.settle_tx_hash}")
        return True

    def _save_to_ledger(self, payment: PaymentIntent):
        """Save payment record to local ledger."""
        ledger_path = Path("srp-traces") / "payments.json"
        ledger_path.parent.mkdir(exist_ok=True)

        ledger = []
        if ledger_path.exists():
            with open(ledger_path) as f:
                ledger = json.load(f)

        # Update or append
        found = False
        for i, p in enumerate(ledger):
            if p.get("payment_id") == payment.payment_id:
                ledger[i] = payment.to_dict()
                found = True
                break
        if not found:
            ledger.append(payment.to_dict())

        with open(ledger_path, "w") as f:
            json.dump(ledger, f, indent=2)

    def show_budget_status(self) -> str:
        """Display current budget status for CLI."""
        lines = [f"[x402] Budget Engine Status", f"[x402] Mode: {self.mode}"]
        for pid, p in self._active_budgets.items():
            lines.append(
                f"[x402] {pid}: ${p.amount_used_usdc:.4f}/${p.amount_usdc:.4f} USDC ({p.status})"
            )
        return "\n".join(lines)
