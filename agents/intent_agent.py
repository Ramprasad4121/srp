from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from .base_agent import BaseAgent


class IntentAgent(BaseAgent):
    """Parses user input, builds execution intent, and extracts protocol invariants.

    This agent performs two tasks:
    1. Parse raw user input into structured audit intent (task, scope, risk, skills, budget).
    2. Run the Protocol Intent Engine to extract invariants, trust boundaries, and assumptions
       from project documentation and NatSpec comments.

    The protocol intent output is injected into downstream agent context as 'protocol_intent'.
    """

    def __init__(self, model: str = "meta/llama-3.1-405b-instruct") -> None:
        super().__init__(
            name="IntentAgent",
            role="Parses user input, builds execution intent, and extracts protocol invariants",
        )

    async def run(self, context: dict) -> dict:
        """Run intent parsing and protocol intent extraction.

        Args:
            context: Pipeline context dict with raw_input, contract_paths, api_key, etc.

        Returns:
            Dict with intent fields plus protocol_intent from the Protocol Intent Engine.
        """
        self.log_step("intent_run_started", {"context_keys": list(context.keys())})

        api_key = context.get("api_key")
        raw_input = context.get("raw_input", "")
        contract_paths = context.get("contract_paths", [])
        self.log_step(
            "intent_inputs_extracted",
            {
                "raw_input_preview": str(raw_input)[:500],
                "contract_paths": contract_paths,
            },
        )

        # ── Step 1: Parse user input into structured intent ──
        system_prompt = (
            "You are an intent parser for a smart contract security workflow. "
            "Extract structured intent fields from user instructions. "
            "Return ONLY valid JSON with keys: "
            "task_description, audit_scope, risk_level, skills_needed, estimated_budget_usd. "
            "risk_level must be one of: low, medium, high, critical. "
            "skills_needed must be a JSON array of strings. "
            "estimated_budget_usd must be a number."
        )
        user_prompt = (
            f"User audit request:\n{raw_input}\n\n"
            f"Contract paths:\n{json.dumps(contract_paths)}"
        )
        messages = [{"role": "user", "content": user_prompt}]
        self.log_step(
            "intent_prompt_built",
            {
                "system_preview": system_prompt[:300],
                "message_count": len(messages),
            },
        )

        llm_output = await self.call_llm(system_extra=system_prompt, messages=messages, api_key=api_key)
        self.log_step("intent_llm_response_received", {"response_preview": llm_output[:1000]})

        try:
            parsed = self._parse_json_output(llm_output)
            self.log_step("intent_llm_response_parsed", {"parsed": parsed})
        except json.JSONDecodeError as exc:
            self.log_step(
                "intent_llm_response_parse_failed",
                {"error": str(exc), "raw_response_preview": llm_output[:1000]},
            )
            parsed = {}

        normalized = self._normalize_intent(parsed, raw_input, contract_paths)
        self.log_step("intent_fields_normalized", {"normalized": normalized})

        intent: dict[str, Any] = {
            "intent_id": str(uuid4()),
            "task": normalized["task_description"],
            "scope": normalized["audit_scope"],
            "risk_level": normalized["risk_level"],
            "skills": normalized["skills_needed"],
            "budget": normalized["estimated_budget_usd"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        # ── Step 2: Run Protocol Intent Engine ──
        protocol_intent = await self._run_protocol_intent_engine(contract_paths, api_key)
        intent["protocol_intent"] = protocol_intent

        self.log_step("intent_built", {"intent_keys": list(intent.keys())})
        return intent

    async def _run_protocol_intent_engine(
        self, contract_paths: list, api_key: str | None
    ) -> dict[str, Any]:
        """Run the Protocol Intent Engine to extract invariants from project docs.

        Derives the project root from contract_paths. If no paths given, uses cwd.

        Args:
            contract_paths: List of contract file/directory paths.
            api_key: Optional API key for LLM calls.

        Returns:
            Protocol intent dict with invariants, trust boundaries, assumptions.
            Returns empty dict on failure.
        """
        import os
        from core.intent_engine import ProtocolIntentEngine

        # Derive project root from first contract path
        project_root = os.getcwd()
        if contract_paths and isinstance(contract_paths, list):
            first_path = str(contract_paths[0])
            if os.path.isfile(first_path):
                # Go up from file to find project root (heuristic: 2 levels up from .sol)
                candidate = os.path.dirname(os.path.dirname(first_path))
                if os.path.isdir(candidate):
                    project_root = candidate
            elif os.path.isdir(first_path):
                project_root = first_path

        self.log_step(
            "protocol_intent_engine_started",
            {"project_root": project_root},
        )

        try:
            engine = ProtocolIntentEngine(project_root)
            result = await engine.extract(call_llm=self.call_llm, api_key=api_key)
            stats = engine.get_collection_stats()

            self.log_step(
                "protocol_intent_engine_completed",
                {
                    "protocol_name": result.get("protocol_name", "unknown"),
                    "protocol_type": result.get("protocol_type", "generic"),
                    "invariant_count": len(result.get("invariants", [])),
                    "trust_boundary_count": len(result.get("trust_boundaries", [])),
                    "assumption_count": len(result.get("assumptions", [])),
                    "collection_stats": stats,
                },
            )
            return result

        except Exception as exc:
            self.log_step(
                "protocol_intent_engine_failed",
                {"error": str(exc)},
            )
            # Return empty but valid structure on failure — pipeline must not crash
            return {
                "protocol_name": "Unknown",
                "protocol_type": "generic",
                "invariants": [],
                "trust_boundaries": [],
                "assumptions": [],
            }

    def _parse_json_output(self, llm_output: str) -> dict:
        """Parse JSON from LLM output with markdown fence stripping."""
        from core.utils import parse_llm_json
        return parse_llm_json(llm_output)

    def _normalize_intent(
        self, parsed: dict, raw_input: str, contract_paths: list
    ) -> dict:
        """Normalize parsed intent fields with fallback defaults.

        Args:
            parsed: Parsed dict from LLM output.
            raw_input: Original user input text.
            contract_paths: Contract file paths.

        Returns:
            Normalized intent dict.
        """
        risk_level = str(parsed.get("risk_level", "medium")).strip().lower()
        if risk_level not in {"low", "medium", "high", "critical"}:
            risk_level = "medium"

        skills = parsed.get("skills_needed", [])
        if not isinstance(skills, list):
            skills = [str(skills)] if skills else []
        skills = [str(skill).strip() for skill in skills if str(skill).strip()]

        budget = parsed.get("estimated_budget_usd", 0)
        try:
            budget = float(budget)
        except (TypeError, ValueError):
            budget = 0.0

        task_description = str(parsed.get("task_description", "")).strip() or str(
            raw_input
        ).strip()
        audit_scope = str(parsed.get("audit_scope", "")).strip() or ", ".join(
            str(path) for path in contract_paths
        )

        return {
            "task_description": task_description,
            "audit_scope": audit_scope,
            "risk_level": risk_level,
            "skills_needed": skills,
            "estimated_budget_usd": budget,
        }
