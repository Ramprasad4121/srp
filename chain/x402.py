from __future__ import annotations

import os
from uuid import uuid4


class X402Budget:
    def __init__(self) -> None:
        self.wallet_address = os.environ.get("WALLET_ADDRESS")
        self.private_key = os.environ.get("PRIVATE_KEY")
        self.local_mode = not (self.wallet_address and self.private_key)
        self._payments: dict[str, dict] = {}

    def create_payment_intent(self, budget_usd: float, intent_id: str) -> dict:
        payment = {
            "payment_id": str(uuid4()),
            "amount_usd": float(budget_usd),
            "status": "pending",
            "intent_id": intent_id,
        }

        if self.local_mode:
            # In local mode we simulate payment flow with mock state only.
            self._payments[payment["payment_id"]] = payment
            return payment

        # Wallet-connected mode placeholder until on-chain x402 settlement wiring is added.
        self._payments[payment["payment_id"]] = payment
        return payment

    def settle(self, payment_id: str, actual_cost_usd: float) -> dict:
        if self.local_mode:
            # In local mode (no wallet connected), settlement is simulated.
            payment = self._payments.get(payment_id)
            if payment is not None:
                payment["status"] = "settled"
            return {
                "payment_id": payment_id,
                "settled": True,
                "charged": float(actual_cost_usd),
            }

        # Wallet-connected mode placeholder: return canonical settlement shape.
        payment = self._payments.get(payment_id)
        if payment is not None:
            payment["status"] = "settled"

        return {
            "payment_id": payment_id,
            "settled": True,
            "charged": float(actual_cost_usd),
        }
