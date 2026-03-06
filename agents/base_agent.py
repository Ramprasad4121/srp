from __future__ import annotations

import os
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any

from anthropic import AsyncAnthropic


class BaseAgent(ABC):
    def __init__(self, name: str, role: str, skill_keys: list | None = None, model: str | None = None) -> None:
        self.name = name
        self.role = role
        self.model = model or os.environ.get("SRP_MODEL", "meta/llama-3.1-405b-instruct")
        self.trace_log: list[dict[str, Any]] = []

        from core.skill_loader import SkillLoader
        sl = SkillLoader()

        # Load soul first — identity before skills
        self.soul_content = sl.load_soul(name)

        # Load skills — methodology after identity
        self.skill_content = sl.load_many(skill_keys) if skill_keys else ""

        if self.soul_content:
            print(f"  \u2705 {name}: soul loaded ({len(self.soul_content)} chars)")

        self.progress = None

    def set_progress(self, progress: "AuditProgress") -> None:
        """Inject audit progress tracker into agent."""
        self.progress = progress

    def get_handoff_context(self) -> str:
        """Get notes left by previous agents — read at start of every run."""
        if not getattr(self, "progress", None):
            return ""
        notes = self.progress.get_handoff_notes_for(self.name)
        if not notes:
            return ""
        notes_text = "\n".join([f"- {n['from']}: {n['note']}" for n in notes])
        return f"\n\n## Handoff Notes From Previous Agents\n{notes_text}\n"

    @abstractmethod
    async def run(self, context: dict) -> dict:
        """Run the agent for the given context."""

    def log_step(self, step: str, data: dict) -> None:
        self.trace_log.append(
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "agent": self.name,
                "step": step,
                "data": data,
            }
        )

    def get_trace(self) -> list:
        return self.trace_log

    async def call_llm(self, system_extra: str, messages: list, api_key: str | None = None, budget_tokens: int | None = None) -> str:
        from core.guardrails import SRPGuardrails
        import json
        from openai import AsyncOpenAI

        last_msg = messages[-1].get("content", "") if messages else ""
        if len(last_msg) > 100:
            injected, reason = SRPGuardrails.is_prompt_injection(str(last_msg)[:2000])
            if injected:
                self.log_step("guardrail_blocked", {"reason": reason})
                return json.dumps({"error": "guardrail_blocked", "reason": reason})

        # BYOK: prefer passed api_key, fallback to env
        resolved_key = api_key or os.environ.get("NVIDIA_API_KEY", "")
        if not resolved_key:
            raise ValueError("No API key provided. Pass api_key or set NVIDIA_API_KEY env var.")

        # Soul first — this is WHO the agent is
        # Skills second — this is WHAT the agent knows
        # System extra third — this is WHAT the agent is doing right now
        system_prompt = ""

        if self.soul_content:
            system_prompt += self.soul_content + "\n\n"

        if self.skill_content:
            system_prompt += "---\n\n# YOUR SKILLS ARSENAL\n\n"
            system_prompt += self.skill_content + "\n\n"

        if system_extra:
            system_prompt += "---\n\n# CURRENT TASK\n\n"
            system_prompt += system_extra

        self.log_step(
            "llm_call_started",
            {
                "model": self.model,
                "message_count": len(messages),
                "system_preview": system_prompt[:400],
                "budget_tokens": budget_tokens,
            },
        )

        client = AsyncOpenAI(
            base_url="https://integrate.api.nvidia.com/v1",
            api_key=resolved_key
        )

        # OpenAI format requires system prompt as a message
        oai_messages = [{"role": "system", "content": system_prompt}] + messages

        kwargs: dict = {
            "model": self.model,
            "max_tokens": 4096,
            "messages": oai_messages,
            "temperature": 0.2,
            "top_p": 0.7,
        }

        # Handle budget_tokens (NVIDIA/Llama might not support thinking budget natively yet,
        # but we can scale up max_tokens if explicitly requested)
        if budget_tokens and budget_tokens > 0:
            kwargs["max_tokens"] = max(4096, budget_tokens + 1000)

        response = await client.chat.completions.create(**kwargs)

        response_text = response.choices[0].message.content or ""

        self.log_step(
            "llm_call_completed",
            {
                "model": self.model,
                "response_chars": len(response_text),
                "response_preview": response_text[:500],
            },
        )

        return response_text

