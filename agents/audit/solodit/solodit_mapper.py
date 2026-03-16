"""
SoloditMapper — Maps Solodit findings to functions in the current codebase.

Threat model: incorrect function mapping, false positives, missing matches
"""
from __future__ import annotations

import re
from typing import Any

from agents.base_agent import BaseAgent


class SoloditMapper(BaseAgent):
    """Maps Solodit findings to current contract functions."""

    def __init__(self, model: str = "meta/llama-3.1-405b-instruct") -> None:
        super().__init__(
            name="SoloditMapper",
            role="Solodit intelligence — maps findings to current code",
            skill_keys=["audit-firm-1-solidity-auditor"],
            model=model,
        )
        self.amm_skill = self._load_amm_skill()

    def _load_amm_skill(self) -> str:
        """Load the AMM domain skill file."""
        skill_path = Path(__file__).resolve().parents[3] / "skills" / "domains" / "amm.md"
        if skill_path.is_file():
            return skill_path.read_text(encoding="utf-8")
        return ""

    async def run(self, context: dict) -> dict:
        """Run Solodit mapping phase.

        Args:
            context: Pipeline context with contract_map, recon_output, protocol_intent, etc.
            solodit_findings: List of findings from SoloditFetcher

        Returns:
            Dict with 'mapped_findings' list containing (finding, matching_functions) pairs.
        """
        self.log_step("solodit_mapping_started", {"context_keys": list(context.keys())})

        contract_map = context.get("contract_map", {})
        solodit_findings = context.get("solodit_findings", [])

        if not solodit_findings:
            return {"mapped_findings": []}

        # Build contract source summary
        if isinstance(contract_map, dict):
            contract_source = "\n".join(
                f"--- {name} ---\n{code[:3000]}" for name, code in contract_map.items()
            )
        else:
            contract_source = str(contract_map)[:8000]

        # Extract function signatures and patterns from current code
        function_patterns = self._extract_function_patterns(contract_source)

        # Map each Solodit finding to matching functions
        mapped_findings = []
        for finding in solodit_findings:
            matching_functions = self._find_matching_functions(finding, function_patterns)
            if matching_functions:
                mapped_findings.append({
                    "solodit_finding": finding,
                    "matching_functions": matching_functions,
                    "confidence_score": self._calculate_confidence(finding, matching_functions),
                })

        self.log_step("solodit_mapping_completed", {
            "mapped_count": len(mapped_findings),
            "total_findings": len(solodit_findings),
        })
        return {"mapped_findings": mapped_findings}

    def _extract_function_patterns(self, contract_source: str) -> list[dict]:
        """Extract function patterns from contract source."""
        # Extract function signatures
        functions = re.findall(r"function\\s+(\\w+)\\s*\\([^)]*\\)", contract_source)

        # Extract modifiers
        modifiers = re.findall(r"modifier\\s+(\\w+)(?:\\s*\\([^)]*\\))?", contract_source)

        # Extract state variables
        state_vars = re.findall(r"(\\w+)\\s+(\\w+)\\s*(?:\\[[^)]*\\])?\\s*;", contract_source)

        # Extract event signatures
        events = re.findall(r"event\\s+(\\w+)\\s*\\([^)]*\\)", contract_source)

        return {
            "functions": functions,
            "modifiers": modifiers,
            "state_vars": state_vars,
            "events": events,
            "contract_source": contract_source[:1000],  # First 1000 chars for context
        }

    def _find_matching_functions(self, finding: dict, patterns: dict) -> list[dict]:
        """Find matching functions for a Solodit finding."""
        title = finding.get("title", "").lower()
        description = finding.get("description", "").lower()
        contract_source = patterns.get("contract_source", "")

        matching_functions = []

        # Check function names
        for func_name in patterns.get("functions", []):
            if self._is_relevant(func_name, title, description):
                matching_functions.append({
                    "type": "function",
                    "name": func_name,
                    "relevance": self._calculate_relevance(func_name, title, description),
                })

        # Check modifiers
        for mod_name in patterns.get("modifiers", []):
            if self._is_relevant(mod_name, title, description):
                matching_functions.append({
                    "type": "modifier",
                    "name": mod_name,
                    "relevance": self._calculate_relevance(mod_name, title, description),
                })

        # Check state variables
        for var_name, var_type in patterns.get("state_vars", []):
            if self._is_relevant(var_name, title, description):
                matching_functions.append({
                    "type": "state_variable",
                    "name": var_name,
                    "type": var_type,
                    "relevance": self._calculate_relevance(var_name, title, description),
                })

        # Check events
        for event_name in patterns.get("events", []):
            if self._is_relevant(event_name, title, description):
                matching_functions.append({
                    "type": "event",
                    "name": event_name,
                    "relevance": self._calculate_relevance(event_name, title, description),
                })

        # Sort by relevance
        matching_functions.sort(key=lambda x: x["relevance"], reverse=True)
        return matching_functions[:5]  # Return top 5 matches

    def _is_relevant(self, name: str, title: str, description: str) -> bool:
        """Check if a name is relevant to the finding."""
        name_lower = name.lower()
        title_lower = title.lower()
        desc_lower = description.lower()

        # Check for direct matches
        if name_lower in title_lower or name_lower in desc_lower:
            return True

        # Check for semantic similarity
        security_terms = [
            "reentrancy", "access", "control", "overflow", "underflow",
            "integer", "delegatecall", "call", "transfer", "approve",
            "external", "internal", "public", "private", "view", "pure",
            "payable", "nonpayable", "fallback", "receive", "constructor",
            "modifier", "require", "assert", "revert", "panic", "error",
            "unchecked", "unchecked", "unchecked", "unchecked", "unchecked",
            "unchecked", "unchecked", "unchecked", "unchecked", "unchecked",
            "unchecked", "unchecked", "unchecked", "unchecked", "unchecked",
        ]

        for term in security_terms:
            if term in name_lower and (term in title_lower or term in desc_lower):
                return True

        return False

    def _calculate_relevance(self, name: str, title: str, description: str) -> int:
        """Calculate relevance score (0-100)."""
        name_lower = name.lower()
        title_lower = title.lower()
        desc_lower = description.lower()

        score = 0

        # Direct name match
        if name_lower in title_lower:
            score += 30
        elif name_lower in desc_lower:
            score += 20

        # Term overlap
        security_terms = [
            "reentrancy", "access", "control", "overflow", "underflow",
            "integer", "delegatecall", "call", "transfer", "approve",
            "external", "internal", "public", "private", "view", "pure",
            "payable", "nonpayable", "fallback", "receive", "constructor",
            "modifier", "require", "assert", "revert", "panic", "error",
            "unchecked", "unchecked", "unchecked", "unchecked", "unchecked",
            "unchecked", "unchecked", "unchecked", "unchecked", "unchecked",
            "unchecked", "unchecked", "unchecked", "unchecked", "unchecked",
        ]

        for term in security_terms:
            if term in name_lower:
                if term in title_lower:
                    score += 15
                elif term in desc_lower:
                    score += 10

        # Length-based bonus (shorter names more specific)
        if len(name) <= 10:
            score += 5

        return min(score, 100)

    def _calculate_confidence(self, finding: dict, matching_functions: list) -> int:
        """Calculate confidence score (0-100) for the mapping."""
        if not matching_functions:
            return 0

        # Base confidence based on relevance scores
        avg_relevance = sum(f["relevance"] for f in matching_functions) / len(matching_functions)
        confidence = int(avg_relevance)

        # Bonus for multiple matches
        if len(matching_functions) >= 3:
            confidence += 10
        elif len(matching_functions) >= 2:
            confidence += 5

        # Penalty for very low relevance
        if avg_relevance < 30:
            confidence -= 10

        return min(confidence, 100)

    def _parse_response(self, raw: str) -> dict:
        """Parse LLM JSON response."""
        from core.utils import parse_llm_json
        return parse_llm_json(raw)

    def _normalize_findings(self, findings: Any) -> list[dict]:
        """Normalize findings to standard schema."""
        if not isinstance(findings, list):
            return []
        normalized: list[dict] = []
        for idx, f in enumerate(findings, start=1):
            if not isinstance(f, dict):
                continue
            severity = str(f.get("impact", "medium")).strip().upper()
            if severity not in {"CRITICAL", "HIGH", "MEDIUM", "LOW"}:
                severity = "MEDIUM"
            normalized.append({
                "id": str(f.get("id", f"SOL-001-{idx:03d}")),
                "title": str(f.get("title", "Untitled")).strip(),
                "severity": severity,
                "contract": str(f.get("contract", "")).strip(),
                "description": str(f.get("description", "")).strip(),
                "vuln_code": str(f.get("vuln_code", "")).strip(),
                "fix_code": str(f.get("fix_code", "")).strip(),
                "exploit_code": str(f.get("exploit_code", "")).strip(),
                "solodit_url": str(f.get("url", "")).strip(),
                "solodit_id": str(f.get("id", "")).strip(),
                "protocol": str(f.get("protocol", "")).strip(),
                "firms": f.get("issues_issue_finders", []),
                "tags": f.get("tags", []),
            })
        return normalized