from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import uuid4

from .base_agent import BaseAgent


class IntentAgent(BaseAgent):
    def __init__(self, model: str = "meta/llama-3.1-405b-instruct") -> None:
        super().__init__(
            name="IntentAgent",
            role="Parses user input and builds a structured execution intent",
        )

    async def run(self, context: dict) -> dict:
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

        intent = {
            "intent_id": str(uuid4()),
            "task": normalized["task_description"],
            "scope": normalized["audit_scope"],
            "risk_level": normalized["risk_level"],
            "skills": normalized["skills_needed"],
            "budget": normalized["estimated_budget_usd"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self.log_step("intent_built", {"intent": intent})
        return intent

    def _parse_json_output(self, llm_output: str) -> dict:
        text = llm_output.strip()
        if text.startswith("```"):
            lines = text.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            text = "\n".join(lines).strip()
        return json.loads(text)

    def _normalize_intent(
        self, parsed: dict, raw_input: str, contract_paths: list
    ) -> dict:
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
