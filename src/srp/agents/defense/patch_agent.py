from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from uuid import uuid4

from ..base_agent import BaseAgent


class PatchAgent(BaseAgent):
    def __init__(self) -> None:
        super().__init__(
            name="PatchAgent",
            role="Generates minimal production-grade fixes, tests, and patch safety review",
            skill_keys=[
                "cyfrin-solskill",
                "ethskills-security",
                "ethskills-testing",
                "tob-fix-review",
            ],
        )

    async def run(self, context: dict) -> dict:
        self.log_step("patch_run_started", {"context_keys": list(context.keys())})

        confirmed_vulns = self._extract_confirmed_vulnerabilities(context)
        contract_code = self._resolve_contract_code(context)
        trace_id = self._resolve_trace_id(context)

        self.log_step(
            "patch_inputs_prepared",
            {
                "confirmed_vulnerabilities": len(confirmed_vulns),
                "contract_code_chars": len(contract_code),
                "trace_id": trace_id,
            },
        )

        current_contract = contract_code
        patches: list[dict[str, Any]] = []
        fix_review_notes: list[dict[str, Any]] = []
        test_blocks: list[str] = []

        for index, vulnerability in enumerate(confirmed_vulns, start=1):
            self.log_step(
                "patch_vulnerability_started",
                {
                    "index": index,
                    "vulnerability_id": vulnerability.get("id", f"vuln-{index}"),
                    "title": vulnerability.get("title", ""),
                },
            )

            patch_payload = await self._generate_minimal_fix(
                vulnerability=vulnerability,
                contract_code=current_contract,
                index=index,
            )
            fixed_contract = str(patch_payload.get("fixed_contract", "")).strip()
            if fixed_contract:
                current_contract = fixed_contract

            fuzz_test = str(patch_payload.get("fuzz_test", "")).strip()
            if fuzz_test:
                test_blocks.append(
                    f"// === Patch Test {index}: {vulnerability.get('title', 'finding')} ===\n{fuzz_test}\n"
                )

            review_payload = await self._run_fix_review(
                vulnerability=vulnerability,
                fixed_contract=current_contract,
                patch_payload=patch_payload,
            )
            checklist_payload = await self._run_predeploy_checklist(
                vulnerability=vulnerability,
                fixed_contract=current_contract,
            )

            patch_record = {
                "id": str(vulnerability.get("id", f"vuln-{index}")),
                "title": str(vulnerability.get("title", "Untitled vulnerability")),
                "severity": str(vulnerability.get("final_severity", vulnerability.get("severity", "medium"))),
                "patch_summary": str(patch_payload.get("patch_summary", "")).strip(),
                "natspec_comment": str(patch_payload.get("natspec_comment", "")).strip(),
                "changed_functions": self._to_str_list(patch_payload.get("changed_functions", [])),
                "fuzz_test": fuzz_test,
                "fix_review": review_payload,
                "security_checklist": checklist_payload,
            }
            patches.append(patch_record)
            fix_review_notes.append(
                {
                    "id": patch_record["id"],
                    "title": patch_record["title"],
                    "introduces_new_surface": bool(
                        review_payload.get("introduces_new_surface", False)
                    ),
                    "notes": str(review_payload.get("fix_review_notes", "")).strip(),
                }
            )

            self.log_step(
                "patch_vulnerability_completed",
                {
                    "index": index,
                    "vulnerability_id": patch_record["id"],
                    "has_fuzz_test": bool(fuzz_test),
                    "new_surface": bool(review_payload.get("introduces_new_surface", False)),
                },
            )

        patched_contract_path, test_file_path = self._save_outputs(
            trace_id=trace_id,
            patched_contract=current_contract,
            test_content=self._build_test_file_content(trace_id, test_blocks),
        )

        result = {
            "patches": patches,
            "patched_contract_path": str(patched_contract_path),
            "test_file_path": str(test_file_path),
            "fix_review_notes": fix_review_notes,
        }
        self.log_step(
            "patch_run_completed",
            {
                "patch_count": len(patches),
                "patched_contract_path": str(patched_contract_path),
                "test_file_path": str(test_file_path),
            },
        )
        return result

    async def _generate_minimal_fix(
        self, vulnerability: dict[str, Any], contract_code: str, index: int
    ) -> dict[str, Any]:
        system_extra = (
            "Generate the minimal Solidity fix for this confirmed vulnerability using production standards. "
            "Only change what is necessary. Include a NatSpec explanation comment and a Foundry fuzz test "
            "that proves the vulnerability is fixed. "
            "Return ONLY valid JSON with keys: "
            "patch_summary, natspec_comment, fixed_contract, fuzz_test, changed_functions."
        )
        payload = {
            "vulnerability": vulnerability,
            "contract_code": contract_code,
        }
        llm_output = await self._safe_llm_call(
            step_name="patch_generate_fix_llm",
            system_extra=system_extra,
            messages=[{"role": "user", "content": json.dumps(payload, default=str)}],
            fallback={
                "patch_summary": "LLM generation failed; no automatic patch produced.",
                "natspec_comment": "",
                "fixed_contract": contract_code,
                "fuzz_test": "",
                "changed_functions": [],
            },
        )

        parsed = self._parse_json_output(llm_output)
        if not parsed:
            parsed = {
                "patch_summary": "No patch payload parsed from model output.",
                "natspec_comment": "",
                "fixed_contract": contract_code,
                "fuzz_test": "",
                "changed_functions": [],
            }
        parsed.setdefault("fixed_contract", contract_code)
        return parsed

    async def _run_fix_review(
        self,
        vulnerability: dict[str, Any],
        fixed_contract: str,
        patch_payload: dict[str, Any],
    ) -> dict[str, Any]:
        system_extra = (
            "Run a fix-review pass and check whether the patch introduces new attack surface. "
            "Return ONLY valid JSON with keys: introduces_new_surface, fix_review_notes, new_risks."
        )
        payload = {
            "vulnerability": vulnerability,
            "patch_summary": patch_payload.get("patch_summary", ""),
            "fixed_contract": fixed_contract,
        }
        llm_output = await self._safe_llm_call(
            step_name="patch_fix_review_llm",
            system_extra=system_extra,
            messages=[{"role": "user", "content": json.dumps(payload, default=str)}],
            fallback={
                "introduces_new_surface": False,
                "fix_review_notes": "Fix review unavailable.",
                "new_risks": [],
            },
        )
        parsed = self._parse_json_output(llm_output)
        if not parsed:
            parsed = {
                "introduces_new_surface": False,
                "fix_review_notes": "No fix-review payload parsed.",
                "new_risks": [],
            }
        parsed["introduces_new_surface"] = bool(parsed.get("introduces_new_surface", False))
        parsed["new_risks"] = self._to_str_list(parsed.get("new_risks", []))
        return parsed

    async def _run_predeploy_checklist(
        self, vulnerability: dict[str, Any], fixed_contract: str
    ) -> dict[str, Any]:
        system_extra = (
            "Run an ethskills pre-deploy security checklist on the fixed contract. "
            "Return ONLY valid JSON with keys: checklist_summary, checklist_items, blockers. "
            "checklist_items must be an array of objects with item, status, notes."
        )
        payload = {"vulnerability": vulnerability, "fixed_contract": fixed_contract}
        llm_output = await self._safe_llm_call(
            step_name="patch_checklist_llm",
            system_extra=system_extra,
            messages=[{"role": "user", "content": json.dumps(payload, default=str)}],
            fallback={
                "checklist_summary": "Checklist unavailable.",
                "checklist_items": [],
                "blockers": [],
            },
        )
        parsed = self._parse_json_output(llm_output)
        if not parsed:
            parsed = {
                "checklist_summary": "No checklist payload parsed.",
                "checklist_items": [],
                "blockers": [],
            }
        checklist_items = parsed.get("checklist_items", [])
        if not isinstance(checklist_items, list):
            checklist_items = []
        parsed["checklist_items"] = [item for item in checklist_items if isinstance(item, dict)]
        parsed["blockers"] = self._to_str_list(parsed.get("blockers", []))
        return parsed

    async def _safe_llm_call(
        self,
        step_name: str,
        system_extra: str,
        messages: list[dict[str, Any]],
        fallback: dict[str, Any],
    ) -> str:
        try:
            return await self.call_llm(system_extra=system_extra, messages=messages)
        except Exception as exc:  # pragma: no cover - network/env dependent
            self.log_step(step_name, {"status": "fallback", "error": str(exc)})
            return json.dumps(fallback)

    def _extract_confirmed_vulnerabilities(self, context: dict[str, Any]) -> list[dict[str, Any]]:
        direct = context.get("confirmed_vulnerabilities")
        if isinstance(direct, list):
            return [item for item in direct if isinstance(item, dict)]

        defense = context.get("defense_output")
        if isinstance(defense, dict):
            inner = defense.get("confirmed_vulnerabilities")
            if isinstance(inner, list):
                return [item for item in inner if isinstance(item, dict)]

        defense_alt = context.get("defense")
        if isinstance(defense_alt, dict):
            inner = defense_alt.get("confirmed_vulnerabilities")
            if isinstance(inner, list):
                return [item for item in inner if isinstance(item, dict)]

        vulnerabilities = context.get("vulnerabilities")
        if isinstance(vulnerabilities, list):
            return [item for item in vulnerabilities if isinstance(item, dict)]

        return []

    def _resolve_contract_code(self, context: dict[str, Any]) -> str:
        code = context.get("contract_code")
        if isinstance(code, str) and code.strip():
            return code

        contract_path = context.get("contract_path")
        if isinstance(contract_path, str) and contract_path.strip():
            path = Path(contract_path).expanduser()
            if not path.is_absolute():
                path = Path.cwd() / path
            if path.exists() and path.is_file():
                return path.read_text(encoding="utf-8")

        paths = context.get("contract_paths", [])
        if isinstance(paths, list):
            for raw_path in paths:
                path = Path(str(raw_path)).expanduser()
                if not path.is_absolute():
                    path = Path.cwd() / path
                if path.exists() and path.is_file() and path.suffix == ".sol":
                    return path.read_text(encoding="utf-8")

        return ""

    def _resolve_trace_id(self, context: dict[str, Any]) -> str:
        trace_id = context.get("trace_id")
        if trace_id:
            return str(trace_id)

        trace_output = context.get("trace_output")
        if isinstance(trace_output, dict) and trace_output.get("trace_id"):
            return str(trace_output.get("trace_id"))

        trace = context.get("trace")
        if isinstance(trace, dict) and trace.get("trace_id"):
            return str(trace.get("trace_id"))

        return str(uuid4())

    def _save_outputs(
        self, trace_id: str, patched_contract: str, test_content: str
    ) -> tuple[Path, Path]:
        patches_dir = Path.cwd() / "patches"
        patches_dir.mkdir(parents=True, exist_ok=True)

        patched_contract_path = patches_dir / f"{trace_id}_patched.sol"
        test_file_path = patches_dir / f"{trace_id}_test.t.sol"

        patched_contract_path.write_text(patched_contract, encoding="utf-8")
        test_file_path.write_text(test_content, encoding="utf-8")

        return patched_contract_path, test_file_path

    @staticmethod
    def _build_test_file_content(trace_id: str, test_blocks: list[str]) -> str:
        header = (
            "// SPDX-License-Identifier: MIT\n"
            "pragma solidity ^0.8.20;\n\n"
            f"// Auto-generated patch tests for trace: {trace_id}\n"
            "import \"forge-std/Test.sol\";\n\n"
            "contract PatchVerificationTest is Test {\n"
        )
        footer = "}\n"

        if not test_blocks:
            body = (
                "    function test_patchPlaceholder() public {\n"
                "        assertTrue(true, \"No autogenerated fuzz test blocks were produced.\");\n"
                "    }\n"
            )
        else:
            indented = []
            for block in test_blocks:
                for line in block.splitlines():
                    indented.append(f"    {line}")
            body = "\n".join(indented).rstrip() + "\n"

        return f"{header}{body}{footer}"

    @staticmethod
    def _to_str_list(raw: Any) -> list[str]:
        if isinstance(raw, list):
            return [str(item).strip() for item in raw if str(item).strip()]
        if raw is None:
            return []
        value = str(raw).strip()
        return [value] if value else []

    def _parse_json_output(self, llm_output: str) -> dict[str, Any]:
        from srp.core.utils import parse_llm_json
        parsed = parse_llm_json(llm_output)
        if not parsed:
            self.log_step(
                "patch_parse_failed",
                {"error": "parse error", "raw_preview": llm_output[:1000]},
            )
        return parsed
