from __future__ import annotations

import hashlib
import os
from pathlib import Path
from typing import Any
from uuid import uuid4

from chain.erc8004 import ERC8004Policy
from chain.x402 import X402Budget
from core.orchestrator import SRPOrchestrator


class PolicyRejectedError(Exception):
    """Raised when an audit intent is rejected by policy controls."""


def _resolve_contract_paths(
    contract_code: str,
    contract_paths: list | None,
) -> list[str]:
    if contract_paths:
        resolved_paths: list[str] = []
        for raw_path in contract_paths:
            path = Path(str(raw_path)).expanduser()
            if not path.is_absolute():
                path = Path.cwd() / path
            resolved_paths.append(str(path.resolve()))
        return resolved_paths

    if not contract_code.strip():
        raise ValueError("contract_code cannot be empty when contract_paths is not provided")

    runtime_dir = Path.cwd() / ".runtime" / "contracts"
    runtime_dir.mkdir(parents=True, exist_ok=True)
    target_path = runtime_dir / f"{uuid4().hex}.sol"
    target_path.write_text(contract_code, encoding="utf-8")
    return [str(target_path.resolve())]


def _build_policy_intent(
    intent_id: str,
    description: str,
    budget_usd: float,
    contract_code: str,
    resolved_paths: list[str],
) -> dict:
    code_hash = hashlib.sha256(contract_code.encode("utf-8")).hexdigest()
    return {
        "intent_id": intent_id,
        "description": description,
        "budget_usd": float(budget_usd),
        "contract_paths": resolved_paths,
        "contract_code_hash": code_hash,
    }


def _lock_budget(budget: X402Budget, payment_intent: dict) -> dict:
    payment_id = payment_intent["payment_id"]

    if payment_id in budget._payments:
        budget._payments[payment_id]["status"] = "locked"

    payment_intent["status"] = "locked"
    return payment_intent


def _extract_actual_cost_usd(result: dict, fallback_budget: float) -> float:
    trace = result.get("trace", {}) if isinstance(result, dict) else {}
    for key in ("cost_usd", "charged_usd", "estimated_cost_usd"):
        value = trace.get(key) if isinstance(trace, dict) else None
        if value is None:
            continue
        try:
            return max(0.0, float(value))
        except (TypeError, ValueError):
            continue
    return float(fallback_budget)


def _build_partial_trace(
    orchestrator: SRPOrchestrator | None,
    intent_id: str | None,
    resolved_paths: list[str] | None,
    policy_result: dict | None,
    payment_intent: dict | None,
    settlement: dict | None,
) -> dict | None:
    if orchestrator is None:
        return None

    def safe_trace(agent: Any) -> list:
        if agent is None:
            return []
        if not hasattr(agent, "get_trace"):
            return []
        try:
            trace = agent.get_trace()
            return trace if isinstance(trace, list) else []
        except Exception:
            return []

    return {
        "intent_id": intent_id,
        "contract_paths": resolved_paths or [],
        "policy": policy_result,
        "payment_intent": payment_intent,
        "settlement": settlement,
        "agent_traces": {
            "IntentAgent": safe_trace(getattr(orchestrator, "intent_agent", None)),
            "ReconAgent": safe_trace(getattr(orchestrator, "recon_agent", None)),
            "AttackAgent": safe_trace(getattr(orchestrator, "attack_agent", None)),
            "DefenseAgent": safe_trace(getattr(orchestrator, "defense_agent", None)),
            "TraceAgent": safe_trace(getattr(orchestrator, "trace_agent", None)),
            "ReportAgent": safe_trace(getattr(orchestrator, "report_agent", None)),
        },
    }


async def run_audit(
    contract_code: str,
    description: str,
    budget_usd: float,
    contract_paths: list = None,
) -> dict:
    orchestrator: SRPOrchestrator | None = None
    intent_id: str | None = None
    resolved_paths: list[str] | None = None
    policy_result: dict | None = None
    payment_intent: dict | None = None
    settlement: dict | None = None

    try:
        if not description or not str(description).strip():
            raise ValueError("description is required")

        if budget_usd <= 0:
            raise ValueError("budget_usd must be greater than 0")

        resolved_paths = _resolve_contract_paths(contract_code, contract_paths)
        intent_id = str(uuid4())

        policy = ERC8004Policy(
            rpc_url=os.environ.get("RPC_URL", ""),
            contract_address=os.environ.get("ERC8004_POLICY_CONTRACT"),
        )
        budget = X402Budget()
        orchestrator = SRPOrchestrator()

        policy_intent = _build_policy_intent(
            intent_id=intent_id,
            description=description,
            budget_usd=budget_usd,
            contract_code=contract_code,
            resolved_paths=resolved_paths,
        )

        policy_result = policy.check_policy(policy_intent)
        if not policy_result.get("approved", False):
            reason = policy_result.get("reason", "policy rejected")
            raise PolicyRejectedError(str(reason))

        payment_intent = budget.create_payment_intent(
            budget_usd=float(budget_usd),
            intent_id=intent_id,
        )
        payment_intent = _lock_budget(budget, payment_intent)

        result = await orchestrator.run_full_audit(
            raw_input=description,
            contract_paths=resolved_paths,
            budget_usd=float(budget_usd),
        )

        actual_cost_usd = _extract_actual_cost_usd(result, fallback_budget=float(budget_usd))
        settlement = budget.settle(
            payment_id=payment_intent["payment_id"],
            actual_cost_usd=actual_cost_usd,
        )

        if isinstance(result, dict):
            result["policy"] = policy_result
            result["payment_intent"] = payment_intent
            result["payment_settlement"] = settlement
            result["intent_id"] = intent_id

        return result

    except Exception as exc:
        partial_trace = _build_partial_trace(
            orchestrator=orchestrator,
            intent_id=intent_id,
            resolved_paths=resolved_paths,
            policy_result=policy_result,
            payment_intent=payment_intent,
            settlement=settlement,
        )

        return {
            "error": str(exc),
            "trace": partial_trace,
        }


__all__ = ["PolicyRejectedError", "run_audit"]
