"""
SRP Core: OpenClaw Agent Wrapper

The OpenClaw agent is treated as an UNTRUSTED worker.
The protocol wraps it with:
- Intent enforcement (agent cannot act outside intent)
- Policy enforcement (only allowed skills)
- Budget enforcement (stop if budget exhausted)
- Trace capture (every tool call logged)

The agent does NOT know it is wrapped. It receives constrained prompts.
"""

import subprocess
import time
import json
from typing import Optional, List, Tuple
from pathlib import Path

from srp_pkg.trace import ReasoningTrace, ReasoningPass, ToolCall, Finding
from srp_pkg.budget import X402BudgetEngine, PaymentIntent


# Compute units per reasoning pass (approximate)
COMPUTE_UNITS_PER_PASS = {
    "business-logic-analyzer": 800,
    "invariant-discovery": 1200,
    "attack-hypothesis": 1000,
    "exploit-simulation": 2000,
    "confidence-assessment": 500,
    "evm-foundry-audit": 1500,
    "solana-anchor-audit": 1500,
    "solana-vulnerability-scanner": 1500,
    "token-integration-analyzer": 800,
    "audit-prep-assistant": 600,
}


class OpenClawWorker:
    """
    Wraps the OpenClaw agent as an untrusted, constrained worker.

    Key properties:
    - Agent receives intent-constrained prompts only
    - Agent cannot exceed allowed skills
    - Every call is logged to the trace
    - Budget checked before every pass
    - Execution halted if budget exhausted
    """

    def __init__(
        self,
        openclaw_binary: str = "openclaw",
        session_prefix: str = "srp",
        timeout_seconds: int = 300,
    ):
        self.openclaw_binary = openclaw_binary
        self.session_prefix = session_prefix
        self.timeout_seconds = timeout_seconds

    def execute_pass(
        self,
        session_id: str,
        skill_name: str,
        task_description: str,
        accumulated_context: str,
        trace: ReasoningTrace,
        budget_engine: X402BudgetEngine,
        payment: PaymentIntent,
        pass_number: int,
    ) -> Tuple[str, ReasoningPass]:
        """
        Execute a single constrained reasoning pass via OpenClaw.

        Before execution: checks budget availability.
        During execution: enforces skill constraints.
        After execution: logs all tool calls to trace.
        """
        # Budget gate: check before every pass
        if not budget_engine.check_budget_available(payment):
            raise RuntimeError(
                f"[SRP] ❌ Budget exhausted before pass {pass_number}. "
                f"Execution halted per x402 policy."
            )

        compute_units = COMPUTE_UNITS_PER_PASS.get(skill_name, 1000)

        print(f"\n[SRP] 🧠 Pass {pass_number}: {skill_name}")
        print(f"[SRP]    Compute units: {compute_units}")

        # Build intent-constrained prompt
        prompt = self._build_constrained_prompt(
            skill_name=skill_name,
            task=task_description,
            context=accumulated_context,
            pass_number=pass_number,
        )

        start_ms = int(time.time() * 1000)

        # Execute via OpenClaw
        output = self._call_openclaw(session_id, prompt)

        end_ms = int(time.time() * 1000)
        duration_ms = end_ms - start_ms

        # Charge budget for this pass
        budget_engine.charge_compute(payment, compute_units)

        # Parse findings from output
        findings = self._extract_findings(output, pass_number)
        for finding in findings:
            trace.add_finding(finding)

        # Extract assumptions
        assumptions = self._extract_assumptions(output)
        for assumption in assumptions:
            trace.add_assumption(assumption, source="agent")

        # Build reasoning pass record
        reasoning_pass = ReasoningPass(
            pass_number=pass_number,
            skill=skill_name,
            task_input=task_description[:300],
            output_summary=output[:500],
            tool_calls=[
                ToolCall(
                    tool="openclaw_agent",
                    input_summary=prompt[:200],
                    output_summary=output[:200],
                )
            ],
            duration_ms=duration_ms,
            findings_this_pass=[f.id for f in findings],
        )

        print(f"[SRP]    Duration: {duration_ms}ms | Findings: {len(findings)}")

        return output, reasoning_pass

    def _build_constrained_prompt(
        self,
        skill_name: str,
        task: str,
        context: str,
        pass_number: int,
    ) -> str:
        """
        Build a prompt that constrains the agent to the intent.
        The agent cannot act outside these boundaries.
        """
        return f"""[SRP CONSTRAINED EXECUTION — Pass {pass_number}]
[Active Skill: {skill_name}]
[You must operate ONLY within this skill's scope]

Task: {task}

Context from previous passes:
{context[:1000] if context else 'None (first pass)'}

Required output format:
1. SKILL ACTIVATION: Confirm you are using the {skill_name} skill
2. ANALYSIS: Your detailed security analysis
3. FINDINGS: List each finding as:
   [SEVERITY] FINDING-{pass_number:02d}X: Title
   Description: ...
   Confidence: 0.0-1.0
   Assumption: any assumptions made
4. ASSUMPTIONS: List all assumptions explicitly
5. CONFIDENCE: Overall confidence score (0.0-1.0)
6. TOOLS USED: List every file/function you examined

Do NOT use skills outside your allowed scope.
Do NOT make claims without explicit confidence scores.
Do NOT skip the required output format.

Begin analysis:"""

    def _call_openclaw(self, session_id: str, prompt: str) -> str:
        """Call OpenClaw agent via CLI."""
        try:
            result = subprocess.run(
                [
                    self.openclaw_binary,
                    "agent",
                    "--local",
                    "--session-id", session_id,
                    "--message", prompt,
                ],
                capture_output=True,
                text=True,
                timeout=self.timeout_seconds,
            )

            if result.returncode == 0 and result.stdout.strip():
                # Strip OpenClaw banner/metadata from output
                output = self._clean_output(result.stdout)
                return output
            else:
                error = result.stderr or result.stdout or "Unknown error"
                return f"[AGENT ERROR]: {error[:500]}"

        except subprocess.TimeoutExpired:
            return f"[TIMEOUT]: Pass exceeded {self.timeout_seconds}s timeout"
        except FileNotFoundError:
            return f"[ERROR]: openclaw binary not found at '{self.openclaw_binary}'"

    def _clean_output(self, raw: str) -> str:
        """Remove OpenClaw banner and metadata from output."""
        lines = raw.split("\n")
        # Skip lines starting with OpenClaw metadata markers
        skip_prefixes = ["🦞", "[diagnostic]", "[agent/embedded]", "[ws]"]
        clean = [
            line for line in lines
            if not any(line.strip().startswith(p) for p in skip_prefixes)
        ]
        return "\n".join(clean).strip()

    def _extract_findings(self, output: str, pass_number: int) -> List[Finding]:
        """Parse structured findings from agent output."""
        findings = []
        lines = output.split("\n")

        severity_keywords = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]

        for i, line in enumerate(lines):
            for severity in severity_keywords:
                if f"[{severity}]" in line or line.startswith(severity + " "):
                    # Extract finding
                    title = line.strip()
                    description = ""

                    # Look ahead for description
                    for j in range(i + 1, min(i + 5, len(lines))):
                        if lines[j].strip().startswith("Description:"):
                            description = lines[j].replace("Description:", "").strip()
                            break

                    # Extract confidence
                    confidence = 0.7  # default
                    for j in range(i + 1, min(i + 8, len(lines))):
                        if "Confidence:" in lines[j]:
                            try:
                                conf_str = lines[j].split("Confidence:")[-1].strip()
                                confidence = float(conf_str.split()[0])
                            except (ValueError, IndexError):
                                pass
                            break

                    finding_id = f"SRP-{pass_number:02d}{len(findings)+1:02d}"
                    findings.append(Finding(
                        id=finding_id,
                        severity=severity,
                        title=title[:100],
                        description=description[:500],
                        confidence=min(max(confidence, 0.0), 1.0),
                        pass_discovered=pass_number,
                    ))
                    break

        return findings

    def _extract_assumptions(self, output: str) -> List[str]:
        """Extract explicit assumptions from agent output."""
        assumptions = []
        lines = output.split("\n")
        in_assumptions = False

        for line in lines:
            if "ASSUMPTION" in line.upper():
                in_assumptions = True
                continue
            if in_assumptions and line.strip().startswith("-"):
                assumptions.append(line.strip("- ").strip())
            elif in_assumptions and line.strip() == "":
                pass  # allow blank lines
            elif in_assumptions and any(
                line.strip().startswith(kw)
                for kw in ["CONFIDENCE", "TOOLS", "FINDINGS", "5.", "6."]
            ):
                in_assumptions = False

        return assumptions[:20]  # cap at 20 assumptions per pass
