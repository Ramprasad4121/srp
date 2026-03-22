import os
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List

class MarkdownVault:
    """
    OpenClaw-style Transparent Memory Vault.
    Maintains a durable, human-readable `MEMORY.md` file charting all major agent operations and state changes.
    Used for both human debugging and agent long-term context compaction.
    """
    
    def __init__(self, project_root: str, vault_name: str = "MEMORY.md"):
        self.project_root = Path(project_root)
        self.srp_dir = self.project_root / ".srp"
        self.vault_file = self.srp_dir / vault_name
        self._ensure_exists()

    def _ensure_exists(self):
        self.srp_dir.mkdir(parents=True, exist_ok=True)
        if not self.vault_file.exists():
            with open(self.vault_file, "w") as f:
                f.write("# SRP Swarm Memory Vault\n\n")
                f.write("> Auto-generated persistent context log for the audit swarm.\n\n")

    def log_event(self, agent_name: str, event_type: str, details: Dict[str, Any]):
        """
        Appends an event log to the vault in markdown format.
        Takes advantage of the `LaneQueueManager` if called from concurrent swarms.
        """
        timestamp = datetime.now().isoformat(timespec='seconds')
        
        # Prepare content
        md_entry = f"## [{timestamp}] 🤖 {agent_name} | Event: {event_type}\n"
        
        for key, value in details.items():
            if isinstance(value, str) and len(value) > 200:
                 md_entry += f"**{key}**: <details><summary>Expand</summary>\n\n```\n{value[:1000]}...\n```\n</details>\n"
            else:
                 md_entry += f"- **{key}**: `{json.dumps(value, default=str)}`\n"
                 
        md_entry += "\n---\n"
        
        # Write to file
        with open(self.vault_file, "a", encoding="utf-8") as f:
            f.write(md_entry)

    def compact(self, max_lines: int = 1000):
        """
        Reads the memory file, and if it's too long, truncates the older entries while keeping a 'Summary' header.
        In a full implementation, an LLM call would generate the summary.
        For now, we just physically compact to keep context window bounds strict.
        """
        if not self.vault_file.exists():
            return
            
        with open(self.vault_file, "r", encoding="utf-8") as f:
            lines = f.readlines()
            
        if len(lines) <= max_lines + 10:  # Buffer
            return
            
        # Keep the header and the last N lines
        compacted = lines[:4] + ["\n> `[MEMORY COMPACTED due to length]`\n\n"] + lines[-max_lines:]
        
        with open(self.vault_file, "w", encoding="utf-8") as f:
            f.writelines(compacted)

    def read_recent(self, num_events: int = 5) -> str:
        """Reads the tail of the markdown file for immediate agent context injection."""
        if not self.vault_file.exists():
            return ""
        try:
            with open(self.vault_file, "r", encoding="utf-8") as f:
                content = f.read()
                # Simple split by the event separator
                events = content.split("\n---\n")
                if len(events) <= num_events + 1:
                     return content
                recent = "\n---\n".join(events[-(num_events+1):])
                return "# Recent Memory Vault Events\n" + recent
        except Exception:
            return ""
