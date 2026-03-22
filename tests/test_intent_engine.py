import asyncio
import tempfile
import unittest
from pathlib import Path

from core.intent_engine import ProtocolIntentEngine


class ProtocolIntentEngineTests(unittest.TestCase):
    def test_normalize_unwraps_nested_protocol_intent_payload(self) -> None:
        engine = ProtocolIntentEngine(".")
        engine._collected_docs = {
            "README:README.md": "# SecondSwap audit details\n\nThis AMM lets users swap tokens and provide liquidity."
        }

        parsed = {
            "protocol_intent": {
                "protocol_name": "SecondSwap",
                "protocol_type": "amm",
                "summary": "Secondary liquidity marketplace",
            }
        }

        intent = engine._normalize_to_protocol_intent(parsed).to_dict()

        self.assertEqual(intent["protocol_name"], "SecondSwap")
        self.assertEqual(intent["protocol_type"], "amm")
        self.assertEqual(intent["summary"], "Secondary liquidity marketplace")

    def test_extract_fallback_infers_name_and_type_from_readme(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            project_root = Path(tmp_dir)
            (project_root / "README.md").write_text(
                "# SecondSwap audit details\n\n"
                "SecondSwap lets users swap locked token allocations and provide liquidity across pools.\n",
                encoding="utf-8",
            )

            engine = ProtocolIntentEngine(project_root)
            engine.outputs_dir = project_root / "tmp_outputs"

            result = asyncio.run(engine.extract(call_llm=None))

        self.assertEqual(result["protocol_name"], "SecondSwap")
        self.assertEqual(result["protocol_type"], "amm")


if __name__ == "__main__":
    unittest.main()
