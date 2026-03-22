"""
J5: UpgradeSafetyChecker — Checks upgrade safety for upgradeable Solidity contracts.
"""
from __future__ import annotations
import json
import re
import os
from dotenv import load_dotenv
load_dotenv()

MODEL = "claude-sonnet-4-6"
SYSTEM = """You are a smart contract upgrade safety expert.
Analyze upgradeable contracts for: storage collision, missing initializer modifiers,
selfdestruct in logic contracts, function selector clashes, storage layout drift, and missing upgrade gaps."""


class UpgradeSafetyChecker:
    """J5: Checks upgrade safety for UUPS/TransparentProxy/Beacon contracts."""

    def __init__(self):
        self.api_key = os.getenv("ANTHROPIC_API_KEY", "")

    async def run(self, context: dict) -> dict:
        code = context.get("code", "")
        if not code:
            return {"upgrade_issues": [], "is_upgradeable": False, "error": "No code provided"}

        # Quick check if code has upgrade patterns
        upgrade_keywords = ["upgradeable", "Upgradeable", "proxy", "Proxy", "initializer",
                           "UUPSUpgradeable", "Initializable", "__gap", "storage"]
        is_upgradeable = any(kw in code for kw in upgrade_keywords)

        prompt = f"""Analyze this Solidity contract for upgrade safety issues.

CONTRACT:
```solidity
{code[:8000]}
```

Return JSON only:
{{
  "is_upgradeable": true|false,
  "proxy_pattern": "UUPS|TransparentProxy|Beacon|None",
  "upgrade_issues": [
    {{
      "id": "UPG-1",
      "severity": "critical|high|medium|low",
      "category": "storage_collision|missing_initializer|selfdestruct|selector_clash|storage_gap|state_variable",
      "description": "Description of the issue",
      "location": "function or state variable name",
      "recommendation": "How to fix it"
    }}
  ],
  "storage_layout_safe": true|false,
  "initializer_present": true|false,
  "upgrade_gap_present": true|false,
  "overall_risk": "safe|low_risk|medium_risk|high_risk"
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
                "is_upgradeable": result.get("is_upgradeable", is_upgradeable),
                "proxy_pattern": result.get("proxy_pattern", "None"),
                "upgrade_issues": result.get("upgrade_issues", []),
                "storage_layout_safe": result.get("storage_layout_safe", True),
                "overall_risk": result.get("overall_risk", "unknown"),
                "count": len(result.get("upgrade_issues", [])),
                "model": MODEL,
            }
        except Exception as e:
            return {"upgrade_issues": [], "is_upgradeable": is_upgradeable, "error": str(e)}


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
