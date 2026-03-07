"""
DynaDebate — Anti-bias layer for SRP
Forces attacker and defender agents to debate each finding before it reaches the report.
Prevents both false positives (over-reporting) and false negatives (under-reporting).
"""
import json
import re
from core.skill_loader import SkillLoader

sl = SkillLoader()
ATTACKER_SKILL = sl.load_many(["audit-firm-1-solidity-auditor", "quillai-bsa"])
DEFENDER_SKILL = sl.load_many(["tob-fix-review", "tob-spec-compliance"])


async def debate_finding(finding: dict, contract_summary: str, api_key: str, call_llm) -> dict:
    """
    Run a 2-round debate on a single finding.
    Round 1: Attacker argues why it's real and critical
    Round 2: Defender challenges or concedes
    Returns enriched finding with debate_verdict and adjusted severity.
    """

    # Deep copy originals at the very start
    import copy
    original = copy.deepcopy(finding)

    title = finding.get("title", "Unknown")
    severity = finding.get("severity", "medium")
    description = finding.get("description", "")
    vuln_code = original.get("vuln_code", "")
    fix_code = original.get("fix_code", "")

    # --- Round 1: Attacker argues ---
    attacker_prompt = f"""
You are a red team attacker. Argue that this vulnerability is REAL and EXPLOITABLE.
Provide concrete attack steps. Be aggressive. Do not soften.

Finding: {title}
Severity: {severity}
Description: {description}
Vulnerable code: {vuln_code}
Contract context: {contract_summary}

Return JSON only:
{{
  "attack_argument": "string — why this is real and exploitable",
  "exploit_steps": ["step1", "step2", "step3"],
  "estimated_impact": "string",
  "confidence": "high|medium|low"
}}
"""
    # BaseAgent.call_llm(system_extra, messages, api_key=...)
    attacker_raw = await call_llm(
        system_extra=ATTACKER_SKILL,
        messages=[{"role": "user", "content": attacker_prompt}],
        api_key=api_key,
        max_tokens=1024
    )
    attacker_result = _safe_parse(attacker_raw)

    # --- Round 2: Defender challenges ---
    defender_prompt = f"""
You are a blue team defender. Critically evaluate this attack argument.
Look for: false positives, mitigating factors, incorrect assumptions, missing context.
Be honest — if the attack is valid, concede it.

Original finding: {title}
Attacker's argument: {attacker_result.get('attack_argument', '')}
Exploit steps: {json.dumps(attacker_result.get('exploit_steps', []))}
Attacker confidence: {attacker_result.get('confidence', 'unknown')}

Return JSON only:
{{
  "verdict": "confirmed|false_positive|needs_more_info",
  "defender_argument": "string — your counter or concession",
  "adjusted_severity": "critical|high|medium|low|informational",
  "reasoning": "string — final reasoning for verdict"
}}
"""
    defender_raw = await call_llm(
        system_extra=DEFENDER_SKILL,
        messages=[{"role": "user", "content": defender_prompt}],
        api_key=api_key,
        max_tokens=1024
    )
    defender_result = _safe_parse(defender_raw)

    # Build result from original — only update debate fields
    result = copy.deepcopy(original)  # start from original, not mutated finding
    result["severity"] = defender_result.get("adjusted_severity", severity)
    result["debate_verdict"] = defender_result.get("verdict", "needs_more_info")
    result["debate"] = {
        "attacker": attacker_result,
        "defender": defender_result,
        "verdict": result["debate_verdict"],
        "adjusted_severity": result["severity"]
    }
    # These are guaranteed correct from original
    result["vuln_code"] = vuln_code
    result["fix_code"] = fix_code

    return result


async def run_debate(findings: list, contract_summary: str, api_key: str, call_llm) -> list:
    """
    Run debate on all findings. Drop confirmed false positives.
    Returns only confirmed or needs_more_info findings.
    """
    debated = []
    for finding in findings:
        result = await debate_finding(finding, contract_summary, api_key, call_llm)
        if result["debate_verdict"] != "false_positive":
            debated.append(result)
    return debated


def _safe_parse(raw: str) -> dict:
    try:
        cleaned = re.sub(r'```(?:json)?\s*', '', raw).strip()
        cleaned = re.sub(r'```$', '', cleaned).strip()
        return json.loads(cleaned)
    except Exception:
        start = cleaned.find('{') if 'cleaned' in dir() else raw.find('{')
        text = cleaned if 'cleaned' in dir() else raw
        if start != -1:
            depth = 0
            for i, ch in enumerate(text[start:], start):
                if ch == '{': depth += 1
                elif ch == '}': depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[start:i+1])
                    except:
                        break
        return {}
