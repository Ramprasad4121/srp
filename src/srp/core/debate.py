"""
DynaDebate — Anti-bias layer for SRP
Forces attacker and defender agents to debate each finding before it reaches the report.
Prevents both false positives (over-reporting) and false negatives (under-reporting).

G1: True per-finding isolation (each finding gets its own context, no cross-contamination)
G2: Verified two-round debate flow (attacker argues → defender challenges → verdict)
G3: Findings only kept if attacker wins round 2 (defender cannot rebut the attack)
G4: Debate result per finding logged in trace
"""
import asyncio
import copy
import json
import re
from srp.core.skill_loader import SkillLoader

sl = SkillLoader()
ATTACKER_SKILL = sl.load_many(["audit-firm-1-solidity-auditor", "quillai-bsa"])
DEFENDER_SKILL = sl.load_many(["tob-fix-review", "tob-spec-compliance"])


async def debate_finding(finding: dict, contract_summary: str, api_key: str, call_llm) -> dict:
    """
    G2: Run a verified 2-round debate on a single finding.
    Round 1: Attacker argues why it's real and critical.
    Round 2: Defender challenges. Attacker gets final rebuttal.
    G3: Keep only if attacker wins the rebuttal round.
    G4: Full debate log stored in finding['debate'].

    Returns enriched finding with:
    - debate_verdict: confirmed|false_positive|needs_more_info
    - debate: full log with both rounds + verdict
    """
    # G1: Deep copy at start — never mutate the input finding
    original = copy.deepcopy(finding)

    title       = finding.get("title", "Unknown")
    severity    = finding.get("severity", "medium")
    description = finding.get("description", "")
    vuln_code   = original.get("vuln_code", "")
    fix_code    = original.get("fix_code", "")

    # ── Round 1: Attacker argues ──────────────────────────────
    attacker_r1_prompt = f"""
You are a red team attacker ONLY focused on THIS specific finding. Do not reference other findings.

G1 ISOLATION: Evaluate ONLY the single finding below.

Finding: {title}
Severity: {severity}
Description: {description}
Vulnerable code:
{vuln_code[:1500]}
Contract context:
{contract_summary[:2000]}

Argue that this vulnerability is REAL, EXPLOITABLE, and HIGH IMPACT.
Provide concrete attack steps. Be aggressive. Do not soften.

Return JSON only:
{{
  "attack_argument": "string — why this is real and exploitable",
  "exploit_steps": ["step1", "step2", "step3"],
  "estimated_impact_usd": "string (e.g. $1M-$10M)",
  "impact_class": "fund_loss|governance|dos|information",
  "confidence": "high|medium|low",
  "preconditions": ["list of what attacker needs"]
}}
"""
    attacker_r1_raw = await call_llm(
        system_extra=ATTACKER_SKILL,
        messages=[{"role": "user", "content": attacker_r1_prompt}],
        api_key=api_key,
        max_tokens=1200,
    )
    attacker_r1 = _safe_parse(attacker_r1_raw)

    # ── Round 2: Defender challenges ─────────────────────────
    defender_prompt = f"""
You are a blue team defender. Critically evaluate this specific attack argument.
G1 ISOLATION: Address ONLY the specific finding below. Do not generalize.

Original finding: {title}
Attacker's argument: {attacker_r1.get("attack_argument", "")}
Exploit steps: {json.dumps(attacker_r1.get("exploit_steps", []))}
Preconditions: {json.dumps(attacker_r1.get("preconditions", []))}
Attacker confidence: {attacker_r1.get("confidence", "unknown")}
Vulnerable code: {vuln_code[:800]}

Look for:
1. False assumptions: Is the precondition actually possible?
2. Mitigating code: Is there a guard we missed?
3. Wrong severity: Is the impact overstated?
4. Protocol-specific defenses: Does the architecture prevent this?

Return JSON only:
{{
  "verdict": "confirmed|false_positive|needs_more_info",
  "defender_argument": "string — your counter or concession",
  "adjusted_severity": "critical|high|medium|low|informational",
  "reasoning": "string — final reasoning for verdict",
  "unresolved_questions": ["list of questions that should be investigated"]
}}
"""
    defender_raw = await call_llm(
        system_extra=DEFENDER_SKILL,
        messages=[{"role": "user", "content": defender_prompt}],
        api_key=api_key,
        max_tokens=1200,
    )
    defender_result = _safe_parse(defender_raw)

    # ── Round 3 (G2/G3): Attacker rebuttal ───────────────────
    # Only run if defender did NOT concede ("confirmed")
    attacker_r2 = {}
    final_verdict = defender_result.get("verdict", "needs_more_info")

    if final_verdict != "confirmed":
        # Defender tried to challenge — attacker gets one rebuttal
        attacker_r2_prompt = f"""
You are a red team attacker. The defender has challenged your finding.
G3: If you cannot rebut the defender's argument, we DROP this finding. Make your case clearly.

Finding: {title}
Your original argument: {attacker_r1.get("attack_argument", "")}
Defender's challenge: {defender_result.get("defender_argument", "")}
Defender verdict: {final_verdict}

If the defender identified a real flaw in your argument, concede.
If the defender is wrong, rebut with specific evidence from the code.

Return JSON only:
{{
  "rebuttal": "string — your specific counter to the defender's argument",
  "final_confidence": "high|medium|low|concede",
  "winning_argument": "string — the single strongest reason this is real"
}}
"""
        attacker_r2_raw = await call_llm(
            system_extra=ATTACKER_SKILL,
            messages=[{"role": "user", "content": attacker_r2_prompt}],
            api_key=api_key,
            max_tokens=800,
        )
        attacker_r2 = _safe_parse(attacker_r2_raw)

        # G3: Final verdict — only keep if attacker final_confidence is NOT "concede"
        rebuttal_confidence = attacker_r2.get("final_confidence", "medium")
        if rebuttal_confidence == "concede":
            final_verdict = "false_positive"
        elif rebuttal_confidence in ("high", "medium"):
            # Attacker wins — override defender's non-confirmed verdict
            final_verdict = "confirmed"
        else:
            # Low confidence rebuttal — keep as needs_more_info
            final_verdict = "needs_more_info"

    # ── Build result (G1: start from original) ────────────────
    result = copy.deepcopy(original)

    # Normalize adjusted_severity to Cyfrin 3-tier: high / medium / low
    SEVERITY_MAP = {
        "critical": "high",
        "informational": "low",
        "info": "low",
        "gas": "low",
        "qa": "low",
    }
    raw_severity = defender_result.get("adjusted_severity", severity)
    adjusted_severity = SEVERITY_MAP.get(str(raw_severity).lower(), str(raw_severity).lower())
    if adjusted_severity not in {"high", "medium", "low"}:
        adjusted_severity = severity  # fall back to original if still invalid

    result["severity"] = adjusted_severity
    result["debate_verdict"] = final_verdict

    # G4: Full debate log in trace
    result["debate"] = {
        "round_1_attacker": attacker_r1,
        "round_2_defender": defender_result,
        "round_3_rebuttal": attacker_r2,
        "verdict": final_verdict,
        "adjusted_severity": adjusted_severity,
        "rounds_completed": 3 if attacker_r2 else 2,
    }

    # G1: Preserve original fields that should not be modified by debate
    result["vuln_code"] = vuln_code
    result["fix_code"] = fix_code

    return result


async def run_debate(findings: list, contract_summary: str, api_key: str, call_llm) -> list:
    """
    G1: Run debate on ALL findings independently and in parallel.
    G3: Drop confirmed false_positives.
    G4: Return findings with full debate log attached.

    Returns: only confirmed or needs_more_info findings.
    """
    # G1: Each finding debated in complete isolation
    tasks = [
        debate_finding(
            copy.deepcopy(f),   # G1: own deep copy, no shared state
            contract_summary,
            api_key,
            call_llm,
        )
        for f in findings
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    debated = []
    false_positives_count = 0
    for r in results:
        if isinstance(r, Exception):
            continue
        verdict = r.get("debate_verdict", "needs_more_info")
        if verdict == "false_positive":
            false_positives_count += 1
        else:
            debated.append(r)

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
                    except Exception:
                        break
        return {}
