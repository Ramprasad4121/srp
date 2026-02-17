"""
SRP Core: Reasoning Trace

The trace is THE product of SRP. More important than the final answer.
Every run produces a complete, verifiable, replayable trace.
"""

import hashlib
import json
import uuid
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from pathlib import Path


@dataclass
class ToolCall:
    tool: str
    input_summary: str
    output_summary: str
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


@dataclass
class Assumption:
    statement: str
    source: str  # "user", "agent", "inferred"
    confidence: float  # 0.0 - 1.0


@dataclass
class Finding:
    id: str
    severity: str         # CRITICAL / HIGH / MEDIUM / LOW / INFO
    title: str
    description: str
    confidence: float     # 0.0 - 1.0
    pass_discovered: int
    pass_confirmed: Optional[int] = None
    exploit_poc_path: Optional[str] = None
    references: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "severity": self.severity,
            "title": self.title,
            "description": self.description,
            "confidence": self.confidence,
            "pass_discovered": self.pass_discovered,
            "pass_confirmed": self.pass_confirmed,
            "exploit_poc_path": self.exploit_poc_path,
            "references": self.references,
        }


@dataclass
class ReasoningPass:
    pass_number: int
    skill: str
    task_input: str
    output_summary: str
    tool_calls: List[ToolCall]
    duration_ms: int
    findings_this_pass: List[str] = field(default_factory=list)  # finding IDs

    def to_dict(self) -> dict:
        return {
            "pass_number": self.pass_number,
            "skill": self.skill,
            "task_input": self.task_input[:300],
            "output_summary": self.output_summary[:500],
            "tool_calls": [vars(t) for t in self.tool_calls],
            "duration_ms": self.duration_ms,
            "findings_this_pass": self.findings_this_pass,
        }


class ReasoningTrace:
    """
    First-class artifact produced by every SRP execution.

    Contains everything needed to:
    - Understand what the agent did
    - Verify the output independently
    - Replay the execution
    - Audit the reasoning process
    """

    def __init__(
        self,
        intent_hash: str,
        agent_runtime: str,
        agent_version: str,
        model: str,
        erc8004_agent_id: Optional[int] = None,
    ):
        self.trace_id = str(uuid.uuid4())
        self.intent_hash = intent_hash
        self.agent_runtime = agent_runtime
        self.agent_version = agent_version
        self.model = model
        self.erc8004_agent_id = erc8004_agent_id

        self.started_at = datetime.now(timezone.utc).isoformat()
        self.completed_at: Optional[str] = None

        self.reasoning_passes: List[ReasoningPass] = []
        self.findings: List[Finding] = []
        self.assumptions: List[Assumption] = []

        self.input_hash: str = ""
        self.output_hash: str = ""
        self.confidence: float = 0.0

        self.compute_units_used: int = 0
        self.cost_usdc: float = 0.0
        self.x402_payment_tx: Optional[str] = None
        self.erc8004_approval_tx: Optional[str] = None

    def set_input_hash(self, input_content: str):
        self.input_hash = "0x" + hashlib.sha256(input_content.encode()).hexdigest()

    def add_pass(self, reasoning_pass: ReasoningPass):
        self.reasoning_passes.append(reasoning_pass)

    def add_finding(self, finding: Finding):
        self.findings.append(finding)

    def add_assumption(self, statement: str, source: str = "agent", confidence: float = 0.8):
        self.assumptions.append(Assumption(statement, source, confidence))

    def finalize(self, final_output: str):
        """Call after all reasoning passes complete."""
        self.completed_at = datetime.now(timezone.utc).isoformat()
        self.output_hash = "0x" + hashlib.sha256(final_output.encode()).hexdigest()
        self.confidence = self._compute_confidence()

    def _compute_confidence(self) -> float:
        if not self.findings:
            return 0.5
        confirmed = [f for f in self.findings if f.pass_confirmed is not None]
        if not confirmed:
            return 0.4
        return sum(f.confidence for f in confirmed) / len(confirmed)

    def verify(self, expected_output: str) -> bool:
        """Independently verify output matches trace."""
        expected_hash = "0x" + hashlib.sha256(expected_output.encode()).hexdigest()
        return self.output_hash == expected_hash

    def to_dict(self) -> dict:
        return {
            "srp_version": "0.1",
            "trace_id": self.trace_id,
            "intent_hash": self.intent_hash,
            "agent": {
                "runtime": self.agent_runtime,
                "version": self.agent_version,
                "model": self.model,
                "erc8004_agent_id": self.erc8004_agent_id,
            },
            "execution": {
                "started_at": self.started_at,
                "completed_at": self.completed_at,
                "input_hash": self.input_hash,
                "output_hash": self.output_hash,
                "confidence": self.confidence,
                "compute_units_used": self.compute_units_used,
                "cost_usdc": self.cost_usdc,
            },
            "chain": {
                "erc8004_approval_tx": self.erc8004_approval_tx,
                "x402_payment_tx": self.x402_payment_tx,
            },
            "reasoning_passes": [p.to_dict() for p in self.reasoning_passes],
            "findings": [f.to_dict() for f in self.findings],
            "assumptions": [vars(a) for a in self.assumptions],
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent)

    def save(self, path: str):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w") as f:
            f.write(self.to_json())
        return path

    def summary(self) -> str:
        critical = sum(1 for f in self.findings if f.severity == "CRITICAL")
        high = sum(1 for f in self.findings if f.severity == "HIGH")
        medium = sum(1 for f in self.findings if f.severity == "MEDIUM")
        return (
            f"\n{'='*60}\n"
            f"SRP Trace Summary\n"
            f"{'='*60}\n"
            f"Trace ID     : {self.trace_id[:16]}...\n"
            f"Intent Hash  : {self.intent_hash[:16]}...\n"
            f"Output Hash  : {self.output_hash[:16]}...\n"
            f"Confidence   : {self.confidence:.2%}\n"
            f"Passes       : {len(self.reasoning_passes)}\n"
            f"Findings     : 🔴 {critical} Critical | 🟠 {high} High | 🟡 {medium} Medium\n"
            f"Assumptions  : {len(self.assumptions)}\n"
            f"Cost         : ${self.cost_usdc:.4f} USDC\n"
            f"{'='*60}"
        )
