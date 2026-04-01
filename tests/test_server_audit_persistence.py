import asyncio
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import server.server as srp_server
from core.project import SRPProject


class ServerAuditPersistenceTests(unittest.TestCase):
    def test_run_audit_persists_results_to_project_history(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            project_root = Path(tmp_dir)
            contract_path = project_root / "Sample.sol"
            contract_path.write_text("pragma solidity ^0.8.20; contract Sample {}", encoding="utf-8")

            project = SRPProject(str(project_root))
            project.initialize()

            result = {
                "intent": {
                    "protocol_intent": {
                        "protocol_name": "Sample",
                        "protocol_type": "amm",
                        "summary": "Sample protocol",
                        "invariants": [],
                        "access_control_rules": [],
                    }
                },
                "plan": {
                    "protocol_type": "amm",
                    "confidence": 0.9,
                    "attack_surfaces": ["swap"],
                    "plan": [{"step": "attack"}],
                    "fallback": False,
                },
                "attack": {
                    "vulnerabilities": [
                        {
                            "id": "AMM-001",
                            "title": "Broken invariant",
                            "severity": "high",
                            "summary": "Invariant can be violated.",
                            "affected_function": "swap",
                        }
                    ]
                },
                "defense": {
                    "reviewed_vulnerabilities": [
                        {
                            "original_id": "AMM-001",
                            "final_severity": "high",
                            "summary": "Confirmed broken invariant.",
                            "status": "confirmed",
                        }
                    ],
                    "overall_security_score": 42,
                },
                "trace": {"trace_id": "trace-persist-001", "logs": []},
                "report": {"report_md": "# Sample Report\n"},
            }

            async def fake_run_audit(*_: object, **__: object) -> dict:
                return result

            original_root = os.environ.get("SRP_PROJECT_ROOT")
            srp_server._project = None
            os.environ["SRP_PROJECT_ROOT"] = str(project_root)
            try:
                with patch("server.server._run_audit", new=fake_run_audit):
                    asyncio.run(srp_server.run_audit(str(contract_path), "Audit the sample contract"))
            finally:
                srp_server._project = None
                if original_root is None:
                    os.environ.pop("SRP_PROJECT_ROOT", None)
                else:
                    os.environ["SRP_PROJECT_ROOT"] = original_root

            audit_path = project_root / ".srp" / "audits" / "trace-persist-001.json"
            trace_path = project_root / ".srp" / "traces" / "trace-persist-001.json"
            report_path = project_root / ".srp" / "reports" / "trace-persist-001.md"
            config_path = project_root / ".srp" / "config.json"

            self.assertTrue(audit_path.exists())
            self.assertTrue(trace_path.exists())
            self.assertTrue(report_path.exists())

            saved_audit = json.loads(audit_path.read_text(encoding="utf-8"))
            saved_config = json.loads(config_path.read_text(encoding="utf-8"))

            self.assertEqual(saved_audit["trace"]["trace_id"], "trace-persist-001")
            self.assertEqual(saved_config["last_audit"]["trace_id"], "trace-persist-001")
            self.assertEqual(saved_config["last_audit"]["findings"], 0)


if __name__ == "__main__":
    unittest.main()
