from __future__ import annotations

import asyncio
import difflib
import json
import re
import subprocess
from pathlib import Path
from typing import Any

from ..base_agent import BaseAgent


class DiffAgent(BaseAgent):
    POLL_INTERVAL_SECONDS = 5 * 60
    SOURCE_EXTENSIONS = {".sol", ".vy", ".yul"}

    def __init__(self) -> None:
        super().__init__(
            name="DiffAgent",
            role="Runs security-focused differential review across revisions",
            skill_keys=["tob-differential-review", "audit-firm-1-solidity-auditor"],
            model="moonshotai/kimi-k2.5",
        )
        self._watching = False

    async def run(self, context: dict) -> dict:
        self.log_step("diff_run_started", {"context_keys": list(context.keys())})

        old_code = str(context.get("old_code", ""))
        new_code = str(context.get("new_code", ""))
        if not old_code and not new_code:
            raise ValueError("DiffAgent requires context['old_code'] and/or context['new_code']")

        raw_diff = self._compute_diff(old_code, new_code, context.get("file_path"))
        changed_lines = self._extract_changed_lines(raw_diff)
        self.log_step(
            "diff_computed",
            {"diff_lines": len(raw_diff.splitlines()), "changed_line_refs": len(changed_lines)},
        )

        llm_result = await self._analyze_diff_with_llm(raw_diff=raw_diff, changed_lines=changed_lines, context=context)
        result = self._normalize_result(llm_result, changed_lines)

        self.log_step(
            "diff_run_completed",
            {
                "net_security_change": result["net_security_change"],
                "new_attack_surfaces": len(result["new_attack_surfaces"]),
                "broken_invariants": len(result["broken_invariants"]),
                "resolved_issues": len(result["resolved_issues"]),
            },
        )
        return result

    async def watch_git(self, repo_path: str) -> dict:
        repo = Path(repo_path).expanduser().resolve()
        if not repo.exists() or not repo.is_dir():
            raise ValueError(f"Repository path does not exist or is not a directory: {repo}")

        self._ensure_git_repo(repo)
        self._watching = True
        analyses: list[dict[str, Any]] = []
        last_seen = self._run_git(repo, ["rev-parse", "HEAD"]).strip()

        self.log_step(
            "diff_watch_started",
            {
                "repo_path": str(repo),
                "poll_interval_seconds": self.POLL_INTERVAL_SECONDS,
                "head": last_seen,
            },
        )

        try:
            while True:
                await asyncio.sleep(self.POLL_INTERVAL_SECONDS)
                current_head = self._run_git(repo, ["rev-parse", "HEAD"]).strip()
                if current_head == last_seen:
                    continue

                commit_range = f"{last_seen}..{current_head}"
                commits = [
                    line.strip()
                    for line in self._run_git(repo, ["rev-list", "--reverse", commit_range]).splitlines()
                    if line.strip()
                ]
                if not commits:
                    last_seen = current_head
                    continue

                self.log_step(
                    "diff_watch_new_commits",
                    {"count": len(commits), "from": last_seen, "to": current_head},
                )

                for commit in commits:
                    parent = self._commit_parent(repo, commit)
                    if not parent:
                        continue

                    changed_files = self._list_changed_files(repo, parent, commit)
                    relevant_files = [
                        path for path in changed_files if Path(path).suffix.lower() in self.SOURCE_EXTENSIONS
                    ]
                    if not relevant_files:
                        continue

                    self.log_step(
                        "diff_watch_commit_detected",
                        {
                            "commit": commit,
                            "parent": parent,
                            "changed_files": len(changed_files),
                            "relevant_files": len(relevant_files),
                        },
                    )

                    for file_path in relevant_files:
                        old_code = self._git_show_file(repo, parent, file_path)
                        new_code = self._git_show_file(repo, commit, file_path)
                        diff_result = await self.run(
                            {
                                "old_code": old_code,
                                "new_code": new_code,
                                "file_path": file_path,
                                "old_ref": parent,
                                "new_ref": commit,
                            }
                        )
                        analyses.append(
                            {
                                "commit": commit,
                                "parent": parent,
                                "file_path": file_path,
                                "result": diff_result,
                            }
                        )

                last_seen = current_head
        except asyncio.CancelledError:
            self._watching = False
            self.log_step(
                "diff_watch_cancelled",
                {"repo_path": str(repo), "processed_analyses": len(analyses), "last_seen": last_seen},
            )
            raise
        except Exception as exc:
            self._watching = False
            self.log_step("diff_watch_failed", {"repo_path": str(repo), "error": str(exc)})
            return {
                "status": "failed",
                "repo_path": str(repo),
                "error": str(exc),
                "processed_analyses": len(analyses),
                "latest_head": last_seen,
            }

    async def _analyze_diff_with_llm(
        self,
        raw_diff: str,
        changed_lines: list[str],
        context: dict,
    ) -> dict[str, Any]:
        system_extra = (
            "Security-focused differential review with git history analysis. "
            "What new attack surface opened? What invariants broke? "
            "What was safe before that isn't now? Reference exact changed lines.\n\n"
            "Return ONLY valid JSON with keys: "
            "diff_summary (str), new_attack_surfaces (array[str]), broken_invariants (array[str]), "
            "resolved_issues (array[str]), net_security_change (str), recommendation (str)."
        )
        payload = {
            "file_path": str(context.get("file_path", "")).strip(),
            "old_ref": str(context.get("old_ref", "")).strip(),
            "new_ref": str(context.get("new_ref", "")).strip(),
            "changed_lines": changed_lines[:500],
            "raw_diff": raw_diff[:50000],
        }

        try:
            llm_output = await self.call_llm(
                system_extra=system_extra,
                messages=[{"role": "user", "content": json.dumps(payload, default=str)}],
            )
            parsed = self._parse_json_output(llm_output)
            if parsed:
                return parsed
        except Exception as exc:  # pragma: no cover - env/network dependent
            self.log_step("diff_llm_failed", {"error": str(exc)})

        return self._fallback_result(raw_diff, changed_lines)

    def _fallback_result(self, raw_diff: str, changed_lines: list[str]) -> dict[str, Any]:
        additions = 0
        deletions = 0
        for line in raw_diff.splitlines():
            if line.startswith("+++ ") or line.startswith("--- "):
                continue
            if line.startswith("+"):
                additions += 1
            elif line.startswith("-"):
                deletions += 1

        if additions > deletions:
            net = "potential_regression"
        elif deletions > additions:
            net = "potential_hardening"
        else:
            net = "neutral"

        return {
            "diff_summary": (
                "Fallback diff analysis used. Review changed lines for security impact."
            ),
            "new_attack_surfaces": [],
            "broken_invariants": [],
            "resolved_issues": [],
            "net_security_change": net,
            "recommendation": (
                "Run full manual security review for changed functions and add focused regression tests."
            ),
        }

    def _compute_diff(self, old_code: str, new_code: str, file_path: Any) -> str:
        name = str(file_path or "contract.sol")
        old_lines = old_code.splitlines(keepends=True)
        new_lines = new_code.splitlines(keepends=True)
        diff = difflib.unified_diff(
            old_lines,
            new_lines,
            fromfile=f"a/{name}",
            tofile=f"b/{name}",
            lineterm="",
            n=3,
        )
        return "\n".join(diff)

    @staticmethod
    def _extract_changed_lines(raw_diff: str) -> list[str]:
        refs: list[str] = []
        old_line = 0
        new_line = 0

        for line in raw_diff.splitlines():
            if line.startswith("@@"):
                match = re.search(r"@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@", line)
                if match:
                    old_line = int(match.group(1))
                    new_line = int(match.group(2))
                continue

            if line.startswith("+++ ") or line.startswith("--- "):
                continue

            if line.startswith("+"):
                refs.append(f"new:{new_line}")
                new_line += 1
                continue

            if line.startswith("-"):
                refs.append(f"old:{old_line}")
                old_line += 1
                continue

            old_line += 1
            new_line += 1

        deduped: list[str] = []
        seen: set[str] = set()
        for ref in refs:
            if ref not in seen:
                seen.add(ref)
                deduped.append(ref)
        return deduped

    def _normalize_result(self, raw: dict[str, Any], changed_lines: list[str]) -> dict[str, Any]:
        return {
            "diff_summary": str(raw.get("diff_summary", "")).strip()
            or "No differential summary provided.",
            "new_attack_surfaces": self._to_str_list(raw.get("new_attack_surfaces", [])),
            "broken_invariants": self._to_str_list(raw.get("broken_invariants", [])),
            "resolved_issues": self._to_str_list(raw.get("resolved_issues", [])),
            "net_security_change": str(raw.get("net_security_change", "unknown")).strip() or "unknown",
            "recommendation": str(raw.get("recommendation", "")).strip()
            or "Perform targeted manual review on changed lines.",
        }

    @staticmethod
    def _parse_json_output(raw: str) -> dict[str, Any]:
        from core.utils import parse_llm_json
        return parse_llm_json(raw)

    @staticmethod
    def _to_str_list(value: Any) -> list[str]:
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        if value in ("", None):
            return []
        return [str(value).strip()]

    @staticmethod
    def _ensure_git_repo(repo: Path) -> None:
        git_dir = repo / ".git"
        if not git_dir.exists():
            raise ValueError(f"Not a git repository: {repo}")

    def _run_git(self, repo: Path, args: list[str]) -> str:
        try:
            proc = subprocess.run(
                ["git", *args],
                cwd=repo,
                check=False,
                capture_output=True,
                text=True,
            )
        except FileNotFoundError as exc:
            raise RuntimeError("git executable is not available") from exc

        if proc.returncode != 0:
            stderr = (proc.stderr or "").strip()
            raise RuntimeError(f"git {' '.join(args)} failed: {stderr}")
        return proc.stdout

    def _commit_parent(self, repo: Path, commit: str) -> str:
        try:
            return self._run_git(repo, ["rev-parse", f"{commit}^"]).strip()
        except Exception:
            return ""

    def _list_changed_files(self, repo: Path, old_ref: str, new_ref: str) -> list[str]:
        output = self._run_git(repo, ["diff", "--name-only", old_ref, new_ref])
        files: list[str] = []
        for line in output.splitlines():
            path = line.strip()
            if path:
                files.append(path)
        return files

    def _git_show_file(self, repo: Path, ref: str, file_path: str) -> str:
        try:
            return self._run_git(repo, ["show", f"{ref}:{file_path}"])
        except Exception:
            return ""
