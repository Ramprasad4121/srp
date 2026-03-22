"""
SRP Core: Execution Intent

Every SRP execution begins with an explicit, hashable, replayable intent.
The agent MUST NEVER act outside this intent.
"""

import hashlib
import json
import uuid
from dataclasses import dataclass, field, asdict
from typing import List, Optional
from datetime import datetime, timezone
from pathlib import Path


@dataclass
class ExecutionIntent:
    """
    Explicit, machine-verifiable, hashable, replayable execution intent.
    
    The agent must never act outside the boundaries defined here.
    Every field is part of the commitment hash.
    """

    # Required fields
    task: str
    inputs: List[str]
    allowed_skills: List[str]
    max_reasoning_depth: int
    budget_usdc: float

    # Optional constraints
    privacy_mode: bool = False
    human_in_loop: bool = True
    max_tool_calls: int = 50
    chain_context: Optional[str] = None   # e.g. "ethereum", "solana"
    protocol_context: Optional[str] = None  # e.g. "lending", "dex"

    # Protocol metadata
    version: str = "srp-0.1"
    intent_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    intent_hash: str = field(default="")

    # ERC-8004 fields
    erc8004_agent_id: Optional[int] = None
    erc8004_registry: Optional[str] = None

    def __post_init__(self):
        self.intent_hash = self._compute_hash()

    def _compute_hash(self) -> str:
        """
        Deterministic hash of all execution parameters.
        Used for ERC-8004 approval and x402 payment reference.
        """
        commitment = {
            "version": self.version,
            "task": self.task,
            "inputs": sorted(self.inputs),
            "allowed_skills": sorted(self.allowed_skills),
            "max_reasoning_depth": self.max_reasoning_depth,
            "budget_usdc": str(self.budget_usdc),
            "privacy_mode": self.privacy_mode,
            "max_tool_calls": self.max_tool_calls,
        }
        content = json.dumps(commitment, sort_keys=True, separators=(",", ":"))
        return "0x" + hashlib.sha256(content.encode()).hexdigest()

    def validate(self) -> tuple[bool, str]:
        """Validate intent before submission."""
        if not self.task or not self.task.strip():
            return False, "task cannot be empty"
        if not self.inputs:
            return False, "inputs cannot be empty"
        if not self.allowed_skills:
            return False, "allowed_skills cannot be empty"
        if self.max_reasoning_depth < 1 or self.max_reasoning_depth > 5:
            return False, "max_reasoning_depth must be 1-5"
        if self.budget_usdc <= 0:
            return False, "budget_usdc must be positive"
        if self.budget_usdc > 1000:
            return False, "budget_usdc exceeds safety limit of $1000"
        return True, "valid"

    def to_dict(self) -> dict:
        return asdict(self)

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent)

    def save(self, path: str):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w") as f:
            f.write(self.to_json())

    @classmethod
    def from_json(cls, path: str) -> "ExecutionIntent":
        with open(path) as f:
            data = json.load(f)
        # Remove computed field before reconstruction
        data.pop("intent_hash", None)
        return cls(**data)

    def __str__(self) -> str:
        return (
            f"ExecutionIntent(\n"
            f"  id={self.intent_id[:8]}...\n"
            f"  hash={self.intent_hash[:16]}...\n"
            f"  task={self.task[:60]}\n"
            f"  skills={self.allowed_skills}\n"
            f"  depth={self.max_reasoning_depth}\n"
            f"  budget=${self.budget_usdc} USDC\n"
            f")"
        )
