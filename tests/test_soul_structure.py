import unittest

from core.skill_loader import SkillLoader


class SoulStructureTests(unittest.TestCase):
    def test_watchdog_soul_has_required_sections_and_loads_via_registry(self) -> None:
        soul = SkillLoader().load_soul("SentinelAgent")

        self.assertIn("## WHO YOU ARE", soul)
        self.assertIn("## YOUR HUNTING GROUND", soul)
        self.assertIn("## YOUR METHODOLOGY", soul)
        self.assertIn("## YOUR STANDARDS", soul)
        self.assertIn("## YOUR PHILOSOPHY", soul)
        self.assertIn("WATCHDOG", soul)

    def test_oracle_soul_has_required_sections_and_loads_via_registry(self) -> None:
        soul = SkillLoader().load_soul("ThreatIntelAgent")

        self.assertIn("## WHO YOU ARE", soul)
        self.assertIn("## YOUR HUNTING GROUND", soul)
        self.assertIn("## YOUR METHODOLOGY", soul)
        self.assertIn("## YOUR STANDARDS", soul)
        self.assertIn("## YOUR PHILOSOPHY", soul)
        self.assertIn("ORACLE", soul)

    def test_spider_soul_has_required_sections_and_loads_via_registry(self) -> None:
        soul = SkillLoader().load_soul("GraphAgent")

        self.assertIn("## WHO YOU ARE", soul)
        self.assertIn("## YOUR HUNTING GROUND", soul)
        self.assertIn("## YOUR METHODOLOGY", soul)
        self.assertIn("## YOUR STANDARDS", soul)
        self.assertIn("## YOUR PHILOSOPHY", soul)
        self.assertIn("SPIDER", soul)

    def test_viper_soul_has_required_sections_and_loads_via_registry(self) -> None:
        soul = SkillLoader().load_soul("AttackAgentAlpha")
        self.assertIn("## WHO YOU ARE", soul)
        self.assertIn("## YOUR HUNTING GROUND", soul)
        self.assertIn("## YOUR METHODOLOGY", soul)
        self.assertIn("## YOUR STANDARDS", soul)
        self.assertIn("## YOUR PHILOSOPHY", soul)
        self.assertIn("VIPER", soul)

    def test_ghost_soul_has_required_sections_and_loads_via_registry(self) -> None:
        soul = SkillLoader().load_soul("AttackAgentBeta")
        self.assertIn("## WHO YOU ARE", soul)
        self.assertIn("## YOUR HUNTING GROUND", soul)
        self.assertIn("## YOUR METHODOLOGY", soul)
        self.assertIn("## YOUR STANDARDS", soul)
        self.assertIn("## YOUR PHILOSOPHY", soul)
        self.assertIn("GHOST", soul)

    def test_zero_soul_has_required_sections_and_loads_via_registry(self) -> None:
        soul = SkillLoader().load_soul("AttackAgentGamma")
        self.assertIn("## WHO YOU ARE", soul)
        self.assertIn("## YOUR HUNTING GROUND", soul)
        self.assertIn("## YOUR METHODOLOGY", soul)
        self.assertIn("## YOUR STANDARDS", soul)
        self.assertIn("## YOUR PHILOSOPHY", soul)
        self.assertIn("ZERO", soul)

    def test_shield_soul_has_required_sections_and_loads_via_registry(self) -> None:
        soul = SkillLoader().load_soul("DefenseAgent")
        self.assertIn("## WHO YOU ARE", soul)
        self.assertIn("## YOUR HUNTING GROUND", soul)
        self.assertIn("## YOUR METHODOLOGY", soul)
        self.assertIn("## YOUR STANDARDS", soul)
        self.assertIn("## YOUR PHILOSOPHY", soul)
        self.assertIn("SHIELD", soul)

    def test_forge_soul_has_required_sections_and_loads_via_registry(self) -> None:
        soul = SkillLoader().load_soul("PatchAgent")
        self.assertIn("## WHO YOU ARE", soul)
        self.assertIn("## YOUR HUNTING GROUND", soul)
        self.assertIn("## YOUR METHODOLOGY", soul)
        self.assertIn("## YOUR STANDARDS", soul)
        self.assertIn("## YOUR PHILOSOPHY", soul)
        self.assertIn("FORGE", soul)


if __name__ == "__main__":
    unittest.main()
