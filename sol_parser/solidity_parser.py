import os
import re
import json
from pathlib import Path


class SolidityParser:
    """
    A foundational Solidity parser extracting contracts, functions, state variables,
    imports, and inheritance links from a directory of .sol files.
    """

    def __init__(self, root_dir: str):
        self.root_dir = Path(root_dir)
        self.files: list[Path] = []
        self._find_files()

    def _find_files(self):
        for path in self.root_dir.rglob("*.sol"):
            self.files.append(path)

    def parse_all(self) -> dict:
        results = {
            "contracts": [],
            "functions": [],
            "state_variables": [],
            "imports": [],
            "relationships": [],
        }
        for file_path in self.files:
            try:
                content = file_path.read_text(encoding="utf-8")
                self._parse_file(str(file_path), content, results)
            except Exception as e:
                print(f"Error parsing {file_path}: {e}")
        return results

    def _parse_file(self, file_path: str, content: str, results: dict):
        # Strip comments
        no_comments = re.sub(r"//.*", "", content)
        no_comments = re.sub(r"/\*.*?\*/", "", no_comments, flags=re.DOTALL)

        # 1. Imports
        for imp in re.findall(r'import\s+["\'](.+?)["\'];', no_comments):
            results["imports"].append({"file": file_path, "imports": imp})

        # 2. Contracts & Inheritance
        for match in re.finditer(
            r"(contract|interface|library)\s+([A-Za-z0-9_]+)(?:\s+is\s+([^{]+))?\s*\{",
            no_comments,
        ):
            c_type, c_name, c_inherit_raw = match.group(1), match.group(2), match.group(3)
            inherits = []
            if c_inherit_raw:
                inherits = [p.strip() for p in c_inherit_raw.split(",")]
                for p in inherits:
                    results["relationships"].append(
                        {"source": c_name, "target": p, "type": "INHERITS"}
                    )
            results["contracts"].append(
                {"type": c_type, "name": c_name, "inherits": inherits, "file": file_path}
            )

        # 3. Functions
        for match in re.finditer(
            r"function\s+([A-Za-z0-9_]+)\s*\((.*?)\)\s*(.*?)(?:returns\s*\((.*?)\))?\s*[{;]",
            no_comments,
            re.DOTALL,
        ):
            results["functions"].append(
                {
                    "name": match.group(1),
                    "arguments": match.group(2).strip(),
                    "modifiers": match.group(3).strip(),
                    "returns": match.group(4).strip() if match.group(4) else None,
                    "file": file_path,
                }
            )

        # 4. State Variables (basic heuristic)
        for match in re.finditer(
            r"(uint\d*|int\d*|address|bool|string|bytes\d*|mapping[^\s]*)\s+"
            r"(public|private|internal)?\s*([A-Za-z0-9_]+)\s*[=;]",
            no_comments,
        ):
            results["state_variables"].append(
                {
                    "type": match.group(1),
                    "visibility": match.group(2) or "internal",
                    "name": match.group(3),
                    "file": file_path,
                }
            )


if __name__ == "__main__":
    import sys

    target = sys.argv[1] if len(sys.argv) > 1 else "."
    parser = SolidityParser(target)
    out = parser.parse_all()
    print(json.dumps(out, indent=2))
