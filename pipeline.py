"""
SRP Reasoning: Multi-Pass Pipeline

The 5-pass reasoning engine that produces verifiable security analysis.
Each pass is skill-constrained, budget-gated, and traced.

Pass 1: Business Logic Analysis    → understand the protocol
Pass 2: Invariant Discovery        → what must always be true
Pass 3: Attack Hypothesis          → what if invariants break
Pass 4: Exploit Simulation         → can we prove it works
Pass 5: Confidence Assessment      → final structured output
"""

import hashlib
import uuid
from typing import List, Dict, Optional, Tuple
from pathlib import Path

from core.intent import ExecutionIntent
from core.trace import ReasoningTrace, ReasoningPass
from core.agent import OpenClawWorker
from core.budget import X402BudgetEngine, PaymentIntent
from core.policy import EIP8004PolicyClient


# Canonical pass sequence
PASS_SEQUENCE = [
    {
        "skill": "business-logic-analyzer",
        "name": "Business Logic Analysis",
        "goal": "Understand the protocol's intended behavior, roles, flows, and invariants.",
        "questions": [
            "What does this protocol do?",
            "Who are the actors (users, admins, keepers)?",
            "What are the core state transitions?",
            "What economic assumptions are made?",
        ]
    },
    {
        "skill": "invariant-discovery",
        "name": "Invariant Discovery",
        "goal": "Enumerate all invariants that must hold for the protocol to be secure.",
        "questions": [
            "What must always be true about balances?",
            "What access control invariants exist?",
            "What ordering constraints must hold?",
            "What economic invariants protect the protocol?",
        ]
    },
    {
        "skill": "attack-hypothesis",
        "name": "Attack Hypothesis Generation",
        "goal": "For each invariant, generate hypotheses for how it could be violated.",
        "questions": [
            "What happens if this invariant is violated?",
            "What inputs could cause this violation?",
            "What sequence of calls enables the attack?",
            "What is the economic incentive for an attacker?",
        ]
    },
    {
        "skill": "exploit-simulation",
        "name": "Exploit Simulation",
        "goal": "Simulate each attack hypothesis. Confirm or reject with evidence.",
        "questions": [
            "Can this attack be executed in a single transaction?",
            "Does this require flash loans or MEV?",
            "What is the exact exploit call sequence?",
            "What is the maximum extractable value?",
        ]
    },
    {
        "skill": "confidence-assessment",
        "name": "Confidence Assessment",
        "goal": "Rate each finding with confidence. Compile final structured report.",
        "questions": [
            "How confident are we in each finding?",
            "What assumptions were made?",
            "What remains unknown?",
            "What should be manually verified?",
        ]
    },
]


class MultiPassReasoningPipeline:
    """
    Executes multi-pass security reasoning with full protocol enforcement.

    All 5 passes are:
    - Intent-constrained (only allowed skills run)
    - Policy-gated (ERC-8004 approved)
    - Budget-gated (x402 enforced per pass)
    - Fully traced (every call logged)
    """

    def __init__(
        self,
        agent: OpenClawWorker,
        budget_engine: X402BudgetEngine,
        policy_client: EIP8004PolicyClient,
    ):
        self.agent = agent
        self.budget_engine = budget_engine
        self.policy_client = policy_client

    def execute(
        self,
        intent: ExecutionIntent,
        payment: PaymentIntent,
        trace: ReasoningTrace,
        target_path: str,
    ) -> ReasoningTrace:
        """
        Execute the full multi-pass reasoning pipeline.

        This is the core of SRP. Everything before and after this
        is protocol enforcement. This is where reasoning happens.
        """
        session_id = f"srp-{trace.trace_id[:8]}"

        # Set input hash from target files
        input_content = self._read_target(target_path)
        trace.set_input_hash(input_content)

        accumulated_context = self._build_initial_context(intent, target_path, input_content)
        final_output_parts = []

        passes_to_run = PASS_SEQUENCE[:intent.max_reasoning_depth]

        for pass_config in passes_to_run:
            skill = pass_config["skill"]
            pass_number = len(trace.reasoning_passes) + 1

            # Skip if skill not in intent allowlist
            if skill not in intent.allowed_skills:
                print(f"[SRP] ⏭  Skipping {skill}: not in allowed_skills")
                continue

            # Build pass-specific task
            task = self._build_pass_task(pass_config, accumulated_context, intent)

            try:
                output, reasoning_pass = self.agent.execute_pass(
                    session_id=session_id,
                    skill_name=skill,
                    task_description=task,
                    accumulated_context=accumulated_context,
                    trace=trace,
                    budget_engine=self.budget_engine,
                    payment=payment,
                    pass_number=pass_number,
                )

                trace.add_pass(reasoning_pass)
                accumulated_context += f"\n\n[Pass {pass_number} — {skill}]:\n{output[:800]}"
                final_output_parts.append(f"=== Pass {pass_number}: {pass_config['name']} ===\n{output}")

            except RuntimeError as e:
                print(f"[SRP] ⛔ Pipeline stopped: {e}")
                break

        # Compile final output
        final_output = "\n\n".join(final_output_parts)

        # Add x402 payment reference to trace
        trace.x402_payment_tx = payment.lock_tx_hash
        trace.cost_usdc = payment.amount_used_usdc

        # Finalize trace (sets output hash, confidence)
        trace.finalize(final_output)

        return trace

    def _read_target(self, target_path: str) -> str:
        """Read target contracts for input hash computation."""
        target = Path(target_path)
        content_parts = []

        if target.is_file():
            try:
                content_parts.append(target.read_text())
            except Exception:
                content_parts.append(f"[unreadable: {target_path}]")
        elif target.is_dir():
            for ext in ["*.sol", "*.rs", "*.ts", "*.py"]:
                for f in sorted(target.rglob(ext))[:20]:  # cap at 20 files
                    try:
                        content_parts.append(f"// {f}\n{f.read_text()[:2000]}")
                    except Exception:
                        continue
        else:
            content_parts.append(f"[target not found: {target_path}]")

        return "\n\n".join(content_parts) if content_parts else target_path

    def _build_initial_context(
        self,
        intent: ExecutionIntent,
        target_path: str,
        input_content: str
    ) -> str:
        """Build initial context for the first reasoning pass."""
        parts = [
            f"Target: {target_path}",
            f"Task: {intent.task}",
        ]

        if intent.protocol_context:
            parts.append(f"Protocol type: {intent.protocol_context}")
        if intent.chain_context:
            parts.append(f"Chain: {intent.chain_context}")

        # Include first 3000 chars of target code
        if input_content and len(input_content) > 10:
            parts.append(f"\n--- Target Code (first 3000 chars) ---\n{input_content[:3000]}")

        return "\n".join(parts)

    def _build_pass_task(
        self,
        pass_config: dict,
        accumulated_context: str,
        intent: ExecutionIntent
    ) -> str:
        """Build the specific task description for a reasoning pass."""
        questions = "\n".join(f"  - {q}" for q in pass_config["questions"])
        return (
            f"[{pass_config['name'].upper()}]\n"
            f"Goal: {pass_config['goal']}\n\n"
            f"Key questions to answer:\n{questions}\n\n"
            f"Original task: {intent.task}"
        )
