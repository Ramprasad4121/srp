"""
J1: NatSpecAgent — Generates NatSpec documentation for Solidity contracts.
"""
from __future__ import annotations
import re
import os
from dotenv import load_dotenv
load_dotenv()

MODEL = "claude-sonnet-4-6"
SYSTEM = """You are an expert Solidity documentation writer.
Generate complete NatSpec documentation (/// @title, @notice, @dev, @param, @return, @custom) for Solidity functions.
Be precise, developer-friendly, and security-aware. Highlight any gotchas or invariants in @dev."""


class NatSpecAgent:
    """J1: Generates NatSpec comments for all functions in a Solidity contract."""

    def __init__(self):
        self.api_key = os.getenv("ANTHROPIC_API_KEY", "")

    async def run(self, context: dict) -> dict:
        code = context.get("code", "")
        if not code:
            return {"natspec": "", "error": "No code provided"}

        functions = self._extract_functions(code)
        if not functions:
            return {"natspec": "// No public functions found in this code snippet.", "functions_found": 0}

        prompt = f"""Given this Solidity contract, generate NatSpec documentation for every function, modifier, and event.
For each function, output the natspec comment immediately before the function signature.

CONTRACT:
```solidity
{code[:8000]}
```

Output ONLY the documented version of the code (all functions with NatSpec added above each one).
Do not explain. Do not wrap in markdown. Output the complete @notice, @param, @return, @dev for every function."""

        try:
            import anthropic
            client = anthropic.Anthropic(api_key=self.api_key)
            msg = client.messages.create(
                model=MODEL,
                max_tokens=4096,
                system=SYSTEM,
                messages=[{"role": "user", "content": prompt}],
            )
            natspec = msg.content[0].text if msg.content else ""
            return {
                "natspec": natspec,
                "functions_found": len(functions),
                "model": MODEL,
            }
        except Exception as e:
            return {"natspec": "", "error": str(e)}

    def _extract_functions(self, code: str) -> list:
        """Extract function names from Solidity code."""
        pattern = r'function\s+(\w+)\s*\('
        return re.findall(pattern, code)
