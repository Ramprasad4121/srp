"""
SRP Solidity Parser — Phase 1 (Finalized)

Recursively parses .sol files and produces a rich, structured JSON output
including a per-contract `contract_map` with function calls, state reads/writes,
and external calls — all deterministic, no LLM.

Detects: functions, constructors, fallback, receive, modifiers, ERC20 calls,
low-level calls, library calls, cross-contract calls.
"""

import os
import re
import json
from pathlib import Path
from typing import Optional


# ── ERC20 / common interface methods treated as external calls ────────────
ERC20_METHODS = {
    "transfer", "transferFrom", "approve", "allowance", "balanceOf",
    "totalSupply", "mint", "burn", "safeTransfer", "safeTransferFrom",
    "permit", "increaseAllowance", "decreaseAllowance",
}

# ── Low-level call methods ────────────────────────────────────────────────
LOW_LEVEL_CALLS = {"call", "delegatecall", "staticcall", "transfer", "send"}

# ── Solidity keywords to ignore as function calls ────────────────────────
SKIP_CALLS = {
    "require", "assert", "revert", "emit", "keccak256", "abi",
    "if", "for", "while", "return", "delete", "new", "type",
    "encode", "encodePacked", "encodeWithSignature", "encodeWithSelector",
    "decode", "push", "pop", "sha256", "ecrecover", "addmod", "mulmod",
    "selfdestruct", "blockhash", "gasleft", "msg", "block", "tx",
    "super", "this", "address", "uint256", "uint", "int256", "int",
    "bytes32", "bytes", "string", "bool", "mapping",
}


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
        # Named imports: import {Foo, Bar} from "path";
        for match in re.finditer(r'import\s*\{[^}]*\}\s*from\s*["\'](.+?)["\'];', clean):
            imp = match.group(1)
            if not any(r["imports"] == imp and r["file"] == file_path for r in results["imports"]):
                results["imports"].append({"file": file_path, "imports": imp})

        # 2. Extract contract bodies with their boundaries
        contract_blocks = self._extract_contract_blocks(clean)

        for c_type, c_name, c_inherits, c_body in contract_blocks:
            inherits = [p.strip() for p in c_inherits.split(",")] if c_inherits else []
            # Clean up generic params from inherits: Initializable(x) -> Initializable
            inherits = [re.sub(r"\(.*\)", "", p).strip() for p in inherits if p.strip()]

            for parent in inherits:
                results["relationships"].append(
                    {"source": c_name, "target": parent, "type": "INHERITS"}
                )

            results["contracts"].append(
                {"type": c_type, "name": c_name, "inherits": inherits, "file": file_path}
            )

            # Parse all callable definitions inside this contract body
            funcs = self._extract_all_callables(c_body, file_path, c_name)
            state_vars = self._extract_state_variables(c_body, file_path, c_name)
            state_var_names = {sv["name"] for sv in state_vars}

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
                    "callable_type": f["callable_type"],
                    "calls": calls,
                    "external_calls": ext_calls,
                    "state_reads": reads,
                    "state_writes": writes,
                }
                func_entries.append(func_entry)

                results["functions"].append({
                    **func_entry,
                    "contract": c_name,
                    "file": file_path,
                })

                fqn = f"{c_name}.{f['name']}"
                for callee in calls:
                    results["relationships"].append(
                        {"source": fqn, "target": callee, "type": "CALLS"}
                    )
                for ext in ext_calls:
                    results["relationships"].append(
                        {"source": fqn, "target": ext.get("target", str(ext)),
                         "type": "EXTERNAL_CALL",
                         "subtype": ext.get("subtype", "unknown")}
                    )
                for r in reads:
                    results["relationships"].append(
                        {"source": fqn, "target": f"{c_name}.{r}", "type": "READS"}
                    )
                for w in writes:
                    results["relationships"].append(
                        {"source": fqn, "target": f"{c_name}.{w}", "type": "WRITES"}
                    )

            for sv in state_vars:
                results["state_variables"].append({**sv, "contract": c_name, "file": file_path})
                results["relationships"].append(
                    {"source": c_name, "target": f"{c_name}.{sv['name']}", "type": "HAS_STATE"}
                )

            for f in func_entries:
                results["relationships"].append(
                    {"source": c_name, "target": f"{c_name}.{f['name']}", "type": "HAS_FUNCTION"}
                )

            # Build contract_map
            all_calls = []
            all_ext_calls = []
            for f in func_entries:
                all_calls.extend(f["calls"])
                all_ext_calls.extend([e.get("target", "") for e in f["external_calls"]])

            results["contract_map"][c_name] = {
                "functions": [f["name"] for f in func_entries],
                "state_variables": [sv["name"] for sv in state_vars],
                "inherits": inherits,
                "calls": sorted(set(all_calls)),
                "external_calls": sorted(set(all_ext_calls)),
            }

    # ── Contract Body Extraction ──────────────────────────────────────────

    def _extract_contract_blocks(self, src: str) -> list[tuple[str, str, str, str]]:
        blocks = []
        pattern = re.compile(
            r"(contract|interface|library|abstract\s+contract)\s+([A-Za-z0-9_]+)(?:\s+is\s+([^{]+))?\s*\{"
        )
        for match in pattern.finditer(src):
            c_type = match.group(1).strip()
            c_name = match.group(2)
            c_inherits = match.group(3) or ""
            body_start = match.end()
            body = self._match_braces(src, body_start - 1)
            blocks.append((c_type, c_name, c_inherits.strip(), body))
        return blocks

    def _match_braces(self, src: str, start: int) -> str:
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

    # ── Callable Extraction (functions + constructor + fallback + receive + modifier) ──

    def _extract_all_callables(self, body: str, file_path: str, contract: str) -> list[dict]:
        callables = []

        # 1. Regular functions (including interface functions without bodies)
        func_pat = re.compile(
            r"function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)"
            r"((?:\s+(?:public|private|internal|external|view|pure|payable|virtual|override|nonReentrant|onlyOwner|"
            r"whenNotPaused|initializer|returns\s*\([^)]*\)|[A-Za-z0-9_]+\([^)]*\)))*)"
            r"\s*([{;])",
            re.DOTALL,
        )
        for match in func_pat.finditer(body):
            f_name = match.group(1)
            args = match.group(2).strip()
            mods_raw = match.group(3).strip()
            has_body = match.group(4) == "{"

            visibility = self._extract_visibility(mods_raw)
            returns = self._extract_returns(mods_raw)

            if has_body:
                func_body = self._match_braces(body, match.end() - 1)
            else:
                func_body = ""

            callables.append({
                "name": f_name,
                "arguments": args,
                "modifiers": mods_raw,
                "returns": returns,
                "visibility": visibility,
                "callable_type": "function",
                "body": func_body,
            })

        # 2. Constructor
        ctor_pat = re.compile(
            r"constructor\s*\(([^)]*)\)"
            r"((?:\s+(?:public|private|internal|external|payable|virtual|override|initializer|"
            r"[A-Za-z0-9_]+\([^)]*\)))*)"
            r"\s*\{",
            re.DOTALL,
        )
        for match in ctor_pat.finditer(body):
            args = match.group(1).strip()
            mods_raw = match.group(2).strip()
            visibility = self._extract_visibility(mods_raw) or "public"
            ctor_body = self._match_braces(body, match.end() - 1)
            callables.append({
                "name": "constructor",
                "arguments": args,
                "modifiers": mods_raw,
                "returns": None,
                "visibility": visibility,
                "callable_type": "constructor",
                "body": ctor_body,
            })

        # 3. Fallback
        fallback_pat = re.compile(
            r"fallback\s*\(\s*\)\s*((?:external|payable|virtual|override|\s)*)\s*\{",
            re.DOTALL,
        )
        for match in fallback_pat.finditer(body):
            mods_raw = match.group(1).strip()
            fb_body = self._match_braces(body, match.end() - 1)
            callables.append({
                "name": "fallback",
                "arguments": "",
                "modifiers": mods_raw,
                "returns": None,
                "visibility": "external",
                "callable_type": "fallback",
                "body": fb_body,
            })

        # 4. Receive
        receive_pat = re.compile(
            r"receive\s*\(\s*\)\s*((?:external|payable|virtual|override|\s)*)\s*\{",
            re.DOTALL,
        )
        for match in receive_pat.finditer(body):
            mods_raw = match.group(1).strip()
            rcv_body = self._match_braces(body, match.end() - 1)
            callables.append({
                "name": "receive",
                "arguments": "",
                "modifiers": mods_raw,
                "returns": None,
                "visibility": "external",
                "callable_type": "receive",
                "body": rcv_body,
            })

        # 5. Modifiers
        mod_pat = re.compile(
            r"modifier\s+([A-Za-z0-9_]+)\s*(?:\(([^)]*)\))?\s*(?:virtual|override|\s)*\s*\{",
            re.DOTALL,
        )
        for match in mod_pat.finditer(body):
            m_name = match.group(1)
            m_args = (match.group(2) or "").strip()
            mod_body = self._match_braces(body, match.end() - 1)
            callables.append({
                "name": m_name,
                "arguments": m_args,
                "modifiers": "",
                "returns": None,
                "visibility": "internal",
                "callable_type": "modifier",
                "body": mod_body,
            })

        return callables

    def _extract_visibility(self, mods: str) -> str:
        for vis in ("external", "public", "private", "internal"):
            if vis in mods:
                return vis
        return "internal"

    def _extract_returns(self, mods: str) -> Optional[str]:
        m = re.search(r"returns\s*\(([^)]*)\)", mods)
        return m.group(1).strip() if m else None

    # ── State Variable Extraction ─────────────────────────────────────────

    def _extract_state_variables(self, body: str, file_path: str, contract: str) -> list[dict]:
        state_vars = []
        patterns = [
            # mapping(...) visibility name;
            r"(mapping\s*\([^)]+(?:\([^)]*\)[^)]*)*\))\s+(public|private|internal|constant|immutable)?\s*([A-Za-z0-9_]+)\s*[;=]",
            # Type[] visibility name;
            r"([A-Za-z0-9_]+\s*\[\s*\])\s+(public|private|internal|constant|immutable)?\s*([A-Za-z0-9_]+)\s*[;=]",
            # Simple types
            r"\b(uint\d*|int\d*|address|bool|string|bytes\d*|address payable)\s+(public|private|internal|constant|immutable)?\s*([A-Za-z0-9_]+)\s*[;=]",
            # Interface/struct types
            r"\b(I[A-Z][A-Za-z0-9_]*|IERC\d+|Enum[A-Za-z0-9_]*)\s+(public|private|internal|constant|immutable)?\s*([A-Za-z0-9_]+)\s*[;=]",
            # struct/enum instances: MyStruct visibility name;
            r"\b([A-Z][A-Za-z0-9_]*)\s+(public|private|internal|constant|immutable)\s+([A-Za-z0-9_]+)\s*[;=]",
        ]
        seen = set()
        skip_names = {"memory", "storage", "calldata", "returns", "return", "if", "else",
                       "for", "while", "function", "event", "error", "struct", "enum",
                       "contract", "interface", "library", "import", "pragma", "using"}
        for pat in patterns:
            for match in re.finditer(pat, body):
                v_type = match.group(1).strip()
                v_vis = match.group(2) or "internal"
                v_name = match.group(3).strip()
                if v_name in skip_names or v_name in seen:
                    continue
                seen.add(v_name)
                state_vars.append({"type": v_type, "visibility": v_vis, "name": v_name})
        return state_vars

    # ── Function Call Extraction ──────────────────────────────────────────

    def _extract_function_calls(self, func_body: str) -> list[str]:
        calls = set()
        # Match: foo(), this.foo(), SomeContract.foo(), _foo(), super.foo()
        for match in re.finditer(r"(?:([A-Za-z0-9_]+)\s*\.\s*)?([A-Za-z_][A-Za-z0-9_]*)\s*\(", func_body):
            prefix = match.group(1)
            fname = match.group(2)
            if fname in SKIP_CALLS:
                continue
            # Skip ERC20 methods when prefixed (those go to external calls)
            if prefix and fname in ERC20_METHODS:
                continue
            if prefix and prefix not in ("this", "super"):
                calls.add(f"{prefix}.{fname}")
            else:
                calls.add(fname)
        return sorted(calls)

    # ── External Call Extraction ──────────────────────────────────────────

    def _extract_external_calls(self, func_body: str) -> list[dict]:
        ext_calls = []
        seen = set()

        # 1. Low-level calls: .call{...}(, .call(, .delegatecall(, .staticcall(, .transfer(, .send(
        for match in re.finditer(
            r"([A-Za-z0-9_\[\].()]+)\s*\.\s*(call|delegatecall|staticcall|transfer|send)\s*[\({]",
            func_body,
        ):
            target = match.group(1).strip()
            method = match.group(2)
            key = f"{target}.{method}"
            if key not in seen:
                seen.add(key)
                ext_calls.append({"target": key, "type": "EXTERNAL_CALL", "subtype": method})

        # 2. ERC20 / interface method calls: token.transfer(, token.transferFrom(, etc.
        for match in re.finditer(
            r"([A-Za-z0-9_\[\].()]+)\s*\.\s*(" + "|".join(ERC20_METHODS) + r")\s*\(",
            func_body,
        ):
            target = match.group(1).strip()
            method = match.group(2)
            key = f"{target}.{method}"
            if key not in seen:
                seen.add(key)
                ext_calls.append({"target": key, "type": "EXTERNAL_CALL", "subtype": "erc20"})

        # 3. address(...).call pattern
        for match in re.finditer(r"address\s*\(\s*([^)]+)\s*\)\s*\.\s*(call|delegatecall|staticcall|transfer|send)", func_body):
            inner = match.group(1).strip()
            method = match.group(2)
            key = f"address({inner}).{method}"
            if key not in seen:
                seen.add(key)
                ext_calls.append({"target": key, "type": "EXTERNAL_CALL", "subtype": method})

        # 4. payable(...).transfer / .send
        for match in re.finditer(r"payable\s*\(\s*([^)]+)\s*\)\s*\.\s*(transfer|send)\s*\(", func_body):
            inner = match.group(1).strip()
            method = match.group(2)
            key = f"payable({inner}).{method}"
            if key not in seen:
                seen.add(key)
                ext_calls.append({"target": key, "type": "EXTERNAL_CALL", "subtype": method})

        # 5. Contract cast calls: ContractName(addr).method()
        #    e.g. SecondSwap_Vesting(plan).transferVesting(...)
        #         IVestingManager(mgr).setSellable(...)
        for match in re.finditer(
            r"([A-Z][A-Za-z0-9_]*)\s*\(\s*[^)]+\s*\)\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(",
            func_body,
        ):
            contract_type = match.group(1)
            method = match.group(2)
            # Skip known non-contract casts
            if contract_type in ("address", "payable", "uint256", "uint", "int256", "bytes32", "bytes"):
                continue
            key = f"{contract_type}.{method}"
            if key not in seen:
                seen.add(key)
                subtype = "erc20" if method in ERC20_METHODS else "cross_contract"
                ext_calls.append({"target": key, "type": "EXTERNAL_CALL", "subtype": subtype})

        # 6. Interface property access as calls: ISomething(addr).someGetter()
        for match in re.finditer(
            r"(I[A-Z][A-Za-z0-9_]*)\s*\(\s*[^)]+\s*\)\s*\.\s*([a-z_][A-Za-z0-9_]*)\s*\(",
            func_body,
        ):
            iface = match.group(1)
            method = match.group(2)
            key = f"{iface}.{method}"
            if key not in seen:
                seen.add(key)
                subtype = "erc20" if method in ERC20_METHODS else "interface_call"
                ext_calls.append({"target": key, "type": "EXTERNAL_CALL", "subtype": subtype})

        return ext_calls

    # ── State Access Detection ────────────────────────────────────────────

    def _extract_state_access(self, func_body: str, state_vars: set[str]) -> tuple[list[str], list[str]]:
        reads = set()
        writes = set()
        for var in state_vars:
            if not var:
                continue
            # Write patterns: var = ..., var +=, -=, *=, /=, var++, var--, var[x] =, delete var
            write_pat = re.compile(
                rf"(?:\b{re.escape(var)}\b\s*(?:\[[^\]]*\]\s*)?(?:=(?!=)|[+\-*/]=|\+\+|--))|(?:delete\s+{re.escape(var)}\b)"
            )
            if write_pat.search(func_body):
                writes.add(var)
            # Read: any usage
            read_pat = re.compile(rf"\b{re.escape(var)}\b")
            if read_pat.search(func_body):
                reads.add(var)
        return sorted(reads), sorted(writes)


if __name__ == "__main__":
    import sys

    target = sys.argv[1] if len(sys.argv) > 1 else "."
    parser = SolidityParser(target)
    out = parser.parse_all()
    print(f"Contracts: {len(out['contracts'])}")
    print(f"Functions: {len(out['functions'])}")
    print(f"State vars: {len(out['state_variables'])}")
    print(f"Imports: {len(out['imports'])}")
    print(f"Relationships: {len(out['relationships'])}")
    print(f"Contract map entries: {len(out['contract_map'])}")

    # Type breakdown
    types = {}
    for f in out["functions"]:
        t = f.get("callable_type", "function")
        types[t] = types.get(t, 0) + 1
    print(f"\nCallable type breakdown: {types}")

    # External calls
    ext = [r for r in out["relationships"] if r["type"] == "EXTERNAL_CALL"]
    print(f"\nExternal calls: {len(ext)}")
    for e in ext[:10]:
        print(f"  {e['source']} -> {e['target']} ({e.get('subtype', '?')})")
