"""
SRP Solidity Parser — Phase 1 (Upgraded)

Recursively parses .sol files and produces a rich, structured JSON output
including a per-contract `contract_map` with function calls, state reads/writes,
and external calls — all deterministic, no LLM.
"""

import os
import re
import json
from pathlib import Path
from typing import Optional


class SolidityParser:
    def __init__(self, root_dir: str):
        self.root_dir = Path(root_dir)
        self.files: list[Path] = []
        self._find_files()

    def _find_files(self):
        for path in self.root_dir.rglob("*.sol"):
            self.files.append(path)

    # ── Public API ────────────────────────────────────────────────────────

    def parse_all(self) -> dict:
        results: dict = {
            "contracts": [],
            "functions": [],
            "state_variables": [],
            "imports": [],
            "relationships": [],
            "contract_map": {},
        }
        for file_path in self.files:
            try:
                content = file_path.read_text(encoding="utf-8")
                self._parse_file(str(file_path), content, results)
            except Exception as e:
                print(f"[Parser] Error parsing {file_path}: {e}")
        return results

    # ── Internal ──────────────────────────────────────────────────────────

    def _strip_comments(self, src: str) -> str:
        src = re.sub(r"//.*", "", src)
        src = re.sub(r"/\*.*?\*/", "", src, flags=re.DOTALL)
        return src

    def _parse_file(self, file_path: str, content: str, results: dict):
        clean = self._strip_comments(content)

        # 1. Imports
        for imp in re.findall(r'import\s+["\'](.+?)["\'];', clean):
            results["imports"].append({"file": file_path, "imports": imp})

        # 2. Extract contract bodies with their boundaries
        contract_blocks = self._extract_contract_blocks(clean)

        for c_type, c_name, c_inherits, c_body in contract_blocks:
            inherits = [p.strip() for p in c_inherits.split(",")] if c_inherits else []

            # Relationships: INHERITS
            for parent in inherits:
                results["relationships"].append(
                    {"source": c_name, "target": parent, "type": "INHERITS"}
                )

            results["contracts"].append(
                {"type": c_type, "name": c_name, "inherits": inherits, "file": file_path}
            )

            # Parse functions and state vars inside this contract body
            funcs = self._extract_functions(c_body, file_path, c_name)
            state_vars = self._extract_state_variables(c_body, file_path, c_name)
            state_var_names = {sv["name"] for sv in state_vars}

            # Extract per-function details
            func_entries = []
            for f in funcs:
                calls = self._extract_function_calls(f["body"])
                ext_calls = self._extract_external_calls(f["body"])
                reads, writes = self._extract_state_access(f["body"], state_var_names)

                func_entry = {
                    "name": f["name"],
                    "arguments": f["arguments"],
                    "modifiers": f["modifiers"],
                    "returns": f["returns"],
                    "visibility": f["visibility"],
                    "calls": calls,
                    "external_calls": ext_calls,
                    "state_reads": reads,
                    "state_writes": writes,
                }
                func_entries.append(func_entry)

                # Flat list
                results["functions"].append({
                    **func_entry,
                    "contract": c_name,
                    "file": file_path,
                })

                # Relationships: CALLS
                for callee in calls:
                    results["relationships"].append(
                        {"source": f"{c_name}.{f['name']}", "target": callee, "type": "CALLS"}
                    )
                # Relationships: EXTERNAL_CALL
                for ext in ext_calls:
                    results["relationships"].append(
                        {"source": f"{c_name}.{f['name']}", "target": ext, "type": "EXTERNAL_CALL"}
                    )
                # Relationships: READS
                for r in reads:
                    results["relationships"].append(
                        {"source": f"{c_name}.{f['name']}", "target": f"{c_name}.{r}", "type": "READS"}
                    )
                # Relationships: WRITES
                for w in writes:
                    results["relationships"].append(
                        {"source": f"{c_name}.{f['name']}", "target": f"{c_name}.{w}", "type": "WRITES"}
                    )

            for sv in state_vars:
                results["state_variables"].append({**sv, "contract": c_name, "file": file_path})
                # Relationships: HAS_STATE
                results["relationships"].append(
                    {"source": c_name, "target": f"{c_name}.{sv['name']}", "type": "HAS_STATE"}
                )

            # Relationships: HAS_FUNCTION
            for f in func_entries:
                results["relationships"].append(
                    {"source": c_name, "target": f"{c_name}.{f['name']}", "type": "HAS_FUNCTION"}
                )

            # Build contract_map entry
            all_calls = []
            all_ext_calls = []
            for f in func_entries:
                all_calls.extend(f["calls"])
                all_ext_calls.extend(f["external_calls"])

            results["contract_map"][c_name] = {
                "functions": [f["name"] for f in func_entries],
                "state_variables": [sv["name"] for sv in state_vars],
                "inherits": inherits,
                "calls": sorted(set(all_calls)),
                "external_calls": sorted(set(all_ext_calls)),
            }

    # ── Contract Body Extraction ──────────────────────────────────────────

    def _extract_contract_blocks(self, src: str) -> list[tuple[str, str, str, str]]:
        """Returns list of (type, name, inherits_raw, body) tuples."""
        blocks = []
        pattern = re.compile(
            r"(contract|interface|library)\s+([A-Za-z0-9_]+)(?:\s+is\s+([^{]+))?\s*\{"
        )
        for match in pattern.finditer(src):
            c_type = match.group(1)
            c_name = match.group(2)
            c_inherits = match.group(3) or ""
            body_start = match.end()
            body = self._match_braces(src, body_start - 1)
            blocks.append((c_type, c_name, c_inherits.strip(), body))
        return blocks

    def _match_braces(self, src: str, start: int) -> str:
        """Extract the content between matching braces starting at position start."""
        depth = 0
        i = start
        body_start = None
        while i < len(src):
            if src[i] == "{":
                if depth == 0:
                    body_start = i + 1
                depth += 1
            elif src[i] == "}":
                depth -= 1
                if depth == 0:
                    return src[body_start:i] if body_start else ""
            i += 1
        return src[body_start:] if body_start else ""

    # ── Function Extraction ───────────────────────────────────────────────

    def _extract_functions(self, body: str, file_path: str, contract: str) -> list[dict]:
        funcs = []
        # Match function signature including body
        pattern = re.compile(
            r"function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*((?:(?:public|private|internal|external|view|pure|payable|virtual|override|nonReentrant|returns\s*\([^)]*\))\s*)*)\s*\{",
            re.DOTALL,
        )
        for match in pattern.finditer(body):
            f_name = match.group(1)
            args = match.group(2).strip()
            modifiers_raw = match.group(3).strip()

            # Extract visibility
            visibility = "internal"
            for vis in ("public", "external", "private", "internal"):
                if vis in modifiers_raw:
                    visibility = vis
                    break

            # Extract returns
            returns_match = re.search(r"returns\s*\(([^)]*)\)", modifiers_raw)
            returns = returns_match.group(1).strip() if returns_match else None

            # Extract function body
            func_body_start = match.end() - 1
            func_body = self._match_braces(body, func_body_start)

            funcs.append({
                "name": f_name,
                "arguments": args,
                "modifiers": modifiers_raw,
                "returns": returns,
                "visibility": visibility,
                "body": func_body,
            })
        return funcs

    # ── State Variable Extraction ─────────────────────────────────────────

    def _extract_state_variables(self, body: str, file_path: str, contract: str) -> list[dict]:
        state_vars = []
        # Match common Solidity state var patterns
        patterns = [
            # mapping(...) visibility name;
            r"(mapping\s*\([^)]+\))\s+(public|private|internal|constant)?\s*([A-Za-z0-9_]+)\s*[;=]",
            # Type[] visibility name;
            r"([A-Za-z0-9_]+\s*\[\s*\])\s+(public|private|internal|constant)?\s*([A-Za-z0-9_]+)\s*[;=]",
            # Simple type visibility name;
            r"(uint\d*|int\d*|address|bool|string|bytes\d*|address payable)\s+(public|private|internal|constant)?\s*([A-Za-z0-9_]+)\s*[;=]",
            # Custom type (single word identifier) visibility name;
            r"(I[A-Z][A-Za-z0-9_]*|IERC\d+)\s+(public|private|internal|constant)?\s*([A-Za-z0-9_]+)\s*[;=]",
        ]
        seen = set()
        for pat in patterns:
            for match in re.finditer(pat, body):
                v_type = match.group(1).strip()
                v_vis = match.group(2) or "internal"
                v_name = match.group(3).strip()
                # Skip common false positives
                if v_name in ("memory", "storage", "calldata", "returns", "return", "if", "else", "for", "while"):
                    continue
                if v_name not in seen:
                    seen.add(v_name)
                    state_vars.append({"type": v_type, "visibility": v_vis, "name": v_name})
        return state_vars

    # ── Function Call Extraction ──────────────────────────────────────────

    def _extract_function_calls(self, func_body: str) -> list[str]:
        """Extract internal/cross-contract function calls from a function body."""
        calls = set()
        # Match: foo(), this.foo(), SomeContract.foo(), _foo()
        for match in re.finditer(r"(?:([A-Za-z0-9_]+)\s*\.\s*)?([A-Za-z_][A-Za-z0-9_]*)\s*\(", func_body):
            prefix = match.group(1)
            fname = match.group(2)
            # Skip Solidity keywords and common builtins
            if fname in (
                "require", "assert", "revert", "emit", "keccak256", "abi",
                "if", "for", "while", "return", "delete", "new", "type",
                "encode", "encodePacked", "encodeWithSignature", "encodeWithSelector",
                "decode", "push", "pop",
            ):
                continue
            if prefix:
                calls.add(f"{prefix}.{fname}")
            else:
                calls.add(fname)
        return sorted(calls)

    # ── External Call Extraction ──────────────────────────────────────────

    def _extract_external_calls(self, func_body: str) -> list[str]:
        """Detect low-level external calls: .call(), .delegatecall(), .transfer(), .send()."""
        ext_calls = set()
        for match in re.finditer(r"([A-Za-z0-9_]+(?:\([^)]*\))?)\s*\.\s*(call|delegatecall|staticcall|transfer|send)\s*[\({]", func_body):
            target = match.group(1).strip()
            method = match.group(2)
            ext_calls.add(f"{target}.{method}")
        return sorted(ext_calls)

    # ── State Access Detection ────────────────────────────────────────────

    def _extract_state_access(self, func_body: str, state_vars: set[str]) -> tuple[list[str], list[str]]:
        """Detect which state variables are read from and written to."""
        reads = set()
        writes = set()
        for var in state_vars:
            if not var:
                continue
            # Write detection: var = ..., var +=, var -=, var++, var--, var[x] =
            write_pat = re.compile(
                rf"\b{re.escape(var)}\b\s*(?:\[[^\]]*\]\s*)?(?:=(?!=)|[+\-*/]=|\+\+|--)"
            )
            if write_pat.search(func_body):
                writes.add(var)

            # Read detection: any other usage of the variable name
            read_pat = re.compile(rf"\b{re.escape(var)}\b")
            if read_pat.search(func_body):
                reads.add(var)

        # A variable that is written is also read if it appears elsewhere
        # Remove pure write-only (var = literal) — heuristic: keep it simple, mark as both
        return sorted(reads), sorted(writes)


if __name__ == "__main__":
    import sys

    target = sys.argv[1] if len(sys.argv) > 1 else "."
    parser = SolidityParser(target)
    out = parser.parse_all()
    # Print summary
    print(f"Contracts: {len(out['contracts'])}")
    print(f"Functions: {len(out['functions'])}")
    print(f"State vars: {len(out['state_variables'])}")
    print(f"Imports: {len(out['imports'])}")
    print(f"Relationships: {len(out['relationships'])}")
    print(f"Contract map entries: {len(out['contract_map'])}")
    print(json.dumps(out, indent=2))
