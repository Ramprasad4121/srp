import re
from typing import Optional


class SRPGuardrails:
    """
    Layered guardrails for SRP agents.
    Based on OpenAI's layered defense pattern.
    Layer 1: Rules-based (fast, no LLM)
    Layer 2: Content validation
    Layer 3: Output validation
    """

    # ── LAYER 1: INPUT GUARDRAILS (rules-based, instant) ─────────────────────

    @staticmethod
    def is_valid_solidity(source: str) -> tuple[bool, str]:
        """Check if input is actually Solidity code."""
        if not source or not source.strip():
            return False, "Empty input"
        if len(source) > 500_000:
            return False, "Contract too large (>500KB)"
        solidity_markers = ["pragma solidity", "contract ", "interface ", "library "]
        if not any(marker in source for marker in solidity_markers):
            return False, "Does not appear to be Solidity code"
        return True, "ok"

    @staticmethod
    def is_safe_path(path: str) -> tuple[bool, str]:
        """Prevent path traversal attacks in tool calls."""
        if ".." in path:
            return False, "Path traversal detected"
        if path.startswith("/etc") or path.startswith("/root"):
            return False, "Access to system paths not allowed"
        dangerous = ["/etc/passwd", "/etc/shadow", "~/.ssh", ".env"]
        for d in dangerous:
            if d in path:
                return False, f"Dangerous path pattern: {d}"
        return True, "ok"

    @staticmethod
    def is_prompt_injection(text: str) -> tuple[bool, str]:
        """Detect prompt injection attempts in contract code."""
        injection_patterns = [
            r"ignore (all |previous |above )instructions",
            r"you are now",
            r"forget your (instructions|rules|guidelines)",
            r"system prompt",
            r"reveal your instructions",
            r"act as (a |an )?(?!contract|token|vault)",
        ]
        text_lower = text.lower()
        for pattern in injection_patterns:
            if re.search(pattern, text_lower):
                return True, f"Prompt injection pattern detected: {pattern}"
        return False, "ok"

    @staticmethod
    def check_contract_input(source: str) -> tuple[bool, str]:
        """Full input guardrail check — run before passing to any agent."""
        valid, msg = SRPGuardrails.is_valid_solidity(source)
        if not valid:
            return False, f"Invalid input: {msg}"
        injected, msg = SRPGuardrails.is_prompt_injection(source)
        if injected:
            return False, f"Security violation: {msg}"
        return True, "ok"

    # ── LAYER 2: OUTPUT GUARDRAILS (validate agent findings) ─────────────────

    @staticmethod
    def validate_finding(finding: dict) -> tuple[bool, str]:
        """
        Ensure agent findings are grounded — not hallucinated.
        A finding must have a line reference or function name to be valid.
        """
        required = ["title", "severity", "description"]
        for field in required:
            if not finding.get(field):
                return False, f"Finding missing required field: {field}"

        valid_severities = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]
        if finding.get("severity", "").upper() not in valid_severities:
            return False, f"Invalid severity: {finding.get('severity')}"

        has_code_ref = (
            finding.get("affected_function")
            or finding.get("line_number")
            or finding.get("code_snippet")
            or finding.get("exploit_code_solidity")
        )
        if not has_code_ref:
            return False, "Finding has no code reference — likely hallucinated"

        confidence = finding.get("confidence", 0)
        if isinstance(confidence, (int, float)) and confidence < 0.3:
            return False, f"Confidence too low ({confidence}) — skip"

        return True, "ok"

    @staticmethod
    def filter_findings(findings: list) -> tuple[list, list]:
        """
        Filter a list of findings.
        Returns (valid_findings, rejected_findings).
        """
        valid = []
        rejected = []
        for f in findings:
            ok, reason = SRPGuardrails.validate_finding(f)
            if ok:
                valid.append(f)
            else:
                rejected.append({**f, "_rejected_reason": reason})
        return valid, rejected

    # ── LAYER 3: TOOL GUARDRAILS (before executing shell commands) ────────────

    @staticmethod
    def is_safe_shell_command(cmd: str) -> tuple[bool, str]:
        """
        Rate tool risk before execution.
        Based on OpenAI's tool risk rating pattern.
        """
        blocked = ["rm -rf", "dd if=", "mkfs", "> /dev/", "chmod 777 /",
                   "curl | bash", "wget | sh", "eval ", "exec "]
        for b in blocked:
            if b in cmd:
                return False, f"Dangerous command blocked: {b}"

        write_ops = ["rm ", "mv ", "cp ", "mkdir", "touch", "> ", ">> "]
        for w in write_ops:
            if w in cmd and "/srp" not in cmd and ".srp" not in cmd:
                pass

        return True, "ok"
