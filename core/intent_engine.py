"""
Protocol Intent Engine — Extracts protocol invariants, trust boundaries, and assumptions
from project documentation, whitepapers, and NatSpec comments.

Reads: README.md, docs/, whitepapers, NatSpec from .sol files
Outputs: structured JSON with protocol_name, protocol_type, invariants, trust_boundaries, assumptions
Saves to: outputs/intent.json
"""
from __future__ import annotations

import glob
import json
import os
import re
from pathlib import Path
from typing import Any, Callable, Awaitable


class ProtocolIntentEngine:
    """Reads all project documentation and extracts the protocol's promised invariants."""

    # Supported whitepaper extensions
    WHITEPAPER_EXTENSIONS = {".md", ".pdf", ".txt", ".rst"}

    # NatSpec tags to extract
    NATSPEC_TAGS = {"@notice", "@dev", "@param", "@return", "@custom:", "@inheritdoc"}

    def __init__(self, project_root: str | Path) -> None:
        """Initialize the intent engine with a project root path.

        Args:
            project_root: Absolute or relative path to the project root directory.
        """
        self.project_root = Path(project_root).resolve()
        self.outputs_dir = self.project_root / "outputs"
        self._collected_docs: dict[str, str] = {}
        self._natspec_entries: list[dict[str, str]] = []

    async def extract(
        self,
        call_llm: Callable[..., Awaitable[str]],
        api_key: str | None = None,
    ) -> dict[str, Any]:
        """Run the full intent extraction pipeline.

        Args:
            call_llm: Async LLM caller function (BaseAgent.call_llm signature).
            api_key: Optional API key for LLM calls.

        Returns:
            Structured protocol intent dict with invariants, trust boundaries, assumptions.
        """
        # Step 1: Collect all documentation
        self._collect_readme()
        self._collect_docs_folder()
        self._collect_whitepapers()
        self._collect_natspec()

        # Step 2: Build consolidated prompt
        prompt_payload = self._build_extraction_prompt()

        # Step 3: Send to LLM for structured extraction
        result = await self._extract_via_llm(prompt_payload, call_llm, api_key)

        # Step 4: Normalize and validate output
        normalized = self._normalize_result(result)

        # Step 5: Save to outputs/intent.json
        self._save_result(normalized)

        return normalized

    def _collect_readme(self) -> None:
        """Find and read README files from the project root."""
        readme_names = ["README.md", "README.rst", "README.txt", "README", "readme.md"]
        for name in readme_names:
            readme_path = self.project_root / name
            if readme_path.is_file():
                try:
                    content = readme_path.read_text(encoding="utf-8", errors="replace")
                    self._collected_docs[f"README:{name}"] = content
                except OSError:
                    continue

    def _collect_docs_folder(self) -> None:
        """Recursively read all markdown/text files from docs/ directory."""
        docs_dirs = ["docs", "doc", "documentation", "spec", "specs"]
        for docs_name in docs_dirs:
            docs_path = self.project_root / docs_name
            if not docs_path.is_dir():
                continue
            for md_file in sorted(docs_path.rglob("*")):
                if not md_file.is_file():
                    continue
                if md_file.suffix.lower() not in {".md", ".txt", ".rst"}:
                    continue
                try:
                    content = md_file.read_text(encoding="utf-8", errors="replace")
                    rel_path = md_file.relative_to(self.project_root)
                    self._collected_docs[f"DOCS:{rel_path}"] = content
                except OSError:
                    continue

    def _collect_whitepapers(self) -> None:
        """Find whitepaper files in project root (any file with 'whitepaper' in name)."""
        for entry in sorted(self.project_root.iterdir()):
            if not entry.is_file():
                continue
            name_lower = entry.name.lower()
            if "whitepaper" not in name_lower and "white_paper" not in name_lower:
                continue
            if entry.suffix.lower() not in self.WHITEPAPER_EXTENSIONS:
                continue
            # Skip PDFs (binary), but note them
            if entry.suffix.lower() == ".pdf":
                self._collected_docs[f"WHITEPAPER:{entry.name}"] = (
                    f"[PDF whitepaper detected: {entry.name}. "
                    f"Size: {entry.stat().st_size} bytes. "
                    f"Binary content cannot be read directly — extract key claims from README/docs instead.]"
                )
                continue
            try:
                content = entry.read_text(encoding="utf-8", errors="replace")
                self._collected_docs[f"WHITEPAPER:{entry.name}"] = content
            except OSError:
                continue

    def _collect_natspec(self) -> None:
        """Extract NatSpec comments from all Solidity files in the project."""
        sol_patterns = [
            os.path.join(str(self.project_root), "**", "*.sol"),
        ]
        seen: set[str] = set()

        for pattern in sol_patterns:
            for sol_path in sorted(glob.glob(pattern, recursive=True)):
                abs_path = os.path.abspath(sol_path)
                if abs_path in seen:
                    continue
                seen.add(abs_path)

                # Skip vendor/lib directories
                if any(skip in abs_path for skip in ["/node_modules/", "/lib/", "/forge-std/"]):
                    continue

                try:
                    content = Path(abs_path).read_text(encoding="utf-8", errors="replace")
                    entries = self._parse_natspec(content, abs_path)
                    self._natspec_entries.extend(entries)
                except OSError:
                    continue

    def _parse_natspec(self, source: str, file_path: str) -> list[dict[str, str]]:
        """Parse NatSpec comments from Solidity source code.

        Extracts both /// single-line and /** multi-line NatSpec blocks, associating
        them with the function/contract they document.

        Args:
            source: Solidity source code content.
            file_path: Path to the source file (for reference).

        Returns:
            List of dicts with keys: file, target, tag, content.
        """
        entries: list[dict[str, str]] = []
        lines = source.splitlines()
        rel_path = str(file_path)
        try:
            rel_path = str(Path(file_path).relative_to(self.project_root))
        except ValueError:
            pass

        i = 0
        while i < len(lines):
            line = lines[i].strip()

            # Multi-line NatSpec: /** ... */
            if line.startswith("/**"):
                comment_lines: list[str] = []
                while i < len(lines):
                    comment_lines.append(lines[i].strip())
                    if "*/" in lines[i]:
                        break
                    i += 1
                i += 1
                # Get the target (next non-empty, non-comment line)
                target = self._find_next_declaration(lines, i)
                natspec_text = " ".join(comment_lines)
                entries.extend(self._extract_tags(natspec_text, rel_path, target))
                continue

            # Single-line NatSpec: ///
            if line.startswith("///"):
                comment_lines = []
                while i < len(lines) and lines[i].strip().startswith("///"):
                    comment_lines.append(lines[i].strip().lstrip("/").strip())
                    i += 1
                target = self._find_next_declaration(lines, i)
                natspec_text = " ".join(comment_lines)
                entries.extend(self._extract_tags(natspec_text, rel_path, target))
                continue

            i += 1

        return entries

    @staticmethod
    def _find_next_declaration(lines: list[str], start: int) -> str:
        """Find the next function/contract/event declaration after a NatSpec block."""
        for j in range(start, min(start + 5, len(lines))):
            stripped = lines[j].strip()
            if not stripped or stripped.startswith("//") or stripped.startswith("*"):
                continue
            # Match function, contract, event, modifier, error declarations
            match = re.match(
                r'^(function|contract|interface|library|event|modifier|error|constructor|struct|enum)\s+(\w+)',
                stripped,
            )
            if match:
                return f"{match.group(1)} {match.group(2)}"
            # Fallback: return first significant line
            if len(stripped) > 3:
                return stripped[:120]
        return "unknown"

    def _extract_tags(self, natspec_text: str, file_path: str, target: str) -> list[dict[str, str]]:
        """Extract individual NatSpec tags from a comment block."""
        entries: list[dict[str, str]] = []

        # Match @tag content patterns
        tag_pattern = re.compile(r'(@(?:notice|dev|param|return|custom:\w+|inheritdoc))\s+')
        parts = tag_pattern.split(natspec_text)

        # If no tags found, treat the whole block as a @notice
        if len(parts) <= 1:
            clean = re.sub(r'[/\*]+', '', natspec_text).strip()
            if clean and len(clean) > 5:
                entries.append({
                    "file": file_path,
                    "target": target,
                    "tag": "@notice",
                    "content": clean[:500],
                })
            return entries

        # Parse tag-content pairs
        i = 1  # skip prefix text
        while i < len(parts) - 1:
            tag = parts[i].strip()
            content = parts[i + 1].strip()
            content = re.sub(r'[/\*]+', '', content).strip()
            if content:
                entries.append({
                    "file": file_path,
                    "target": target,
                    "tag": tag,
                    "content": content[:500],
                })
            i += 2

        return entries

    def _build_extraction_prompt(self) -> str:
        """Build the consolidated prompt from all collected documentation."""
        sections: list[str] = []

        # Add documentation
        for doc_key, content in self._collected_docs.items():
            # Truncate individual docs to prevent prompt explosion
            truncated = content[:8000] if len(content) > 8000 else content
            sections.append(f"=== {doc_key} ===\n{truncated}\n")

        # Add NatSpec entries (deduplicated, limited)
        if self._natspec_entries:
            natspec_block = "=== NATSPEC COMMENTS FROM CONTRACTS ===\n"
            seen_content: set[str] = set()
            count = 0
            for entry in self._natspec_entries:
                content_key = f"{entry['target']}:{entry['content'][:100]}"
                if content_key in seen_content:
                    continue
                seen_content.add(content_key)
                natspec_block += (
                    f"  [{entry['file']}] {entry['target']} "
                    f"{entry['tag']}: {entry['content']}\n"
                )
                count += 1
                if count >= 200:  # Cap at 200 unique entries
                    natspec_block += f"  ... ({len(self._natspec_entries) - count} more entries truncated)\n"
                    break
            sections.append(natspec_block)

        if not sections:
            sections.append(
                "No documentation found in this project. "
                "Infer protocol intent from contract names and NatSpec if available."
            )

        # Truncate total payload to 25000 chars to stay within LLM limits
        combined = "\n".join(sections)
        if len(combined) > 25000:
            combined = combined[:25000] + "\n...[TRUNCATED_DUE_TO_LENGTH]..."

        return combined

    async def _extract_via_llm(
        self,
        docs_payload: str,
        call_llm: Callable[..., Awaitable[str]],
        api_key: str | None = None,
    ) -> dict[str, Any]:
        """Send documentation to LLM and extract protocol intent as structured JSON.

        Args:
            docs_payload: Consolidated documentation text.
            call_llm: Async LLM caller function.
            api_key: Optional API key.

        Returns:
            Parsed JSON dict from LLM response.
        """
        system_prompt = (
            "You are a protocol security analyst. Your task is to extract what a DeFi protocol "
            "PROMISES to guarantee — its invariants, security assumptions, and trust boundaries.\n\n"
            "Read all provided documentation (README, whitepaper, docs, NatSpec comments) and extract "
            "the protocol's intended behavior as structured data.\n\n"
            "Focus specifically on:\n"
            "1. INVARIANTS — properties the protocol claims will ALWAYS hold (e.g., 'total supply equals "
            "sum of all balances', 'collateral ratio never drops below threshold')\n"
            "2. TRUST BOUNDARIES — who is trusted vs untrusted (e.g., 'admin can pause', 'oracle is trusted')\n"
            "3. ASSUMPTIONS — implicit or explicit assumptions about the environment (e.g., 'ETH price > 0', "
            "'block.timestamp is reliable')\n\n"
            "Return ONLY valid JSON with this exact schema:\n"
            "{\n"
            '  "protocol_name": "string — name of the protocol",\n'
            '  "protocol_type": "string — one of: lending, amm, bridge, staking, governance, perpetuals, vault, generic",\n'
            '  "invariants": [\n'
            "    {\n"
            '      "id": "INV-001",\n'
            '      "description": "human-readable description of the invariant",\n'
            '      "expected_behavior": "what should always be true",\n'
            '      "contracts_involved": ["ContractName1", "ContractName2"]\n'
            "    }\n"
            "  ],\n"
            '  "trust_boundaries": [\n'
            "    {\n"
            '      "id": "TB-001",\n'
            '      "entity": "who/what is trusted",\n'
            '      "trust_level": "full|partial|none",\n'
            '      "description": "what they can do and why"\n'
            "    }\n"
            "  ],\n"
            '  "assumptions": [\n'
            "    {\n"
            '      "id": "ASM-001",\n'
            '      "description": "what is assumed to be true",\n'
            '      "risk_if_violated": "what happens if this assumption breaks"\n'
            "    }\n"
            "  ]\n"
            "}\n\n"
            "Extract AT LEAST 5 invariants if the documentation is rich enough. "
            "If documentation is sparse, infer from contract names and NatSpec. "
            "Be specific and concrete — avoid generic statements."
        )

        messages = [{"role": "user", "content": docs_payload}]

        raw_response = await call_llm(
            system_extra=system_prompt,
            messages=messages,
            api_key=api_key,
            max_tokens=4096,
        )

        return self._parse_response(raw_response)

    @staticmethod
    def _parse_response(raw: str) -> dict[str, Any]:
        """Parse LLM JSON response with robust fallback handling."""
        from core.utils import parse_llm_json
        return parse_llm_json(raw)

    def _normalize_result(self, parsed: dict[str, Any]) -> dict[str, Any]:
        """Normalize and validate the extracted protocol intent.

        Args:
            parsed: Raw parsed dict from LLM.

        Returns:
            Normalized dict with guaranteed schema compliance.
        """
        protocol_name = str(parsed.get("protocol_name", "Unknown Protocol")).strip()
        protocol_type = str(parsed.get("protocol_type", "generic")).strip().lower()

        valid_types = {"lending", "amm", "bridge", "staking", "governance", "perpetuals", "vault", "generic"}
        if protocol_type not in valid_types:
            protocol_type = "generic"

        # Normalize invariants
        raw_invariants = parsed.get("invariants", [])
        if not isinstance(raw_invariants, list):
            raw_invariants = []

        invariants: list[dict[str, Any]] = []
        for idx, inv in enumerate(raw_invariants, start=1):
            if not isinstance(inv, dict):
                inv = {"description": str(inv)}
            invariants.append({
                "id": str(inv.get("id", f"INV-{idx:03d}")),
                "description": str(inv.get("description", "")).strip(),
                "expected_behavior": str(inv.get("expected_behavior", "")).strip(),
                "contracts_involved": self._ensure_str_list(inv.get("contracts_involved", [])),
            })

        # Normalize trust boundaries
        raw_boundaries = parsed.get("trust_boundaries", [])
        if not isinstance(raw_boundaries, list):
            raw_boundaries = []

        trust_boundaries: list[dict[str, str]] = []
        for idx, tb in enumerate(raw_boundaries, start=1):
            if not isinstance(tb, dict):
                tb = {"description": str(tb)}
            trust_level = str(tb.get("trust_level", "partial")).strip().lower()
            if trust_level not in {"full", "partial", "none"}:
                trust_level = "partial"
            trust_boundaries.append({
                "id": str(tb.get("id", f"TB-{idx:03d}")),
                "entity": str(tb.get("entity", "unknown")).strip(),
                "trust_level": trust_level,
                "description": str(tb.get("description", "")).strip(),
            })

        # Normalize assumptions
        raw_assumptions = parsed.get("assumptions", [])
        if not isinstance(raw_assumptions, list):
            raw_assumptions = []

        assumptions: list[dict[str, str]] = []
        for idx, asm in enumerate(raw_assumptions, start=1):
            if not isinstance(asm, dict):
                asm = {"description": str(asm)}
            assumptions.append({
                "id": str(asm.get("id", f"ASM-{idx:03d}")),
                "description": str(asm.get("description", "")).strip(),
                "risk_if_violated": str(asm.get("risk_if_violated", "")).strip(),
            })

        return {
            "protocol_name": protocol_name,
            "protocol_type": protocol_type,
            "invariants": invariants,
            "trust_boundaries": trust_boundaries,
            "assumptions": assumptions,
        }

    def _save_result(self, result: dict[str, Any]) -> Path:
        """Save the extracted intent to outputs/intent.json.

        Args:
            result: Normalized protocol intent dict.

        Returns:
            Path to the saved file.
        """
        self.outputs_dir.mkdir(parents=True, exist_ok=True)
        output_path = self.outputs_dir / "intent.json"
        output_path.write_text(
            json.dumps(result, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        return output_path

    @staticmethod
    def _ensure_str_list(value: Any) -> list[str]:
        """Coerce a value into a list of strings."""
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        if value is None:
            return []
        val_str = str(value).strip()
        return [val_str] if val_str else []

    def get_collection_stats(self) -> dict[str, Any]:
        """Return stats about what was collected — useful for logging.

        Returns:
            Dict with counts of collected docs and NatSpec entries.
        """
        return {
            "docs_collected": len(self._collected_docs),
            "doc_sources": list(self._collected_docs.keys()),
            "natspec_entries": len(self._natspec_entries),
            "total_doc_chars": sum(len(v) for v in self._collected_docs.values()),
        }
