from __future__ import annotations

import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class SkillNotFoundError(Exception):
    def __init__(self, missing_key: str, message: str | None = None) -> None:
        detail = message or f"Skill not found: {missing_key}"
        super().__init__(detail)
        self.missing_key = missing_key


class SkillLoader:
    SKILL_REGISTRY = {
        # ATTACK ALPHA skills
        "audit-firm-1-solidity-auditor": "skills/audit-firm-1/solidity-auditor/SKILL.md",
        "quillai-bsa": "skills/quillai/plugins/behavioral-state-analysis/skills/behavioral-state-analysis/SKILL.md",
        "quillai-semantic-guard": "skills/quillai/plugins/semantic-guard-analysis/skills/semantic-guard-analysis/SKILL.md",
        "quillai-state-invariant": "skills/quillai/plugins/state-invariant-detection/skills/state-invariant-detection/SKILL.md",
        # ATTACK BETA skills
        "quillai-reentrancy": "skills/quillai/plugins/reentrancy-pattern-analysis/skills/reentrancy-pattern-analysis/SKILL.md",
        "quillai-oracle-flashloan": "skills/quillai/plugins/oracle-flashloan-analysis/skills/oracle-flashloan-analysis/SKILL.md",
        "quillai-proxy-upgrade": "skills/quillai/plugins/proxy-upgrade-safety/skills/proxy-upgrade-safety/SKILL.md",
        "ethskills-audit": "skills/ethskills/audit.md",
        "tob-building-secure": "skills/trailofbits/plugins/building-secure-contracts/skills/building-secure-contracts/SKILL.md",
        # ATTACK GAMMA skills
        "quillai-signature-replay": "skills/quillai/plugins/signature-replay-analysis/skills/signature-replay-analysis/SKILL.md",
        "quillai-dos-griefing": "skills/quillai/plugins/dos-griefing-analysis/skills/dos-griefing-analysis/SKILL.md",
        "quillai-external-call": "skills/quillai/plugins/external-call-safety/skills/external-call-safety/SKILL.md",
        "quillai-input-arithmetic": "skills/quillai/plugins/input-arithmetic-safety/skills/input-arithmetic-safety/SKILL.md",
        "scv-scan": "skills/scv-scan/SKILL.md",
        "scv-scan-cheatsheet": "skills/scv-scan/references/CHEATSHEET.md",
        # DEFENSE skills
        "tob-spec-compliance": "skills/trailofbits/plugins/spec-to-code-compliance/skills/spec-to-code-compliance/SKILL.md",
        "tob-fix-review": "skills/trailofbits/plugins/fix-review/skills/fix-review/SKILL.md",
        # PATCH skills
        "cyfrin-solskill": "skills/cyfrin/solskill/skills/solidity/SKILL.md",
        "ethskills-security": "skills/ethskills/security.md",
        "ethskills-testing": "skills/ethskills/testing.md",
        # RECON skills
        "sc-auditor-skill": "skills/sc-auditor/security-auditor/SKILL.md",
        "tob-entry-point": "skills/trailofbits/plugins/entry-point-analyzer/skills/entry-point-analyzer/SKILL.md",
        "tob-audit-context": "skills/trailofbits/plugins/audit-context-building/skills/audit-context-building/SKILL.md",
        # DIFF skills
        "tob-differential-review": "skills/trailofbits/plugins/differential-review/skills/differential-review/SKILL.md",
        # BLAST RADIUS skills
        "tob-variant-analysis": "skills/trailofbits/plugins/variant-analysis/skills/variant-analysis/SKILL.md",
        # ORCHESTRATOR skills
        "ethskills-standards": "skills/ethskills/standards.md",
        "ethskills-concepts": "skills/ethskills/concepts.md",
    }

    def __init__(self, root_dir: str | Path | None = None) -> None:
        self.root_dir = Path(root_dir) if root_dir is not None else Path(__file__).resolve().parents[1]

    def load(self, skill_key: str) -> str:
        rel_path = self.SKILL_REGISTRY.get(skill_key)
        if rel_path is None:
            raise SkillNotFoundError(skill_key, f"Skill key is not registered: {skill_key}")

        skill_path = self.root_dir / rel_path
        if not skill_path.exists():
            raise SkillNotFoundError(
                skill_key, f"Skill file is missing for key '{skill_key}': {skill_path}"
            )
        if not skill_path.is_file():
            raise SkillNotFoundError(
                skill_key, f"Skill path is not a file for key '{skill_key}': {skill_path}"
            )

        try:
            return skill_path.read_text(encoding="utf-8")
        except OSError as exc:
            raise SkillNotFoundError(
                skill_key, f"Failed to read skill file for key '{skill_key}': {exc}"
            ) from exc

    def load_many(self, skill_keys: list[str]) -> str:
        blocks: list[str] = []
        for key in skill_keys:
            content = self.load(key)
            blocks.append(f"# === SKILL: {key} ===\n\n{content}")
        return "\n\n".join(blocks)

    def list_all(self) -> list[str]:
        return list(self.SKILL_REGISTRY.keys())

    def get_git_hash(self, repo_folder: str) -> str:
        repo_path = self.root_dir / "skills-repos" / repo_folder
        if not repo_path.exists() or not repo_path.is_dir():
            raise SkillNotFoundError(
                repo_folder, f"skills-repos folder not found for repo '{repo_folder}': {repo_path}"
            )

        try:
            result = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=repo_path,
                check=True,
                capture_output=True,
                text=True,
            )
        except (FileNotFoundError, subprocess.CalledProcessError) as exc:
            raise SkillNotFoundError(
                repo_folder, f"Failed to read git hash for repo '{repo_folder}': {exc}"
            ) from exc

        git_hash = result.stdout.strip()
        if not git_hash:
            raise SkillNotFoundError(repo_folder, f"Empty git hash for repo '{repo_folder}'")
        return git_hash

    def get_manifest(self) -> dict[str, Any]:
        manifest_items: list[dict[str, Any]] = []
        for key, rel_path in self.SKILL_REGISTRY.items():
            repo_folder = self._repo_folder_from_path(rel_path)
            git_hash = self.get_git_hash(repo_folder) if repo_folder else None
            manifest_items.append(
                {
                    "key": key,
                    "path": rel_path,
                    "git_hash": git_hash,
                }
            )

        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "skills": manifest_items,
        }

    @staticmethod
    def _repo_folder_from_path(skill_path: str) -> str | None:
        if skill_path.startswith("skills/audit-firm-1/"):
            return "audit-firm-1"
        if skill_path.startswith("skills/quillai/"):
            return "quillai"
        if skill_path.startswith("skills/trailofbits/"):
            return "trailofbits"
        if skill_path.startswith("skills/sc-auditor/"):
            return "sc-auditor"
        if skill_path.startswith("skills/scv-scan/"):
            return "scv-scan"
        if skill_path.startswith("skills/cyfrin/"):
            return "cyfrin"
        return None
