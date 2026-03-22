"""
J6: DevAccessControlMapper — Maps access control graph for Solidity contracts during development.
"""
from __future__ import annotations
import json
import re
import os
from dotenv import load_dotenv
load_dotenv()

MODEL = "claude-sonnet-4-6"
SYSTEM = """You are a smart contract access control security expert.
Map who can call what, identify missing or incorrect access controls, and find privilege escalation paths."""


class DevAccessControlMapper:
    """J6: Maps access control graph and identifies AC issues during development."""

    def __init__(self):
        self.api_key = os.getenv("ANTHROPIC_API_KEY", "")

    async def run(self, context: dict) -> dict:
        code = context.get("code", "")
        if not code:
            return {"access_findings": [], "error": "No code provided"}

        prompt = f"""Analyze this Solidity contract's access control.

CONTRACT:
```solidity
{code[:8000]}
```

Return JSON only:
{{
  "roles": [
    {{
      "role": "owner|admin|user|public",
      "functions": ["list of functions this role can call"]
    }}
  ],
  "access_findings": [
    {{
      "id": "AC-1",
      "severity": "critical|high|medium|low",
      "category": "missing_modifier|wrong_modifier|privilege_escalation|unrestricted|role_confusion",
      "function": "functionName",
      "description": "What the access control issue is",
      "recommendation": "How to fix it",
      "who_can_exploit": "Anyone|Admin|User"
    }}
  ],
  "privilege_escalation_paths": ["describe any paths where a user can gain more privileges"],
  "overall_ac_rating": "strong|adequate|weak|broken"
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
                "roles": result.get("roles", []),
                "access_findings": result.get("access_findings", []),
                "privilege_escalation_paths": result.get("privilege_escalation_paths", []),
                "overall_ac_rating": result.get("overall_ac_rating", "unknown"),
                "count": len(result.get("access_findings", [])),
                "model": MODEL,
            }
        except Exception as e:
            return {"access_findings": [], "error": str(e)}


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
