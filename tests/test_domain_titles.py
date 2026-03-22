import unittest
from pathlib import Path

from agents.audit.title_utils import apply_finding_titles, ensure_finding_title


TARGET_DIRS = [
    Path("agents/audit/amm"),
    Path("agents/audit/bridge"),
    Path("agents/audit/staking"),
    Path("agents/audit/governance"),
    Path("agents/audit/perpetuals"),
    Path("agents/audit/crosschain"),
]


class DomainTitleTests(unittest.TestCase):
    def test_ensure_finding_title_generates_required_format(self) -> None:
        title = ensure_finding_title(
            {
                "contract": "BridgeRouter",
                "affected_function": "executeMessage",
            },
            "Replay Attack",
            "message replay across chains",
        )

        self.assertEqual(
            title,
            "[Replay Attack] in `executeMessage()` allows message replay across chains",
        )

    def test_apply_finding_titles_rewrites_missing_titles(self) -> None:
        findings = apply_finding_titles(
            [{"contract": "Vault", "function": "withdraw", "title": "Untitled"}],
            "Withdrawal Queue Bug",
            "queue manipulation or locked withdrawals",
        )

        self.assertEqual(
            findings[0]["title"],
            "[Withdrawal Queue Bug] in `withdraw()` allows queue manipulation or locked withdrawals",
        )

    def test_domain_agents_no_longer_use_untitled_fallback(self) -> None:
        for directory in TARGET_DIRS:
            for file_path in directory.rglob("*.py"):
                contents = file_path.read_text(encoding="utf-8")
                self.assertNotIn("Untitled", contents, msg=str(file_path))


if __name__ == "__main__":
    unittest.main()
