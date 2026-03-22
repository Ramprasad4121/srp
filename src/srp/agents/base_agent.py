from __future__ import annotations

import asyncio
import os
import sys
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

class BaseAgent(ABC):
    def __init__(self, name: str, role: str, skill_keys: list | None = None, model: str | None = None) -> None:
        self.name = name
        self.role = role
        env_model = os.environ.get("SRP_MODEL", "").strip()
        self.model = env_model or model or "gpt-4o-mini"
        self.trace_log: list[dict[str, Any]] = []

        from srp.core.skill_loader import SkillLoader
        self.sl = SkillLoader()

        # Load soul first — identity before skills
        self.soul_content = self.sl.load_soul(name)

        # Load skills — methodology after identity
        self.skill_content = self.sl.load_many(skill_keys) if skill_keys else ""


        self.progress = None
        self.shared_notes_path: Path | None = None

    def set_progress(self, progress: "AuditProgress") -> None:
        """Inject audit progress tracker into agent."""
        self.progress = progress

    def set_shared_notes_path(self, path: str | os.PathLike[str] | None) -> None:
        self.shared_notes_path = Path(path).resolve() if path else None

    def get_shared_notes(self) -> str:
        """Get shared protocol notes from the current project's scoped notes file."""
        notes_path = self.shared_notes_path
        if notes_path is None:
            configured_path = os.environ.get("SRP_SHARED_NOTES_PATH")
            if configured_path:
                notes_path = Path(configured_path).resolve()
            else:
                project_root = Path(os.environ.get("SRP_PROJECT_ROOT", os.getcwd())).resolve()
                notes_path = project_root / "outputs" / "SHARED_TASK_NOTES.md"

        if not notes_path.exists():
            return ""
        try:
            with notes_path.open("r", encoding="utf-8") as f:
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
        from srp.core.guardrails import SRPGuardrails
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

        # Hardware-accelerated NVIDIA NIM Routing (Exclusive)
        resolved_model = model or self.model
        resolved_timeout = timeout or 240.0
        
        # Override for NVIDIA models natively
        active_model = os.environ.get("NVIDIA_MODEL", "").strip() or "moonshotai/kimi-k2.5"

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
                "model": active_model,
                "message_count": len(messages),
                "system_preview": system_prompt[:400],
                "budget_tokens": budget_tokens,
            },
        )

        try:
            oai_messages = [{"role": "system", "content": system_prompt}] + messages
            kwargs = {
                "model": active_model,
                "messages": oai_messages,
                "temperature": 0.2,
                "top_p": 0.7,
            }
            
            if budget_tokens and budget_tokens > 0:
                kwargs["max_tokens"] = max(max_tokens, budget_tokens + 1000)
            else:
                kwargs["max_tokens"] = max_tokens

            from openai import AsyncOpenAI
            
            resolved_key = api_key or os.environ.get("NVIDIA_API_KEY", "")
            if not resolved_key:
                raise ValueError("NVIDIA_API_KEY not set in .env. Cannot boot agent swarm.")
                
            client = AsyncOpenAI(api_key=resolved_key, base_url="https://integrate.api.nvidia.com/v1", timeout=resolved_timeout, max_retries=0)

            response = await asyncio.wait_for(client.chat.completions.create(**kwargs), timeout=resolved_timeout)
            response_text = response.choices[0].message.content or ""

        except asyncio.TimeoutError as exc:
            timeout_msg = f"LLM call timed out after {resolved_timeout}s: {exc}"
            self.log_step("llm_call_timeout", {"error": timeout_msg, "model": resolved_model})
            # Return empty vulnerabilities list on failure to ensure downstream passes don't crash
            return '{"vulnerabilities": []}'
        except Exception as exc:
            error_type = type(exc).__name__
            error_msg = f"LLM call failed: {error_type}: {exc}"
            self.log_step(
                "llm_call_failed",
                {"error": error_msg, "model": resolved_model, "error_type": error_type},
            )
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
        import json
        import re
        SAFE_FIELDS = {
            "CONTRACT_CODE",
            "vuln_code",
            "fix_code",
            "exploit_code",
            "source_code",
            "vulnerability",
            "vulnerabilities",
            "reviewed_vulnerabilities",
            "summary",
            "description",
            "defense_notes",
            "attack_path",
            "root_cause",
        }

        def redact(value: Any) -> Any:
            if isinstance(value, dict):
                sanitized: dict[str, Any] = {}
                for key, nested_value in value.items():
                    if key in SAFE_FIELDS:
                        if isinstance(nested_value, list):
                            sanitized[key] = []
                        elif isinstance(nested_value, dict):
                            sanitized[key] = {}
                        else:
                            sanitized[key] = "[REDACTED]"
                    else:
                        sanitized[key] = redact(nested_value)
                return sanitized
            if isinstance(value, list):
                return [redact(item) for item in value]
            return value

        try:
            parsed = json.loads(content)
            return json.dumps(redact(parsed))
        except Exception:
            pass

        for field in SAFE_FIELDS:
            # Remove field values from JSON payloads
            content = re.sub(
                rf'"{field}"\s*:\s*\[[^\]]*\]',
                f'"{field}": []',
                content,
                flags=re.DOTALL
            )
            content = re.sub(
                rf'"{field}"\s*:\s*\{{[^}}]*\}}',
                f'"{field}": {{}}',
                content,
                flags=re.DOTALL
            )
            content = re.sub(
                rf'"{field}"\s*:\s*"[^"]*"',
                f'"{field}": "[REDACTED]"',
                content
            )
        return content

    def clean_json_text(self, text: str) -> str:
        """Strip markdown, remove trailing commas, and normalize quotes for JSON parsing."""
        from srp.core.utils import clean_json_text
        return clean_json_text(text)

    def parse_json(self, response: str, default: Any = None) -> Any:
        """Safely parse LLM response into JSON with a robust fallback."""
        from srp.core.utils import parse_llm_json
        parsed = parse_llm_json(response)
        if not parsed and default is not None:
            return default
        return parsed
