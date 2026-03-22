"""
core/v2/memory.py
Persistent Memory Architecture for SRP V2 Agents.
Implements Episodic Memory (time-series conversation & tool history) 
and Procedural Memory (JSON state persistence).
"""
import json
import logging
import uuid
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class MemoryManager:
    """
    Manages structured memory for agents as outlined in the OpenClaw / Web3 Agentic
    Research Paradigm. Separates Episodic (history) from Procedural (schema/state).
    """
    def __init__(self, run_id: str, base_dir: Path = Path(".srp/memory")):
        self.run_id = run_id
        self.base_dir = base_dir
        self.episodic_path = self.base_dir / "episodic" / f"{self.run_id}.jsonl"
        self.procedural_path = self.base_dir / "procedural" / "global.json"
        
        self.base_dir.mkdir(parents=True, exist_ok=True)
        (self.base_dir / "episodic").mkdir(exist_ok=True)
        (self.base_dir / "procedural").mkdir(exist_ok=True)
        
        self.episodic_buffer: List[Dict[str, Any]] = []

    # ── Episodic Memory (Time-series / Tool invocations) ──

    def log_episode(self, role: str, content: str, metadata: Optional[Dict] = None):
        """Log a discrete event (e.g., actor thought, tool output, reflexion feedback)."""
        entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "role": role,
            "content": content,
        }
        if metadata:
            entry["metadata"] = metadata
            
        self.episodic_buffer.append(entry)
        
        # Append to persistent JSONL
        with open(self.episodic_path, "a") as f:
            f.write(json.dumps(entry) + "\n")
            
    def get_recent_episodes(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Retrieve the most recent N episodes."""
        return self.episodic_buffer[-limit:]
        
    def get_evaluator_feedback(self) -> List[str]:
        """Extract explicit reflexion feedback from evaluator episodes."""
        return [
            ep["content"] for ep in self.episodic_buffer 
            if ep["role"] == "self_reflection"
        ]

    # ── Procedural Memory (State / Schema / Configs) ──

    def save_state(self, key: str, value: Any):
        """Save persistent procedural state across multiple runs."""
        state = self._load_procedural()
        state[key] = value
        
        with open(self.procedural_path, "w") as f:
            json.dump(state, f, indent=2)
            
    def load_state(self, key: str, default: Any = None) -> Any:
        state = self._load_procedural()
        return state.get(key, default)
        
    def _load_procedural(self) -> Dict[str, Any]:
        if not self.procedural_path.exists():
            return {}
        try:
            with open(self.procedural_path, "r") as f:
                return json.load(f)
        except Exception:
            return {}
