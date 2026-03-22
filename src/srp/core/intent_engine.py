"""
Protocol Intent Engine — Extracts protocol invariants, trust boundaries, and assumptions
from project documentation, whitepapers, and NatSpec comments.

Reads: README.md, docs/, whitepapers, NatSpec from .sol files, SPEC.md, DESIGN.md, etc.
Outputs: structured JSON with protocol_name, protocol_type, invariants, access_control_rules, etc.
Saves to: outputs/intent.json
"""
from __future__ import annotations

import glob
import json
import os
import re
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Callable, Awaitable


def _ensure_str_list(value: Any) -> list[str]:
    """Coerce a value into a list of strings."""
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if value is None:
        return []
    val_str = str(value).strip()
    return [val_str] if val_str else []


@dataclass
class Invariant:
    """A machine-checkable invariant extracted from protocol documentation."""
    id: str  # e.g. "INV-001"
    description: str  # human readable
    formal: str  # code-like: "sum(balances) == totalSupply"
    severity_if_broken: str  # high / medium / low
    category: str  # economic / state / access / ordering

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "description": self.description,
            "formal": self.formal,
            "severity_if_broken": self.severity_if_broken,
            "category": self.category,
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "Invariant":
        return cls(
            id=str(d.get("id", "INV-000")),
            description=str(d.get("description", "")),
            formal=str(d.get("formal", "")),
            severity_if_broken=str(d.get("severity_if_broken", "high")).lower(),
            category=str(d.get("category", "state")),
        )


@dataclass
class ProtocolIntent:
    """Complete protocol intent specification extracted from documentation."""
    protocol_name: str = "Unknown Protocol"
    protocol_type: str = "generic"  # lending, amm, bridge, staking, governance, perpetuals, generic
    summary: str = ""
    invariants: list[Invariant] = field(default_factory=list)
    access_control_rules: list[str] = field(default_factory=list)
    trust_assumptions: list[str] = field(default_factory=list)
    critical_functions: list[str] = field(default_factory=list)
    economic_model: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "protocol_name": self.protocol_name,
            "protocol_type": self.protocol_type,
            "summary": self.summary,
            "invariants": [inv.to_dict() for inv in self.invariants],
            "access_control_rules": self.access_control_rules,
            "trust_assumptions": self.trust_assumptions,
            "critical_functions": self.critical_functions,
            "economic_model": self.economic_model,
        }


