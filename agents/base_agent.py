from __future__ import annotations

import os
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any

from anthropic import AsyncAnthropic

from core.skill_loader import SkillLoader


class BaseAgent(ABC):
    def __init__(self, name: str, role: str, skill_keys: list = []) -> None:
        self.name = name
        self.role = role
        skill_loader = SkillLoader()
        self.skill_content = skill_loader.load_many(skill_keys)
        self.trace_log: list[dict[str, Any]] = []
        self.model = "claude-sonnet-4-20250514"

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

    async def call_llm(self, system_extra: str, messages: list) -> str:
        api_key = os.environ["ANTHROPIC_API_KEY"]
        system_prompt = (
            f"You are {self.name}. Role: {self.role}\n\n"
            f"{self.skill_content}\n\n"
            f"{system_extra}"
        )

        self.log_step(
            "llm_call_started",
            {
                "model": self.model,
                "message_count": len(messages),
                "system_preview": system_prompt[:400],
            },
        )

        client = AsyncAnthropic(api_key=api_key)

        response = await client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=system_prompt,
            messages=messages,
        )

        text_parts: list[str] = []
        for block in response.content:
            if getattr(block, "type", None) == "text":
                text_parts.append(getattr(block, "text", ""))
        response_text = "\n".join(part for part in text_parts if part).strip()

        self.log_step(
            "llm_call_completed",
            {
                "model": self.model,
                "response_chars": len(response_text),
                "response_preview": response_text[:500],
            },
        )

        return response_text
