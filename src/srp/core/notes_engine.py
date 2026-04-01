from __future__ import annotations
import os
from pathlib import Path
from typing import Dict, List, Any

class NotesEngine:
    """Manages the structured /audit-notes/ directory for expert audit context."""
    
    FILES = {
        "00_overview.md": "what the protocol does in 3 sentences",
        "01_architecture.md": "system map, contracts, trust model",
        "02_value_flows.md": "how money moves",
        "03_roles_permissions.md": "who can call what",
        "04_invariants.md": "what must ALWAYS be true",
        "05_attack_hypotheses.md": "my hunting list",
        "06_findings": "FINDING-XXX.md files",
        "07_questions.md": "things I don't understand yet"
    }

    def __init__(self, project_root: str):
        self.root = Path(project_root) / "audit-notes"
        self._initialize_structure()

    def _initialize_structure(self):
        self.root.mkdir(parents=True, exist_ok=True)
        (self.root / "06_findings").mkdir(exist_ok=True)
        
        for filename, description in self.FILES.items():
            if filename == "06_findings":
                continue
            path = self.root / filename
            if not path.exists():
                path.write_text(f"# {filename}\n> {description}\n\n", encoding="utf-8")

    def write_note(self, filename: str, content: str, append: bool = True):
        path = self.root / filename
        mode = "a" if append else "w"
        with open(path, mode, encoding="utf-8") as f:
            f.write(content + "\n")

    def add_finding(self, finding_id: str, content: str):
        path = self.root / "06_findings" / f"{finding_id}.md"
        path.write_text(content, encoding="utf-8")

    def get_all_notes(self) -> Dict[str, str]:
        notes = {}
        for filename in self.FILES:
            if filename == "06_findings":
                continue
            path = self.root / filename
            notes[filename] = path.read_text(encoding="utf-8")
        return notes
