from __future__ import annotations

import asyncio
import os
import sys
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
        self.sl = SkillLoader()

        # Load soul first — identity before skills
        self.soul_content = self.sl.load_soul(name)

        # Load skills — methodology after identity
        self.skill_content = self.sl.load_many(skill_keys) if skill_keys else ""


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

    def log(self, message: str) -> None:
        """Generic logger for agents."""
        self.log_step("agent_log", {"message": message})

    def get_trace(self) -> list:
        return self.trace_log

    async def call_llm(
        self,
        system_extra: str,
        messages: list,
        api_key: str | None = None,
        budget_tokens: int | None = None,
        max_tokens: int = 4096,
        model: str | None = None,
        timeout: float | None = None,
    ) -> str:
        from core.guardrails import SRPGuardrails
        import json
        from openai import AsyncOpenAI

        last_msg = messages[-1].get("content", "") if messages else ""
        if len(last_msg) > 100:
            # Strip known-safe code payload fields before scanning
            sanitized_content = self._sanitize_for_guardrail(str(last_msg))
            injected, reason = SRPGuardrails.is_prompt_injection(sanitized_content[:2000])
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

        resolved_model = model or self.model

        self.log_step(
            "llm_call_started",
            {
                "model": resolved_model,
                "message_count": len(messages),
                "system_preview": system_prompt[:400],
                "budget_tokens": budget_tokens,
            },
        )
        # OpenAI format requires system prompt as a message
        oai_messages = [{"role": "system", "content": system_prompt}] + messages

        import httpx

        LLM_TIMEOUT_SECONDS = 240.0  # max 4 minutes per LLM call

        try:
            client = AsyncOpenAI(
                base_url="https://integrate.api.nvidia.com/v1",
                api_key=resolved_key,
                timeout=LLM_TIMEOUT_SECONDS,
                max_retries=0,
            )

            kwargs: dict = {
                "model": resolved_model,
                "max_tokens": max_tokens,
                "messages": oai_messages,
                "temperature": 0.2,
                "top_p": 0.7,
            }

            if budget_tokens and budget_tokens > 0:
                kwargs["max_tokens"] = max(max_tokens, budget_tokens + 1000)


            # Allow user timeouts or global defaults
            resolved_timeout = timeout or LLM_TIMEOUT_SECONDS
            
            # Set the httpx timeout explicitly in the create call as requested
            kwargs["timeout"] = resolved_timeout

            response = await asyncio.wait_for(
                client.chat.completions.create(**kwargs),
                timeout=resolved_timeout,
            )
            response_text = response.choices[0].message.content or ""
        except (asyncio.TimeoutError, Exception) as exc:
            timeout_msg = f"LLM call timed out or failed after {resolved_timeout}s: {exc}"
            self.log_step("llm_call_timeout", {"error": timeout_msg, "model": resolved_model})
            # Return empty vulnerabilities list on failure to ensure downstream passes don't crash
            return '{"vulnerabilities": []}'

        self.log_step(
            "llm_call_completed",
            {
                "model": self.model,
                "response_chars": len(response_text),
                "response_preview": response_text[:500],
            },
        )

        return response_text

    def _sanitize_for_guardrail(self, content: str) -> str:
        """Remove contract code field values before injection scanning."""
        import re
        SAFE_FIELDS = {"CONTRACT_CODE", "vuln_code", "fix_code", "exploit_code", "source_code"}
        for field in SAFE_FIELDS:
            # Remove field values from JSON payloads
            content = re.sub(
                rf'"{field}"\s*:\s*"[^"]*"',
                f'"{field}": "[REDACTED]"',
                content
            )
            content = re.sub(
                rf'"{field}"\s*:\s*\{{[^}}]*\}}',
                f'"{field}": {{}}',
                content,
                flags=re.DOTALL
            )
        return content

