from __future__ import annotations
from typing import Any, Dict, List
from uuid import uuid4
from pathlib import Path

class SRPStore:
    """Handles state and persistence for the SRP Orchestrator."""
    def __init__(self):
        self.current_run_id = uuid4().hex
        self.context: Dict[str, Any] = {}
        self.findings: List[Dict[str, Any]] = []
        self.metadata: Dict[str, Any] = {}

    def initialize_run(self, project_root: str, project_name: str):
        self.current_run_id = uuid4().hex
        self.metadata = {
            "project_root": project_root,
            "project_name": project_name,
            "start_time": None, # Set by orchestrator
        }

    def update_context(self, updates: Dict[str, Any]):
        self.context.update(updates)

    def add_finding(self, finding: Dict[str, Any]):
        if "id" not in finding:
            finding["id"] = uuid4().hex
        self.findings.append(finding)

    def get_context(self) -> Dict[str, Any]:
        return self.context

    def get_findings(self) -> List[Dict[str, Any]]:
        return self.findings
