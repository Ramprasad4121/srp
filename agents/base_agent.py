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

    def get_shared_notes(self) -> str:
        """Get shared protocol notes from outputs/SHARED_TASK_NOTES.md."""
        import os
        notes_path = os.path.join(os.getcwd(), "outputs", "SHARED_TASK_NOTES.md")
        if not os.path.exists(notes_path):
            return ""
        try:
            with open(notes_path, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception:
            return ""

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

        # Multi-provider routing based on model string
        resolved_model = model or self.model
        resolved_timeout = timeout or 240.0

        # Soul first — this is WHO the agent is
        # Skills second — this is WHAT the agent knows
        # System extra third — this is WHAT the agent is doing right now
        # Shared notes fourth — this is CONTEXT from previous agents
        system_prompt = ""

        # Add shared notes first
        shared_notes = self.get_shared_notes()
        if shared_notes:
            system_prompt += "---\n\n# SHARED PROTOCOL NOTES\n\n"
            system_prompt += shared_notes + "\n\n"

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
                "model": resolved_model,
                "message_count": len(messages),
                "system_preview": system_prompt[:400],
                "budget_tokens": budget_tokens,
            },
        )

        try:
            if resolved_model.startswith("claude"):
                resolved_key = api_key or os.environ.get("ANTHROPIC_API_KEY", "")
                if not resolved_key:
                    raise ValueError("ANTHROPIC_API_KEY not set.")
                client = AsyncAnthropic(api_key=resolved_key, max_retries=0, timeout=resolved_timeout)
                kwargs = {
                    "model": resolved_model,
                    "max_tokens": max_tokens,
                    "system": system_prompt,
                    "messages": messages,
                    "temperature": 0.2,
                }
                if budget_tokens and budget_tokens > 0:
                    kwargs["max_tokens"] = max(max_tokens, budget_tokens + 1000)
                if int(kwargs["max_tokens"]) > 8192 and "sonnet" in resolved_model:
                    kwargs["max_tokens"] = 8192 # Claude hard limit

                response = await asyncio.wait_for(client.messages.create(**kwargs), timeout=resolved_timeout)
                response_text = response.content[0].text if response.content else ""

            else:
                oai_messages = [{"role": "system", "content": system_prompt}] + messages
                kwargs = {
                    "model": resolved_model,
                    "messages": oai_messages,
                    "temperature": 0.2,
                    "top_p": 0.7,
                }
                # o1 and o3 models don't support max_tokens directly, they use max_completion_tokens
                if resolved_model.startswith("o1") or resolved_model.startswith("o3"):
                    if budget_tokens and budget_tokens > 0:
                        kwargs["max_completion_tokens"] = max(max_tokens, budget_tokens + 1000)
                    else:
                        kwargs["max_completion_tokens"] = max_tokens
                    # o models also have temperature fixed at 1
                    kwargs.pop("temperature", None)
                    kwargs.pop("top_p", None)
                else:
                    if budget_tokens and budget_tokens > 0:
                        kwargs["max_tokens"] = max(max_tokens, budget_tokens + 1000)
                    else:
                        kwargs["max_tokens"] = max_tokens

                if resolved_model.startswith("gpt-") or resolved_model.startswith("o1") or resolved_model.startswith("o3"):
                    resolved_key = api_key or os.environ.get("OPENAI_API_KEY", "")
                    if not resolved_key:
                        raise ValueError("OPENAI_API_KEY not set.")
                    from openai import AsyncOpenAI
                    client = AsyncOpenAI(api_key=resolved_key, timeout=resolved_timeout, max_retries=0)
                else:
                    resolved_key = api_key or os.environ.get("NVIDIA_API_KEY", "")
                    if not resolved_key:
                        raise ValueError("NVIDIA_API_KEY not set.")
                    from openai import AsyncOpenAI
                    client = AsyncOpenAI(base_url="https://integrate.api.nvidia.com/v1", api_key=resolved_key, timeout=resolved_timeout, max_retries=0)

                response = await asyncio.wait_for(client.chat.completions.create(**kwargs), timeout=resolved_timeout)
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

