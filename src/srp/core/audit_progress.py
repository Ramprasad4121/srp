import json
import os
from pathlib import Path
from datetime import datetime


class AuditProgress:
    """
    The audit memory file. Survives context resets.
    Every agent reads this on start. Every agent writes after each contract.
    Based on Anthropic's long-running agent harness pattern.
    """

    def __init__(self, project_root: str = "."):
        self.root = Path(project_root)
        self.path = self.root / ".srp" / "progress.json"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.data = self._load()

    def _load(self) -> dict:
        if self.path.exists():
            try:
                return json.loads(self.path.read_text())
            except Exception:
                pass
        return {}

    def _save(self):
        self.path.write_text(json.dumps(self.data, indent=2))

    def init_audit(self, audit_id: str, contracts: list, project_name: str):
        """Called once at the start of a new audit."""
        self.data = {
            "audit_id": audit_id,
            "project_name": project_name,
            "started_at": datetime.utcnow().isoformat() + "Z",
            "status": "in_progress",
            "contracts_total": len(contracts),
            "contracts_queue": contracts.copy(),   # still to scan
            "contracts_done": [],                   # fully scanned
            "contracts_failed": [],                 # errored
            "current_phase": "recon",
            "current_contract": None,
            "phases_done": [],
            "findings_by_contract": {},             # contract -> findings list
            "all_findings": [],                     # flat list of all findings
            "agent_handoff_notes": [],              # agents leave notes for next agent
            "last_updated": datetime.utcnow().isoformat() + "Z"
        }
        self._save()

    def next_contract(self) -> str | None:
        """Returns next contract to scan, or None if all done."""
        queue = self.data.get("contracts_queue", [])
        if not queue:
            return None
        contract = queue[0]
        self.data["current_contract"] = contract
        self.data["last_updated"] = datetime.utcnow().isoformat() + "Z"
        self._save()
        return contract

    def complete_contract(self, contract: str, findings: list, agent: str):
        """Mark a contract as done and save its findings."""
        queue = self.data.get("contracts_queue", [])
        if contract in queue:
            queue.remove(contract)
        self.data["contracts_queue"] = queue

        done = self.data.get("contracts_done", [])
        done.append(contract)
        self.data["contracts_done"] = done

        # Save findings
        self.data["findings_by_contract"][contract] = findings
        self.data["all_findings"].extend(findings)

        self.data["last_updated"] = datetime.utcnow().isoformat() + "Z"
        self._save()

    def set_phase(self, phase: str):
        """Update current phase: recon, fork_check, attack, defense, patch, trace"""
        phases_done = self.data.get("phases_done", [])
        current = self.data.get("current_phase")
        if current and current not in phases_done:
            phases_done.append(current)
        self.data["phases_done"] = phases_done
        self.data["current_phase"] = phase
        self.data["last_updated"] = datetime.utcnow().isoformat() + "Z"
        self._save()

    def add_handoff_note(self, from_agent: str, to_agent: str, note: str):
        """
        Agent leaves a note for the next agent.
        Based on Anthropic's 'clean state' pattern.
        Example: 'AttackAlpha found reentrancy in Vault.sol line 45.
                  AttackBeta should focus on flash loan chaining with this.'
        """
        self.data["agent_handoff_notes"].append({
            "from": from_agent,
            "to": to_agent,
            "note": note,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        })
        self.data["last_updated"] = datetime.utcnow().isoformat() + "Z"
        self._save()

    def get_handoff_notes_for(self, agent: str) -> list:
        """Get all notes left for a specific agent."""
        return [
            n for n in self.data.get("agent_handoff_notes", [])
            if n["to"] == agent or n["to"] == "all"
        ]

    def get_summary(self) -> dict:
        """Quick summary for agents to read on startup."""
        return {
            "audit_id":          self.data.get("audit_id"),
            "project":           self.data.get("project_name"),
            "status":            self.data.get("status"),
            "contracts_total":   self.data.get("contracts_total", 0),
            "contracts_done":    len(self.data.get("contracts_done", [])),
            "contracts_remaining": len(self.data.get("contracts_queue", [])),
            "current_phase":     self.data.get("current_phase"),
            "findings_so_far":   len(self.data.get("all_findings", [])),
            "last_updated":      self.data.get("last_updated")
        }

    def complete_audit(self, security_score: int):
        """Mark audit as complete."""
        self.data["status"] = "complete"
        self.data["security_score"] = security_score
        self.data["completed_at"] = datetime.utcnow().isoformat() + "Z"
        self._save()

    def is_complete(self) -> bool:
        return self.data.get("status") == "complete"

    def has_active_audit(self) -> bool:
        return self.data.get("status") == "in_progress"

    def get_all_findings(self) -> list:
        return self.data.get("all_findings", [])

    def trigger_emergency(self, contract: str, findings: list, message: str):
        """Halt audit and mark emergency state."""
        self.data["emergency"] = {
            "triggered": True,
            "contract": contract,
            "message": message,
            "findings": findings,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
        self.data["status"] = "emergency_halt"
        self._save()

    def is_emergency(self) -> bool:
        return self.data.get("emergency", {}).get("triggered", False)
