from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from .base_agent import BaseAgent


class IntentAgent(BaseAgent):
    """Parses user input, builds execution intent, and extracts protocol invariants.

    Phase 1 — Reconnaissance:
    Before reading code, build context from README, whitepaper, docs, and history.
    Identify the protocol's PROMISES.
    """

    def __init__(self, model: str = "meta/llama-3.1-405b-instruct") -> None:
        super().__init__(
            name="IntentAgent",
            role="Performs Phase 1 Reconnaissance and extract protocol invariants",
        )

    async def run(self, context: dict) -> dict:
        """Run intent parsing and protocol intent extraction.

        Args:
            context: Pipeline context dict with raw_input, contract_paths, api_key, etc.

        Returns:
            Dict with intent fields plus protocol_intent from the Protocol Intent Engine.
        """
        self.log_step("recon_started", {"context_keys": list(context.keys())})

        api_key = context.get("api_key")
        raw_input = context.get("raw_input", "")
        project_root = context.get("project_root", ".")
        contract_paths = context.get("contract_paths", [])

        # ── Step 1: Run Protocol Intent Engine ──
        # This performs document reconnaissance and NatSpec extraction
        protocol_intent = await self._run_protocol_intent_engine(
            contract_paths,
            api_key,
            project_root=project_root,
        )
        
        # Merge with any direct LLM recon if needed, but ProtocolIntentEngine is usually enough
        intent = protocol_intent.copy()
        
        # Inject protocol intent for downstream agents
        intent["protocol_intent"] = intent.copy()
        
        # ── Step 2: Write SHARED_TASK_NOTES.md ──
        try:
            notes_path_value = context.get("shared_notes_path") or "outputs/SHARED_TASK_NOTES.md"
            notes_path = Path(notes_path_value)
            notes_path.parent.mkdir(parents=True, exist_ok=True)

            notes_content = self._build_shared_notes(intent)
            notes_path.write_text(notes_content, encoding="utf-8")
            self.log_step("shared_notes_written", {"path": str(notes_path), "lines": len(notes_content.splitlines())})
        except Exception as e:
            self.log_step("shared_notes_write_failed", {"error": str(e)})

        self.log_step("recon_completed", {"protocol": intent.get("protocol_name")})
        return intent

    async def _run_protocol_intent_engine(
        self, contract_paths: list, api_key: str | None, project_root: str | None = None
    ) -> dict[str, Any]:
        """Run the Protocol Intent Engine to extract invariants from project docs.

        Args:
            contract_paths: List of contract file/directory paths.
            api_key: Optional API key for LLM calls.
            project_root: Project root directory.

        Returns:
            Protocol intent dict.
        """
        from srp.core.intent_engine import ProtocolIntentEngine

        resolved_root = project_root or "."
        self.log_step("protocol_intent_engine_started", {"project_root": resolved_root})

        try:
            engine = ProtocolIntentEngine(resolved_root)
            result = await engine.extract(call_llm=self.call_llm, api_key=api_key)
            stats = engine.get_collection_stats()

            self.log_step(
                "protocol_intent_engine_completed",
                {
                    "protocol_name": result.get("protocol_name", "unknown"),
                    "protocol_type": result.get("protocol_type", "generic"),
                    "invariant_count": len(result.get("invariants", [])),
                    "collection_stats": stats,
                },
            )
            return result
        except Exception as exc:
            self.log_step("protocol_intent_engine_failed", {"error": str(exc)})
            return {
                "protocol_name": "Unknown",
                "protocol_type": "generic",
                "invariants": [],
            }

    def _build_shared_notes(self, intent_result: dict[str, Any]) -> str:
        """Build SHARED_TASK_NOTES.md content from the full intent result."""
        protocol_intent = intent_result.get("protocol_intent", {})
        protocol_name = protocol_intent.get("protocol_name", "Unknown")
        protocol_type = protocol_intent.get("protocol_type", "generic")
        protocol_summary_text = protocol_intent.get("summary", "").strip()
        invariants = protocol_intent.get("invariants", [])
        critical_functions = protocol_intent.get("critical_functions", [])
        trust_assumptions = protocol_intent.get("trust_assumptions", [])
        access_control_rules = protocol_intent.get("access_control_rules", [])

        # Build summary sections
        protocol_summary = f"""
## What This Protocol Does
{protocol_summary_text or "Unknown protocol purpose"}
"""

        if invariants:
            invariant_lines = []
            for i, inv in enumerate(invariants, 1):
                severity = str(inv.get("severity_if_broken", inv.get("severity", "medium"))).upper()
                invariant_lines.append(f"- INV-{i:03d}: {inv.get('description', 'No description')} — SEVERITY: {severity}")
            invariant_section = """
## Key Invariants
""" + "\n".join(invariant_lines)
        else:
            invariant_section = """
## Key Invariants
- No invariants detected
"""

        if critical_functions:
            critical_section = """
## Critical Functions to Hunt
""" + "\n".join(f"- {fn}" for fn in critical_functions)
        else:
            critical_section = """
## Critical Functions to Hunt
- No critical functions identified
"""

        if trust_assumptions:
            trust_section = """
## Trust Assumptions
""" + "\n".join(f"- {assumption}" for assumption in trust_assumptions)
        else:
            trust_section = """
## Trust Assumptions
- No trust assumptions identified
"""

        if access_control_rules:
            access_control = """
## Access Control Rules
""" + "\n".join(f"- {rule}" for rule in access_control_rules)
        else:
            access_control = """
## Access Control Rules
- No access control rules identified
"""

        content = f"""
---
# Protocol: {protocol_name}
# Type: {protocol_type}
# Detected: {datetime.now(timezone.utc).isoformat()}
---

{protocol_summary}

{invariant_section}

{critical_section}

{trust_section}

{access_control}

---
# Shared Notes for SRP Agents
# DO NOT EDIT MANUALLY
---
"""
        return content
