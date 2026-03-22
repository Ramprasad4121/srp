from __future__ import annotations

import re
from typing import Any


def _normalize_callable_name(raw_value: str) -> str:
    value = str(raw_value).strip().strip("`")
    if not value:
        value = "unknown"
    if "(" not in value:
        value = f"{value}()"
    return f"`{value}`"


def _extract_function_name(finding: dict[str, Any]) -> str:
    for key in ("affected_function", "function", "function_name", "location", "target", "entrypoint"):
        value = str(finding.get(key, "")).strip()
        if not value:
            continue
        if ":" in value:
            value = value.split(":")[-1].strip()
        return _normalize_callable_name(value)

    contract = str(finding.get("contract", "")).strip()
    if contract:
        return _normalize_callable_name(f"{contract}.unknown")
    return _normalize_callable_name("unknown")


def ensure_finding_title(
    finding: dict[str, Any],
    finding_type: str,
    default_impact: str,
) -> str:
    existing_title = str(finding.get("title", "")).strip()
    if existing_title and existing_title.lower() != "untitled":
        return existing_title

    impact = str(finding.get("impact", "")).strip()
    if not impact:
        impact = default_impact
    impact = re.sub(r"\s+", " ", impact).strip().rstrip(".")
    if impact.lower().startswith("allows "):
        impact = impact[7:].strip()

    function_name = _extract_function_name(finding)
    return f"[{finding_type}] in {function_name} allows {impact}"


def apply_finding_titles(
    findings: Any,
    finding_type: str,
    default_impact: str,
) -> list[dict[str, Any]]:
    if not isinstance(findings, list):
        return []

    titled: list[dict[str, Any]] = []
    for finding in findings:
        if not isinstance(finding, dict):
            continue
        item = dict(finding)
        item["title"] = ensure_finding_title(item, finding_type, default_impact)
        titled.append(item)
    return titled
