import json
import os
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Optional


class SRPProject:
    """
    Represents the current project SRP is running inside.
    Scans the project, remembers config, tracks audit history.
    All data saved to .srp/ in project root.
    """

    CONFIG_FILE = ".srp/config.json"
    AUDIT_DIR = ".srp/audits"
    TRACES_DIR = ".srp/traces"
    REPORTS_DIR = ".srp/reports"
    PATCHES_DIR = ".srp/patches"

    def __init__(self, root: str = "."):
        self.root = Path(root).resolve()
        self.config = {}
        self.initialized = self._check_initialized()

    def _check_initialized(self) -> bool:
        return (self.root / self.CONFIG_FILE).exists()

    # ─── INIT ────────────────────────────────────────────────────────────────

    def initialize(self, repo_url: str = "") -> dict:
        """
        Run once on `srp init`. Scans entire project.
        Saves .srp/config.json. Returns config dict.
        """
        for d in [self.AUDIT_DIR, self.TRACES_DIR, self.REPORTS_DIR, self.PATCHES_DIR]:
            (self.root / d).mkdir(parents=True, exist_ok=True)

        gitignore = self.root / ".gitignore"
        if gitignore.exists():
            content = gitignore.read_text()
            if ".srp/" not in content:
                with open(gitignore, "a") as f:
                    f.write("\n# SRP Security Reasoning Protocol\n.srp/\n")
        else:
            gitignore.write_text("# SRP Security Reasoning Protocol\n.srp/\n")

        project_type = self._detect_project_type()
        compiler = self._detect_compiler_version()
        all_contracts = self._find_all_contracts()
        entry_points = self._detect_entry_contracts(all_contracts)
        git_url = repo_url or self._detect_repo_url()
        dep_graph = self._build_import_graph(all_contracts)
        project_name = self.root.name

        config = {
            "project_name": project_name,
            "root": str(self.root),
            "detected_type": project_type,
            "repo_url": git_url,
            "contracts_dir": self._detect_contracts_dir(),
            "all_contracts": all_contracts,
            "entry_contracts": entry_points,
            "dependency_graph": dep_graph,
            "compiler_version": compiler,
            "total_contracts": len(all_contracts),
            "initialized_at": datetime.utcnow().isoformat() + "Z",
            "last_audit": None,
            "srp_version": "srp-2026.3",
        }

        config_path = self.root / self.CONFIG_FILE
        config_path.write_text(json.dumps(config, indent=2))
        self.config = config
        self.initialized = True
        return config

    def load(self) -> dict:
        if not self.initialized:
            raise RuntimeError("SRP not initialized. Run `srp init` first.")
        self.config = json.loads((self.root / self.CONFIG_FILE).read_text())
        return self.config

    # ─── DETECTORS ───────────────────────────────────────────────────────────

    def _detect_project_type(self) -> str:
        if (self.root / "foundry.toml").exists():
            return "foundry"
        if (self.root / "hardhat.config.js").exists():
            return "hardhat"
        if (self.root / "hardhat.config.ts").exists():
            return "hardhat"
        if (self.root / "truffle-config.js").exists():
            return "truffle"
        if (self.root / "brownie-config.yaml").exists():
            return "brownie"
        if (self.root / "dappfile").exists():
            return "dapp"
        return "unknown"

    def _detect_contracts_dir(self) -> str:
        for d in ["contracts", "src", "protocol/contracts"]:
            if (self.root / d).exists():
                return d
        return "."

    def _detect_compiler_version(self) -> str:
        try:
            foundry = self.root / "foundry.toml"
            if foundry.exists():
                for line in foundry.read_text().splitlines():
                    if "solc" in line and "=" in line:
                        val = line.split("=")[-1].strip().strip('"').strip("'")
                        if val and val[0].isdigit():
                            return val
        except Exception:
            pass

        hardhat = self.root / "hardhat.config.js"
        if hardhat.exists():
            for line in hardhat.read_text().splitlines():
                if "version" in line and "0." in line:
                    import re

                    m = re.search(r"0\.\d+\.\d+", line)
                    if m:
                        return m.group()

        contracts = self._find_all_contracts()
        if contracts:
            code = (self.root / contracts[0]).read_text()
            import re

            m = re.search(r"pragma solidity [^;]+;", code)
            if m:
                ver = re.search(r"0\.\d+\.\d+", m.group())
                if ver:
                    return ver.group()

        return "0.8.20"

    def _find_all_contracts(self) -> list:
        contracts = []
        exclude = {"node_modules", ".git", "lib", "cache", "out", "artifacts", ".srp"}
        for path in self.root.rglob("*.sol"):
            skip = False
            rel = path.relative_to(self.root)
            for part in rel.parts:
                if part in exclude:
                    skip = True
                    break
            if skip:
                continue
            contracts.append(str(rel))
        return sorted(contracts)

    def _detect_entry_contracts(self, all_contracts: list) -> list:
        imported = set()
        for c in all_contracts:
            try:
                code = (self.root / c).read_text()
                for line in code.splitlines():
                    if line.strip().startswith("import"):
                        import re

                        m = re.search(r'["\']([^"\']+\.sol)["\']', line)
                        if m:
                            imported.add(Path(m.group(1)).name)
            except Exception:
                continue
        entries = []
        for c in all_contracts:
            name = Path(c).name
            skip_keywords = ["interface", "Interface", "Mock", "Test", "test", "Base", "Abstract"]
            if any(k in name for k in skip_keywords):
                continue
            if name not in imported or name.endswith(".sol"):
                entries.append(c)
        return entries[:10]

    def _build_import_graph(self, all_contracts: list) -> dict:
        graph = {}
        for c in all_contracts:
            try:
                code = (self.root / c).read_text()
                imports = []
                import re

                for line in code.splitlines():
                    if line.strip().startswith("import"):
                        m = re.search(r'["\']([^"\']+\.sol)["\']', line)
                        if m:
                            imports.append(m.group(1))
                graph[c] = imports
            except Exception:
                graph[c] = []
        return graph

    def _detect_repo_url(self) -> str:
        try:
            result = subprocess.run(
                ["git", "config", "--get", "remote.origin.url"],
                capture_output=True,
                text=True,
                cwd=str(self.root),
            )
            url = result.stdout.strip()
            if not url:
                return ""
            if url.startswith("git@github.com:"):
                url = url.replace("git@github.com:", "https://github.com/")
                url = url.replace(".git", "")
            elif url.endswith(".git"):
                url = url[:-4]
            return url
        except Exception:
            return ""

    # ─── CONTRACT READER ─────────────────────────────────────────────────────

    def read_all_contracts(self) -> dict:
        sources = {}
        for c in self.config.get("all_contracts", []):
            try:
                sources[c] = (self.root / c).read_text()
            except Exception:
                sources[c] = ""
        return sources

    def get_full_project_context(self) -> dict:
        sources = self.read_all_contracts()
        total_lines = sum(len(s.splitlines()) for s in sources.values())
        return {
            "project_name": self.config.get("project_name"),
            "repo_url": self.config.get("repo_url"),
            "project_type": self.config.get("detected_type"),
            "compiler_version": self.config.get("compiler_version"),
            "all_contracts": sources,
            "entry_contracts": self.config.get("entry_contracts", []),
            "dependency_graph": self.config.get("dependency_graph", {}),
            "total_contracts": self.config.get("total_contracts", 0),
            "total_lines": total_lines,
            "contracts_dir": str(self.root / self.config.get("contracts_dir", "contracts")),
        }

    # ─── AUDIT HISTORY ───────────────────────────────────────────────────────

    def save_audit(self, trace_id: str, result: dict):
        audit_path = self.root / self.AUDIT_DIR / f"{trace_id}.json"
        audit_path.write_text(json.dumps(result, indent=2))
        self.config["last_audit"] = {
            "trace_id": trace_id,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "score": result.get("defense", {}).get("security_score"),
            "findings": len(result.get("defense", {}).get("confirmed_vulnerabilities", [])),
        }
        (self.root / self.CONFIG_FILE).write_text(json.dumps(self.config, indent=2))

    def list_audits(self) -> list:
        audits = []
        audit_dir = self.root / self.AUDIT_DIR
        if audit_dir.exists():
            for f in sorted(audit_dir.glob("*.json"), reverse=True):
                try:
                    data = json.loads(f.read_text())
                    audits.append(
                        {
                            "trace_id": f.stem,
                            "timestamp": data.get("trace", {}).get("timestamp", ""),
                            "score": data.get("defense", {}).get("security_score", "N/A"),
                            "findings": len(
                                data.get("defense", {}).get("confirmed_vulnerabilities", [])
                            ),
                        }
                    )
                except Exception:
                    continue
        return audits

    def save_report(self, trace_id: str, report_md: str):
        report_path = self.root / self.REPORTS_DIR / f"{trace_id}.md"
        report_path.write_text(report_md)
        return str(report_path)

    def save_trace(self, trace_id: str, trace: dict):
        trace_path = self.root / self.TRACES_DIR / f"{trace_id}.json"
        trace_path.write_text(json.dumps(trace, indent=2))
        return str(trace_path)

    def save_patch(self, trace_id: str, patched_sol: str):
        patch_path = self.root / self.PATCHES_DIR / f"{trace_id}_patched.sol"
        patch_path.write_text(patched_sol)
        return str(patch_path)
