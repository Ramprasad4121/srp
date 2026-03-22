import asyncio
import tempfile
import unittest
from pathlib import Path

from agents.intent_agent import IntentAgent


class IntentAgentSharedNotesTests(unittest.TestCase):
    def test_run_writes_populated_shared_notes_from_protocol_intent(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            notes_path = Path(tmp_dir) / "SHARED_TASK_NOTES.md"
            agent = IntentAgent()

            async def fake_call_llm(**_: object) -> str:
                return (
                    '{"task_description":"Audit SecondSwap","audit_scope":"contracts",'
                    '"risk_level":"high","skills_needed":["amm"],"estimated_budget_usd":150}'
                )

            async def fake_protocol_intent_engine(*_: object, **__: object) -> dict:
                return {
                    "protocol_name": "SecondSwap",
                    "protocol_type": "amm",
                    "summary": "Secondary market for locked token allocations.",
                    "invariants": [
                        {
                            "id": "INV-001",
                            "description": "Listed balance cannot exceed seller allocation.",
                            "severity_if_broken": "high",
                        }
                    ],
                    "critical_functions": ["listVesting", "buyVesting"],
                    "trust_assumptions": ["Trusted vesting manager updates allocations correctly."],
                    "access_control_rules": ["Only owner can pause the marketplace."],
                }

            agent.call_llm = fake_call_llm  # type: ignore[method-assign]
            agent._run_protocol_intent_engine = fake_protocol_intent_engine  # type: ignore[method-assign]

            result = asyncio.run(
                agent.run(
                    {
                        "raw_input": "Audit the protocol",
                        "contract_paths": [],
                        "shared_notes_path": str(notes_path),
                    }
                )
            )

            notes = notes_path.read_text(encoding="utf-8")

        self.assertEqual(result["protocol_intent"]["protocol_name"], "SecondSwap")
        self.assertIn("# Protocol: SecondSwap", notes)
        self.assertIn("# Type: amm", notes)
        self.assertIn("Secondary market for locked token allocations.", notes)
        self.assertIn("- listVesting", notes)
        self.assertIn("- buyVesting", notes)
        self.assertIn("- Trusted vesting manager updates allocations correctly.", notes)
        self.assertIn("- Only owner can pause the marketplace.", notes)


if __name__ == "__main__":
    unittest.main()
