"""
J3: TestWriter — Generates Foundry test scaffolds for Solidity contracts.
"""
from __future__ import annotations
import re
import os
from dotenv import load_dotenv
load_dotenv()

MODEL = "claude-sonnet-4-6"
SYSTEM = """You are an expert Solidity test engineer using Foundry.
Generate comprehensive Foundry test contracts with: setUp, happy path tests, edge case tests, fuzz tests, and invariant tests.
Use vm.prank, vm.deal, vm.expectRevert, vm.startPrank, assertEq, assertGt/Lt, etc."""


class TestWriter:
    """J3: Generates Foundry test stubs for all functions in a Solidity contract."""

    def __init__(self):
        self.api_key = os.getenv("ANTHROPIC_API_KEY", "")

    async def run(self, context: dict) -> dict:
        code = context.get("code", "")
        if not code:
            return {"tests": "", "error": "No code provided"}

        # Detect contract name
        contract_match = re.search(r'contract\s+(\w+)', code)
        contract_name = contract_match.group(1) if contract_match else "Contract"

        prompt = f"""Generate a complete Foundry test file for this Solidity contract.

CONTRACT ({contract_name}):
```solidity
{code[:8000]}
```

Requirements:
1. One test function per public/external function (test_functionName, test_functionName_revertsIf...)
2. A setUp() that deploys the contract
3. At least one fuzz test (function testFuzz_...(uint256 amount) public)
4. At least one revert test using vm.expectRevert
5. Use assertEq, assertGt, assertLt for assertions
6. Use vm.prank(address) to test access control

Output ONLY the complete Foundry test file. No explanation. Starts with // SPDX-License-Identifier: MIT"""

        try:
            import anthropic
            client = anthropic.Anthropic(api_key=self.api_key)
            msg = client.messages.create(
                model=MODEL,
                max_tokens=4096,
                system=SYSTEM,
                messages=[{"role": "user", "content": prompt}],
            )
            tests = msg.content[0].text if msg.content else ""
            # Clean markdown fences if present
            tests = re.sub(r'```(?:solidity)?', '', tests).strip().rstrip('`').strip()
            return {
                "tests": tests,
                "contract_name": contract_name,
                "model": MODEL,
            }
        except Exception as e:
            return {"tests": "", "error": str(e)}
