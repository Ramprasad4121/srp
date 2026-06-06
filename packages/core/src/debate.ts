import type { DebateTranscript, Finding } from "./types.ts";
import { clampConfidence } from "./utils.ts";

export function runDynaDebate(findings: Finding[]): { findings: Finding[]; debates: DebateTranscript[] } {
  const debates = findings.map((finding) => debateFinding(finding));
  const updated = findings.map((finding) => {
    const debate = debates.find((item) => item.findingId === finding.id);
    const confidence = clampConfidence(debate?.finalConfidence ?? finding.confidence);
    return {
      ...finding,
      confidence,
      confidenceBand: confidence >= 0.9 ? "verified" as const : confidence >= 0.72 ? "high" as const : confidence >= 0.45 ? "medium" as const : "low" as const,
      status: "debated" as const
    };
  });
  return { findings: updated, debates };
}

function debateFinding(finding: Finding): DebateTranscript {
  const rounds = [];
  let score = finding.confidence;
  const hasSpecificEvidence = finding.evidence.some((evidence) => evidence.excerpt.length > 12);
  const hasConcreteAttack = finding.attackPath.length >= 4;
  const highImpact = finding.severity === "critical" || finding.severity === "high";

  const roundInputs = [
    {
      attacker: "Attacker demonstrates reachability from public or privileged entrypoint.",
      defender: hasSpecificEvidence ? "Defender accepts cited code evidence and asks for state validation." : "Defender rejects because cited evidence is too thin.",
      delta: hasSpecificEvidence ? 0.08 : -0.18
    },
    {
      attacker: "Attacker describes state transition that violates a security guarantee.",
      defender: hasConcreteAttack ? "Defender cannot disprove the attack path without execution." : "Defender notes missing state transition details.",
      delta: hasConcreteAttack ? 0.06 : -0.1
    },
    {
      attacker: "Attacker requests PoC validation for severity promotion.",
      defender: highImpact ? "Defender requires executable proof before high severity is finalized." : "Defender accepts debate-level confidence for non-high severity.",
      delta: highImpact ? -0.03 : 0.03
    }
  ];

  for (const input of roundInputs) {
    score = clampConfidence(score + input.delta);
    rounds.push({
      attacker: input.attacker,
      defender: input.defender,
      judge: score >= 0.72 ? "Claim remains credible and should proceed to validation." : "Claim remains unproven and should be downgraded unless more evidence appears.",
      confidenceDelta: input.delta
    });
  }

  return {
    findingId: finding.id,
    rounds,
    finalConfidence: score,
    decision: score >= 0.72 ? "threshold_reached" : "exploit_disproven"
  };
}
