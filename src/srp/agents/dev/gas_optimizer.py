"""
J4: GasOptimizer — Analyzes Solidity code for gas optimization opportunities.
"""
from __future__ import annotations
import json
import re
import os
from dotenv import load_dotenv
load_dotenv()

MODEL = "claude-sonnet-4-6"
SYSTEM = """You are a Solidity gas optimization expert.
Analyze code for gas inefficiencies and suggest concrete, production-ready optimizations.
Focus on: storage vs memory, packing, unchecked, cache storage reads, MSTORE/SLOAD reduction, batch operations."""


class GasOptimizer:
    """J4: Identifies gas inefficiencies and suggests optimizations for Solidity contracts."""

    def __init__(self):
        self.api_key = os.getenv("ANTHROPIC_API_KEY", "")

    async def run(self, context: dict) -> dict:
        code = context.get("code", "")
        if not code:
            return {"gas_hints": [], "error": "No code provided"}

        prompt = f"""Analyze this Solidity contract for gas optimization opportunities.

CONTRACT:
```solidity
{code[:8000]}
```

Return JSON only:
{{
  "gas_hints": [
    {{
      "id": "GAS-1",
      "category": "storage|memory|loop|packing|redundant|arithmetic",
      "severity": "high|medium|low",
      "description": "What the issue is",
      "location": "function name or line description",
      "before": "original code snippet",
      "after": "optimized code snippet",
      "estimated_savings": "approximate gas savings (e.g., 200 gas per call)"
    }}
  ],
  "total_estimated_savings": "e.g., 5,000-20,000 gas per transaction"
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
                "gas_hints": result.get("gas_hints", []),
                "total_estimated_savings": result.get("total_estimated_savings", ""),
                "count": len(result.get("gas_hints", [])),
                "model": MODEL,
            }
        except Exception as e:
            return {"gas_hints": [], "error": str(e)}


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
