"""
J2: InvariantSuggester — Suggests formal invariants and property tests from Solidity code.
"""
from __future__ import annotations
import json
import re
import os
from dotenv import load_dotenv
load_dotenv()

MODEL = "claude-sonnet-4-6"
SYSTEM = """You are a formal verification expert who specializes in Solidity invariants.
You generate concrete, testable invariants that can be used in fuzzing tools like Foundry's invariant tests,
Certora, or Echidna. Be precise and include the Solidity assertion syntax."""


class InvariantSuggester:
    """J2: Suggests security invariants and property-based tests for a Solidity contract."""

    def __init__(self):
        self.api_key = os.getenv("ANTHROPIC_API_KEY", "")

    async def run(self, context: dict) -> dict:
        code = context.get("code", "")
        if not code:
            return {"invariants": [], "error": "No code provided"}

        prompt = f"""Analyze this Solidity contract and suggest 3-8 critical invariants that should ALWAYS hold.

CONTRACT:
```solidity
{code[:8000]}
```

Return JSON only:
{{
  "invariants": [
    {{
      "id": "INV-1",
      "category": "accounting|access_control|state|flow",
      "description": "Human-readable invariant description",
      "severity_if_broken": "high|medium|low",
      "formal_expression": "assert(some_condition);",
      "foundry_test": "function invariant_name() public {{ ... }}",
      "when_to_check": "Always|After deposit|After withdrawal|etc"
    }}
  ],
  "critical_paths": ["list of critical code paths to test"]
}}"""

        try:
            import anthropic
            client = anthropic.Anthropic(api_key=self.api_key)
            msg = client.messages.create(
                model=MODEL,
                max_tokens=2048,
                system=SYSTEM,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = msg.content[0].text if msg.content else "{}"
            result = _safe_parse(raw)
            return {
                "invariants": result.get("invariants", []),
                "critical_paths": result.get("critical_paths", []),
                "count": len(result.get("invariants", [])),
                "model": MODEL,
            }
        except Exception as e:
            return {"invariants": [], "error": str(e)}


def _safe_parse(raw: str) -> dict:
    try:
        cleaned = re.sub(r'```(?:json)?\s*', '', raw).strip().rstrip('`').strip()
        return json.loads(cleaned)
    except Exception:
        start = raw.find('{')
        if start != -1:
            text = raw[start:]
            depth = 0
            for i, ch in enumerate(text):
                if ch == '{': depth += 1
                elif ch == '}': depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[:i+1])
                    except Exception:
                        break
        return {}
