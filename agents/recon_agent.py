from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .base_agent import BaseAgent


class ReconAgent(BaseAgent):
    def __init__(self, model: str = "claude-sonnet-4-20250514") -> None:
        super().__init__(
            name="ReconAgent",
            role="Maps contract architecture and identifies entry points",
        )

    async def run(self, context: dict) -> dict:
        self.log_step("recon_run_started", {"context_keys": list(context.keys())})

        contract_paths = context.get("contract_paths", [])
        if not isinstance(contract_paths, list):
            contract_paths = [contract_paths]
        self.log_step(
            "recon_inputs_extracted",
            {
                "contract_path_count": len(contract_paths),
                "contract_paths": [str(path) for path in contract_paths],
            },
        )

        sol_files = self._collect_sol_files(contract_paths)
        self.log_step(
            "recon_sol_files_discovered",
            {"sol_file_count": len(sol_files), "sol_files": sol_files},
        )

        source_payload = self._build_source_payload(sol_files)
        self.log_step(
            "recon_sol_sources_loaded",
            {
                "loaded_file_count": source_payload["loaded_file_count"],
                "total_source_chars": source_payload["total_source_chars"],
                "failed_files": source_payload["failed_files"],
            },
        )

        system_prompt = (
            "You are a smart contract reconnaissance analyst. "
            "Analyze Solidity contracts and return ONLY valid JSON with this exact shape: "
            "{"
            "\"contract_map\": {"
            "\"contracts\": [], "
            "\"modifiers\": [], "
            "\"inheritance_tree\": [], "
            "\"identified_interfaces\": []"
            "}, "
            "\"functions\": [], "
            "\"state_vars\": [], "
            "\"external_calls\": [], "
            "\"entry_points\": [], "
            "\"risk_surface\": []"
            "}. "
            "Include all functions with visibility, all state variables, all external calls, "
            "all modifiers, inheritance tree details, and identified interfaces."
        )
        user_prompt = (
            "Contract paths:\n"
            f"{json.dumps(sol_files)}\n\n"
            "Solidity sources:\n"
            f"{source_payload['sources_text']}"
        )
        messages = [{"role": "user", "content": user_prompt}]
        self.log_step(
            "recon_prompt_built",
            {
                "system_preview": system_prompt[:320],
                "message_count": len(messages),
                "user_prompt_chars": len(user_prompt),
            },
        )

        llm_output = await self.call_llm(system_extra=system_prompt, messages=messages)
        self.log_step("recon_llm_response_received", {"response_preview": llm_output[:1000]})

        try:
            parsed = self._parse_json_output(llm_output)
            self.log_step("recon_llm_response_parsed", {"parsed_keys": list(parsed.keys())})
        except json.JSONDecodeError as exc:
            self.log_step(
                "recon_llm_response_parse_failed",
                {"error": str(exc), "raw_response_preview": llm_output[:1000]},
            )
            parsed = {}

        result = self._normalize_recon_result(parsed)
        self.log_step("recon_result_normalized", {"result": result})
        return result

    def _collect_sol_files(self, contract_paths: list[Any]) -> list[str]:
        discovered: list[str] = []
        seen: set[str] = set()

        for raw_path in contract_paths:
            if raw_path is None:
                continue

            path = Path(str(raw_path)).expanduser()
            if not path.is_absolute():
                path = Path.cwd() / path

            if path.is_file() and path.suffix == ".sol":
                key = str(path.resolve())
                if key not in seen:
                    seen.add(key)
                    discovered.append(key)
                continue

            if path.is_dir():
                for sol_file in sorted(path.rglob("*.sol")):
                    key = str(sol_file.resolve())
                    if key not in seen:
                        seen.add(key)
                        discovered.append(key)

        return discovered

    def _build_source_payload(self, sol_files: list[str]) -> dict[str, Any]:
        sources: list[str] = []
        failed_files: list[dict[str, str]] = []
        total_source_chars = 0

        for file_path in sol_files:
            try:
                content = Path(file_path).read_text(encoding="utf-8")
                total_source_chars += len(content)
                sources.append(
                    f"File: {file_path}\n```sol\n{content}\n```\n"
                )
            except OSError as exc:
                failed_files.append({"path": file_path, "error": str(exc)})
                self.log_step(
                    "recon_sol_file_read_failed",
                    {"path": file_path, "error": str(exc)},
                )

        return {
            "sources_text": "\n".join(sources),
            "loaded_file_count": len(sources),
            "total_source_chars": total_source_chars,
            "failed_files": failed_files,
        }

    def _parse_json_output(self, llm_output: str) -> dict:
        text = llm_output.strip()
        if text.startswith("```"):
            lines = text.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            text = "\n".join(lines).strip()
        return json.loads(text)

    def _normalize_recon_result(self, parsed: dict) -> dict:
        contract_map = parsed.get("contract_map", {})
        if not isinstance(contract_map, dict):
            contract_map = {}

        functions = self._normalize_list(parsed.get("functions", []))
        state_vars = self._normalize_list(parsed.get("state_vars", []))
        external_calls = self._normalize_list(parsed.get("external_calls", []))
        entry_points = self._normalize_list(parsed.get("entry_points", []))
        risk_surface = self._normalize_list(parsed.get("risk_surface", []))

        # Keep contract_map complete even if model places these keys at top-level.
        modifiers = self._normalize_list(
            contract_map.get("modifiers", parsed.get("modifiers", []))
        )
        inheritance_tree = self._normalize_list(
            contract_map.get("inheritance_tree", parsed.get("inheritance_tree", []))
        )
        identified_interfaces = self._normalize_list(
            contract_map.get(
                "identified_interfaces", parsed.get("identified_interfaces", [])
            )
        )
        contracts = self._normalize_list(contract_map.get("contracts", []))

        normalized_contract_map = {
            "contracts": contracts,
            "modifiers": modifiers,
            "inheritance_tree": inheritance_tree,
            "identified_interfaces": identified_interfaces,
        }

        return {
            "contract_map": normalized_contract_map,
            "functions": functions,
            "state_vars": state_vars,
            "external_calls": external_calls,
            "entry_points": entry_points,
            "risk_surface": risk_surface,
        }

    def _normalize_list(self, value: Any) -> list:
        if isinstance(value, list):
            return value
        if value is None:
            return []
        return [value]
