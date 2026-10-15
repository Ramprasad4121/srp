import type { DebateTranscript, Finding } from "./types.ts";
import { clampConfidence, confidenceBand } from "./utils.ts";

/**
 * DynaDebate: deterministic attacker / defender / judge rounds over the facts each detector established.
 * Every argument cites a fact or an evidence line; nothing here is model-generated. Each round moves
 * confidence by a fixed amount, and the judge decides when the claim is credible enough to validate.
 */
export function runDynaDebate(findings: Finding[]): { findings: Finding[]; debates: DebateTranscript[] } {
  const debates = findings.map((finding) => debateFinding(finding));
  const updated = findings.map((finding) => {
    const debate = debates.find((item) => item.findingId === finding.id);
    const confidence = clampConfidence(debate?.finalConfidence ?? finding.confidence);
    return { ...finding, confidence, confidenceBand: confidenceBand(confidence), status: "debated" as const };
  });
  return { findings: updated, debates };
}

function debateFinding(finding: Finding): DebateTranscript {
  const facts = finding.context?.facts ?? [];
  const evidence = finding.evidence;
  const cite = (index: number) => evidence[index] ? `${evidence[index]?.file}:L${evidence[index]?.startLine} \`${evidence[index]?.excerpt}\`` : "no cited line";
  const visibility = finding.context?.visibility;
  const reachable = visibility ? visibility === "public" || visibility === "external" : undefined;
  const mitigations = finding.mitigations ?? [];
  const highImpact = finding.severity === "critical" || finding.severity === "high";

  const rounds: Array<{ attacker: string; defender: string; delta: number }> = [];
  rounds.push({
    attacker: `Reachability: ${facts[0] ?? `the pattern at ${cite(0)} sits in code an attacker can trigger`}.`,
    defender: reachable === false
      ? `${finding.context?.function} is ${visibility}; the attacker needs a public caller that reaches it.`
      : reachable === true
        ? `Accepted: ${finding.context?.function} is ${visibility}.`
        : "Reachability is not established structurally; the pattern match alone does not show an entrypoint.",
    delta: reachable === true ? 0.06 : reachable === false ? -0.15 : -0.05
  });
  rounds.push({
    attacker: evidence.length >= 2
      ? `State effect: ${cite(1)} follows ${cite(0)}, which is the unsafe ordering.`
      : `State effect: ${facts[1] ?? finding.impact}`,
    defender: evidence.length >= 2
      ? "Cannot dispute the ordering from source; both lines are cited."
      : "Only one line is cited. The state change the attack needs is not shown.",
    delta: evidence.length >= 2 ? 0.06 : -0.08
  });
  if (mitigations.length) {
    rounds.push({
      attacker: "The guard may not cover every path (cross-function or read-only reentrancy, other entrypoints).",
      defender: `Mitigation present: ${mitigations.join("; ")}.`,
      delta: -0.15
    });
  }
  rounds.push({
    attacker: "Requests severity as proposed.",
    defender: highImpact ? "High severity needs an executed PoC; until then it stays capped." : "Severity is not high; debate-level confidence is enough.",
    delta: highImpact ? -0.03 : 0.02
  });

  let score = finding.confidence;
  const transcript = rounds.map((round) => {
    score = clampConfidence(score + round.delta);
    return {
      attacker: round.attacker,
      defender: round.defender,
      judge: score >= 0.72 ? "Credible. Proceed to validation." : score >= 0.45 ? "Plausible but unproven. Needs a harness run." : "Weak. Downgrade unless new evidence appears.",
      confidenceDelta: round.delta
    };
  });
  return {
    findingId: finding.id,
    rounds: transcript,
    finalConfidence: score,
    decision: score >= 0.72 ? "threshold_reached" : "inconclusive"
  };
}