class ProtocolIntentEngine:
    """Reads all project documentation and extracts the protocol's promised invariants."""

    # Supported whitepaper extensions
    WHITEPAPER_EXTENSIONS = {".md", ".pdf", ".txt", ".rst"}

    # NatSpec tags to extract
    NATSPEC_TAGS = {"@notice", "@dev", "@param", "@return", "@custom:", "@inheritdoc", "@invariant"}

    # Additional spec files to look for
    SPEC_FILES = ["SPEC.md", "DESIGN.md", "ARCHITECTURE.md", "SECURITY.md", "INVARIANTS.md"]

    # Canonical protocol intent fields expected from the LLM
    PROTOCOL_FIELDS = {
        "protocol_name",
        "protocol_type",
        "summary",
        "invariants",
        "access_control_rules",
        "trust_assumptions",
        "critical_functions",
        "economic_model",
    }

    # Common wrapper keys used by LLMs around the actual payload
    RESPONSE_WRAPPER_KEYS = (
        "protocol_intent",
        "intent",
        "data",
        "result",
        "analysis",
        "response",
        "output",
    )

    def __init__(self, project_root: str | Path | None = None) -> None:
        """Initialize the intent engine with a project root path.

        Args:
            project_root: Absolute or relative path to the project root directory.
                          If None, uses current working directory.
        """
        self.project_root = Path(project_root or ".").resolve()
        self.outputs_dir = self.project_root / "outputs"
        self._collected_docs: dict[str, str] = {}
        self._natspec_entries: list[dict[str, str]] = []
        self._invariant_natspec: list[dict[str, str]] = []

    async def extract(
        self,
        call_llm: Callable[..., Awaitable[str]] = None,
        api_key: str | None = None,
        project_root: str | Path | None = None,
        contract_paths: list[str] | None = None,
    ) -> dict[str, Any]:
        """Run the full intent extraction pipeline.

        Args:
            call_llm: Async LLM caller function (BaseAgent.call_llm signature).
            api_key: Optional API key for LLM calls.

        Returns:
            Structured protocol intent dict with invariants, access_control_rules, etc.
        """
        # Step 1: Collect all documentation
        if project_root:
            self.project_root = Path(project_root).resolve()
        self._collect_readme()
        self._collect_docs_folder()
        self._collect_whitepapers()
        self._collect_spec_files()
        self._collect_natspec()  # Includes @invariant extraction

        # Step 2: Build consolidated prompt
        prompt_payload = self._build_extraction_prompt()

        # Step 3: Send to LLM for structured extraction (if LLM available)
        if call_llm:
            result = await self._extract_via_llm(prompt_payload, call_llm, api_key)
        else:
            # Fallback: construct intent from collected data without LLM
            result = self._build_fallback_intent()

        # Step 4: Merge with NatSpec invariants
        result = self._merge_natspec_invariants(result)

        # Step 5: Normalize and validate output
        normalized = self._normalize_to_protocol_intent(result)

        # Step 6: Save to outputs/intent.json
        self._save_result(normalized.to_dict())

        return normalized.to_dict()

    def _collect_readme(self) -> None:
        """Find and read README files from the project root."""
        readme_names = ["README.md", "README.rst", "README.txt", "README", "readme.md"]
        for name in readme_names:
            readme_path = self.project_root / name
            if readme_path.is_file():
                try:
                    content = readme_path.read_text(encoding="utf-8", errors="replace")
                    # Truncate README to 8KB to prevent prompt explosion
                    if len(content) > 8000:
                        content = content[:8000] + "\n...[TRUNCATED_DUE_TO_LENGTH]..."
                    self._collected_docs[f"README:{name}"] = content
                    return  # Found README, exit after first successful read
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
                    # Truncate individual docs to 8KB
                    if len(content) > 8000:
                        content = content[:8000] + "\n...[TRUNCATED_DUE_TO_LENGTH]..."
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
            # Try to extract text from PDFs if possible
            if entry.suffix.lower() == ".pdf":
                pdf_text = self._extract_pdf_text(entry)
                if pdf_text:
                    self._collected_docs[f"WHITEPAPER:{entry.name}"] = pdf_text
                else:
                    self._collected_docs[f"WHITEPAPER:{entry.name}"] = (
                        f"[PDF whitepaper detected: {entry.name}. "
                        f"Size: {entry.stat().st_size} bytes. "
                        f"PDF text extraction failed — analyze based on filename and other docs.]"
                    )
                continue
            try:
                content = entry.read_text(encoding="utf-8", errors="replace")
                self._collected_docs[f"WHITEPAPER:{entry.name}"] = content
            except OSError:
                continue

    def _extract_pdf_text(self, pdf_path: Path) -> str | None:
        """Attempt to extract text from PDF using pypdf or pdfplumber."""
        # Try pypdf first (newer fork of PyPDF2)
        try:
            from pypdf import PdfReader
            reader = PdfReader(str(pdf_path))
            text_parts = [page.extract_text() or "" for page in reader.pages]
            return "\n".join(text_parts)[:15000]  # Cap size
        except Exception:
            pass

        # Try pdfplumber
        try:
            import pdfplumber
            with pdfplumber.open(str(pdf_path)) as pdf:
                text_parts = [page.extract_text() or "" for page in pdf.pages]
                return "\n".join(text_parts)[:15000]
        except Exception:
            pass

        return None

    def _collect_spec_files(self) -> None:
        """Read SPEC.md, DESIGN.md, ARCHITECTURE.md, SECURITY.md files."""
        for spec_name in self.SPEC_FILES:
            spec_path = self.project_root / spec_name
            if spec_path.is_file():
                try:
                    content = spec_path.read_text(encoding="utf-8", errors="replace")
                    self._collected_docs[f"SPEC:{spec_name}"] = content
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
                    # Limit contract content to first 5KB to prevent prompt explosion
                    if len(content) > 5000:
                        content = content[:5000] + "\n...[TRUNCATED_DUE_TO_LENGTH]..."
                    entries, invariants = self._parse_natspec(content, abs_path)
                    self._natspec_entries.extend(entries)
                    self._invariant_natspec.extend(invariants)
                except OSError:
                    continue

    def _parse_natspec(
        self, source: str, file_path: str
    ) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
        """Parse NatSpec comments from Solidity source code.

        Extracts both /// single-line and /** multi-line NatSpec blocks, associating
        them with the function/contract they document. Also extracts @invariant tags.

        Args:
            source: Solidity source code content.
            file_path: Path to the source file (for reference).

        Returns:
            Tuple of (entries, invariants) — both lists of dicts.
        """
        entries: list[dict[str, str]] = []
        invariants: list[dict[str, str]] = []
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
                invariants.extend(self._extract_invariants(natspec_text, rel_path, target))
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
                invariants.extend(self._extract_invariants(natspec_text, rel_path, target))
                continue

            i += 1

        return entries, invariants

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

        # Match @tag content patterns (but not @invariant which is handled separately)
        tag_pattern = re.compile(r'(@(?:notice|dev|param|return|custom:\w+|inheritdoc))\s+')
        parts = tag_pattern.split(natspec_text)

        # If no tags found, treat the whole block as a @notice
        if len(parts) <= 1:
            clean = re.sub(r'[/\*]+', '', natspec_text).strip()
            # Skip if it's an @invariant tag
            if "@invariant" in natspec_text:
                return []
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
            if content and "@invariant" not in tag:
                entries.append({
                    "file": file_path,
                    "target": target,
                    "tag": tag,
                    "content": content[:500],
                })
            i += 2

        return entries

    def _extract_invariants(
        self, natspec_text: str, file_path: str, target: str
    ) -> list[dict[str, str]]:
        """Extract @invariant tags from NatSpec comments."""
        invariants: list[dict[str, str]] = []

        # Match @invariant descriptions
        inv_pattern = re.compile(r'@invariant\s+([^@\n]+)')
        matches = inv_pattern.findall(natspec_text)

        for match in matches:
            clean = re.sub(r'[/\*]+', '', match).strip()
            if clean and len(clean) > 5:
                invariants.append({
                    "file": file_path,
                    "target": target,
                    "tag": "@invariant",
                    "content": clean[:500],
                })

        return invariants

    def _build_extraction_prompt(self) -> str:
        """Build the consolidated prompt from all collected documentation."""
        sections: list[str] = []

        # Add documentation with size limits
        total_size = 0
        for doc_key, content in self._collected_docs.items():
            # Add size check before appending
            if total_size > 20000:  # Stop at 20KB to leave room for other sections
                break
            # Truncate individual docs to 5KB max
            if len(content) > 5000:
                content = content[:5000] + "\n...[TRUNCATED_DUE_TO_LENGTH]..."
            # Check if adding this would exceed limit
            if total_size + len(content) > 20000:
                content = content[:(20000 - total_size)]
            sections.append(f"=== {doc_key} ===\n{content}\n")
            total_size += len(content)

        # Add NatSpec invariants section (these are critical)
        if self._invariant_natspec:
            invariant_block = "=== INVARIANTS FROM NATSPEC (@invariant TAGS) ===\n"
            for inv in self._invariant_natspec:
                invariant_content = f" [{inv['file']}] {inv['target']}: {inv['content']}\n"
                if len(invariant_block) + len(invariant_content) > 8000:  # Cap at 8KB
                    break
                invariant_block += invariant_content
            sections.append(invariant_block[:8000])  # Ensure it doesn't exceed 8KB

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
                entry_content = (
                    f" [{entry['file']}] {entry['target']} "
                    f"{entry['tag']}: {entry['content']}\n"
                )
                if len(natspec_block) + len(entry_content) > 5000:  # Cap at 5KB
                    break
                natspec_block += entry_content
                count += 1
                if count >= 100:  # Cap at 100 entries
                    break
            sections.append(natspec_block[:5000])

        if not sections:
            sections.append(
                "No documentation found in this project. "
                "Infer protocol intent from contract names and NatSpec if available."
            )

        # Final size check: ensure total prompt is under 30KB
        combined = "\n".join(sections)
        if len(combined) > 30000:
            combined = combined[:30000] + "\n...[TRUNCATED_DUE_TO_LENGTH]..."

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
            "Read all provided documentation (README, whitepaper, docs, NatSpec comments, SPEC files) and extract "
            "the protocol's intended behavior as structured data.\n\n"
            "Based on this protocol documentation and function signatures, identify "
            "the key security invariants this protocol must maintain. For each invariant:\n"
            "- Give it an ID (INV-001, INV-002 etc)\n"
            "- Write a clear description\n"
            "- Classify as: economic / state / access / ordering\n"
            "- Rate severity if broken: high / medium / low\n\n"
            "Focus on:\n"
            "- What balances or ratios must always hold\n"
            "- Who is allowed to call what\n"
            "- What ordering of operations is required\n"
            "- What can never happen (user losing funds, unauthorized access etc)\n\n"
            "Return ONLY valid JSON with this exact schema:\n"
            "{\n"
            '  "protocol_name": "string — name of the protocol",\n'
            '  "protocol_type": "string — one of: lending, amm, bridge, staking, governance, perpetuals, generic",\n'
            '  "summary": "string — brief description of what the protocol does",\n'
            '  "invariants": [\n'
            '    {\n'
            '      "id": "INV-001",\n'
            '      "description": "human-readable description of the invariant",\n'
            '      "formal": "code-like representation: sum(balances) == totalSupply",\n'
            '      "severity_if_broken": "high|medium|low",\n'
            '      "category": "economic|state|access|ordering"\n'
            '    }\n'
            '  ],\n'
            '  "access_control_rules": ["string: rule 1", "string: rule 2"],\n'
            '  "trust_assumptions": ["string: assumption 1", "string: assumption 2"],\n'
            '  "critical_functions": ["functionName1", "functionName2"],\n'
            '  "economic_model": "string — description of the economic model (fees, yields, incentives)"\n'
            "}\n\n"
            "Extract AT LEAST 3 invariants if the documentation is rich enough. "
            "Each invariant should have a clear formal representation that could be checked. "
            "Be specific and concrete — avoid generic statements like \"contract is secure\". "
            "Include concrete mathematical conditions where possible."
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
    def _coerce_mapping(value: Any) -> dict[str, Any]:
        """Best-effort coercion of nested LLM output into a dict."""
        if isinstance(value, dict):
            return value
        if isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    return item
        if isinstance(value, str):
            parsed = ProtocolIntentEngine._parse_response(value)
            if isinstance(parsed, dict):
                return parsed
            if isinstance(parsed, list):
                for item in parsed:
                    if isinstance(item, dict):
                        return item
        return {}

    def _unwrap_protocol_payload(self, parsed: dict[str, Any]) -> dict[str, Any]:
        """Unwrap common LLM response envelopes until protocol fields are exposed."""
        candidate = self._coerce_mapping(parsed)
        seen: set[int] = set()

        while candidate and id(candidate) not in seen:
            seen.add(id(candidate))

            if self.PROTOCOL_FIELDS.intersection(candidate.keys()):
                nested = self._coerce_mapping(candidate.get("protocol_intent"))
                if nested and len(self.PROTOCOL_FIELDS.intersection(nested.keys())) > len(
                    self.PROTOCOL_FIELDS.intersection(candidate.keys())
                ):
                    candidate = nested
                    continue
                return candidate

            next_candidate: dict[str, Any] = {}
            for key in self.RESPONSE_WRAPPER_KEYS:
                next_candidate = self._coerce_mapping(candidate.get(key))
                if next_candidate:
                    break

            if not next_candidate and len(candidate) == 1:
                next_candidate = self._coerce_mapping(next(iter(candidate.values())))

            if not next_candidate:
                break

            candidate = next_candidate

        return candidate

    def _infer_protocol_type(self) -> str:
        """Infer the protocol type from collected docs when the LLM omits it."""
        all_text = " ".join(self._collected_docs.values()).lower()
        if not all_text:
            all_text = self.project_root.name.lower()

        type_keywords = {
            "lending": ["borrow", "lending", "collateral", "interest", "liquidat", "loan-to-value", "health factor"],
            "amm": ["swap", "swaps", "liquidity", "pool", "market maker", "uniswap", "curve", "pair", "lp"],
            "bridge": ["bridge", "cross-chain", "cross chain", "relay", "message", "destination chain", "source chain"],
            "staking": ["stake", "staking", "validator", "delegat", "epoch", "rewards", "unstake"],
            "governance": ["vote", "voting", "proposal", "governance", "timelock", "quorum", "delegate"],
            "perpetuals": ["perpetual", "margin", "funding", "leverage", "mark price", "index price", "liquidation price"],
            "vault": ["vault", "share price", "asset", "deposit", "withdraw", "erc4626"],
        }

        best_type = "generic"
        best_score = 0
        for protocol_type, keywords in type_keywords.items():
            score = sum(all_text.count(keyword) for keyword in keywords)
            if score > best_score:
                best_score = score
                best_type = protocol_type

        return best_type if best_score > 0 else "generic"

    def _sanitize_protocol_name(self, raw_name: str) -> str:
        """Normalize noisy titles like 'SecondSwap audit details' into a protocol name."""
        candidate = str(raw_name).strip()
        if not candidate:
            return ""

        candidate = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", candidate)
        candidate = re.sub(r"^[#*\-\s]+", "", candidate).strip()
        candidate = re.sub(
            r"\s+(audit details|audit report|audit|contest details|contest|overview|details)$",
            "",
            candidate,
            flags=re.IGNORECASE,
        ).strip(" :-|")

        return candidate

    def _infer_protocol_name(self) -> str:
        """Infer the protocol name from README/docs before falling back to the folder name."""
        prioritized_docs = sorted(
            self._collected_docs.items(),
            key=lambda item: (0 if item[0].startswith("README:") else 1, item[0]),
        )

        for _, content in prioritized_docs:
            for line in content.splitlines():
                stripped = line.strip()
                if not stripped:
                    continue
                if stripped.startswith("#"):
                    name = self._sanitize_protocol_name(stripped.lstrip("#").strip())
                    if name:
                        return name
                break

        for _, content in prioritized_docs:
            match = re.search(r"\b([A-Z][A-Za-z0-9]+(?:[A-Z][A-Za-z0-9]+)+)\b", content)
            if match:
                return match.group(1)

        folder_name = re.sub(r"^\d{4}[-_]\d{2}[-_]", "", self.project_root.name)
        folder_name = re.sub(r"^\d{4}[-_]\d{2}", "", folder_name).strip("-_ ")
        parts = [part for part in re.split(r"[-_]+", folder_name) if part]
        if not parts:
            return "Unknown Protocol"
        if len(parts) == 1:
            token = parts[0]
            return token[:1].upper() + token[1:]
        return " ".join(part.capitalize() for part in parts)

    def _build_fallback_intent(self) -> dict[str, Any]:
        """Build a fallback intent from collected metadata when LLM output is missing or malformed."""
        invariants: list[dict[str, Any]] = []
        inv_idx = 1

        # Extract invariants from NatSpec @invariant tags
        for inv_natspec in self._invariant_natspec:
            invariants.append({
                "id": f"INV-{inv_idx:03d}",
                "description": inv_natspec["content"],
                "formal": inv_natspec["content"],  # Use description as formal
                "severity_if_broken": "high",
                "category": "state",
            })
            inv_idx += 1

        protocol_type = self._infer_protocol_type()
        protocol_name = self._infer_protocol_name()

        return {
            "protocol_name": protocol_name,
            "protocol_type": protocol_type,
            "summary": f"Protocol intent extracted from {len(self._collected_docs)} documentation sources.",
            "invariants": invariants,
            "access_control_rules": [],
            "trust_assumptions": [],
            "critical_functions": [],
            "economic_model": "",
        }

    def _merge_natspec_invariants(self, result: dict[str, Any]) -> dict[str, Any]:
        """Merge invariants extracted from NatSpec @invariant tags into the result."""
        if self._invariant_natspec:
            existing_invariants = result.get("invariants", [])
            next_idx = len(existing_invariants) + 1

            for inv_natspec in self._invariant_natspec:
                # Check if this invariant is already captured
                content = inv_natspec["content"]
                exists = False
                for existing in existing_invariants:
                    if existing.get("description", "").lower() == content.lower():
                        exists = True
                        break

                if not exists:
                    existing_invariants.append({
                        "id": f"INV-{next_idx:03d}",
                        "description": content,
                        "formal": content,
                        "severity_if_broken": "high",
                        "category": "state",
                    })
                    next_idx += 1

            result["invariants"] = existing_invariants

        return result

    @staticmethod
    def _parse_response(raw: str) -> dict[str, Any]:
        """Parse LLM JSON response with robust fallback handling."""
        from srp.core.utils import parse_llm_json
        return parse_llm_json(raw)

    def _normalize_to_protocol_intent(self, parsed: dict[str, Any]) -> ProtocolIntent:
        """Normalize and validate the extracted protocol intent.

        Args:
            parsed: Raw parsed dict from LLM.

        Returns:
            Normalized ProtocolIntent dataclass.
        """
        parsed = self._unwrap_protocol_payload(parsed)
        fallback = self._build_fallback_intent()

        protocol_name = str(parsed.get("protocol_name") or fallback.get("protocol_name") or self.project_root.name).strip()
        protocol_type = str(parsed.get("protocol_type") or fallback.get("protocol_type") or "generic").strip().lower()

        valid_types = {"lending", "amm", "bridge", "staking", "governance", "perpetuals", "vault", "generic"}
        if protocol_type not in valid_types:
            protocol_type = str(fallback.get("protocol_type", "generic")).strip().lower()
            if protocol_type not in valid_types:
                protocol_type = "generic"

        # Normalize invariants
        raw_invariants = parsed.get("invariants", fallback.get("invariants", []))
        if not isinstance(raw_invariants, list):
            raw_invariants = fallback.get("invariants", [])

        invariants: list[Invariant] = []
        for idx, inv in enumerate(raw_invariants, start=1):
            if not isinstance(inv, dict):
                inv = {"description": str(inv)}

            # Normalize severity
            sev = str(inv.get("severity_if_broken", "high")).lower().strip()
            if sev not in {"high", "medium", "low"}:
                if sev == "critical":
                    sev = "high"
                elif sev in {"informational", "info"}:
                    sev = "low"
                else:
                    sev = "medium"

            # Normalize category
            cat = str(inv.get("category", "state")).lower().strip()
            if cat not in {"economic", "state", "access", "ordering"}:
                cat = "state"

            invariants.append(Invariant(
                id=str(inv.get("id", f"INV-{idx:03d}")),
                description=str(inv.get("description", "")).strip(),
                formal=str(inv.get("formal", inv.get("description", ""))).strip(),
                severity_if_broken=sev,
                category=cat,
            ))

        return ProtocolIntent(
            protocol_name=protocol_name,
            protocol_type=protocol_type,
            summary=str(parsed.get("summary") or fallback.get("summary", "")).strip(),
            invariants=invariants,
            access_control_rules=_ensure_str_list(parsed.get("access_control_rules") or fallback.get("access_control_rules", [])),
            trust_assumptions=_ensure_str_list(parsed.get("trust_assumptions") or fallback.get("trust_assumptions", [])),
            critical_functions=_ensure_str_list(parsed.get("critical_functions") or fallback.get("critical_functions", [])),
            economic_model=str(parsed.get("economic_model") or fallback.get("economic_model", "")).strip(),
        )

    def _save_result(self, result: dict[str, Any]) -> Path:
        """Save the extracted intent to outputs/intent.json.

        Args:
            result: Protocol intent dict.

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

    def get_collection_stats(self) -> dict[str, Any]:
        """Return stats about what was collected — useful for logging.

        Returns:
            Dict with counts of collected docs and NatSpec entries.
        """
        return {
            "docs_collected": len(self._collected_docs),
            "doc_sources": list(self._collected_docs.keys()),
            "natspec_entries": len(self._natspec_entries),
            "invariant_natspec": len(self._invariant_natspec),
            "total_doc_chars": sum(len(v) for v in self._collected_docs.values()),
        }
