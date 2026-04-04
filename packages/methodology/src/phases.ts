import type { MethodologyPhase, PhaseStatus, ArtifactKind } from "@srp/shared-types";

/**
 * Ordered list of methodology phases as defined in the senior auditor process.
 * This is the canonical execution order for `srp audit`.
 */
export const METHODOLOGY_PHASES: readonly MethodologyPhase[] = [
  "phase-0-preparation",
  "phase-1-intent",
  "phase-2-architecture",
  "phase-3-invariants",
  "phase-4-code-reading",
  "phase-5-attack-simulation",
  "phase-6-economic-modeling",
  "phase-7-cross-contract-paths",
  "phase-8-finding-verification",
  "phase-9-reporting",
  "phase-10-remediation"
] as const;

/**
 * Human-readable label for each methodology phase.
 */
export const PHASE_LABELS: Readonly<Record<MethodologyPhase, string>> = {
  "phase-0-preparation": "Preparation & Scope Mapping",
  "phase-1-intent": "Protocol Intent Analysis",
  "phase-2-architecture": "Architecture & Trust Boundary Mapping",
  "phase-3-invariants": "Invariant Extraction",
  "phase-4-code-reading": "Deep Code Reading & Verification Planning",
  "phase-5-attack-simulation": "Attack Hypothesis Formulation",
  "phase-6-economic-modeling": "Economic & Systemic Risk Modeling",
  "phase-7-cross-contract-paths": "Cross-Contract Path Analysis",
  "phase-8-finding-verification": "Finding Verification & PoC",
  "phase-9-reporting": "Formal Report Generation",
  "phase-10-remediation": "Remediation Planning"
};

/**
 * Expected artifact kinds produced by each phase.
 */
export const PHASE_ARTIFACT_KINDS: Readonly<Record<MethodologyPhase, readonly ArtifactKind[]>> = {
  "phase-0-preparation": ["note"],
  "phase-1-intent": ["note"],
  "phase-2-architecture": ["diagram", "note"],
  "phase-3-invariants": ["invariant"],
  "phase-4-code-reading": ["test", "note"],
  "phase-5-attack-simulation": ["hypothesis"],
  "phase-6-economic-modeling": ["finding", "note"],
  "phase-7-cross-contract-paths": ["diagram"],
  "phase-8-finding-verification": ["finding", "test"],
  "phase-9-reporting": ["report"],
  "phase-10-remediation": ["note"]
};

/**
 * Describes a phase's execution contract.
 */
export interface PhaseDefinition {
  readonly phase: MethodologyPhase;
  readonly label: string;
  readonly description: string;
  readonly expectedArtifactKinds: readonly ArtifactKind[];
  readonly dependsOn: readonly MethodologyPhase[];
}

/**
 * Full phase definitions with dependency relationships.
 */
export const PHASE_DEFINITIONS: readonly PhaseDefinition[] = [
  {
    phase: "phase-0-preparation",
    label: PHASE_LABELS["phase-0-preparation"],
    description: "Analyze workspace structure, discover Solidity files, and map the project scope.",
    expectedArtifactKinds: ["note"],
    dependsOn: []
  },
  {
    phase: "phase-1-intent",
    label: PHASE_LABELS["phase-1-intent"],
    description: "Build codebase context and extract protocol intent from source files and documentation.",
    expectedArtifactKinds: ["note"],
    dependsOn: ["phase-0-preparation"]
  },
  {
    phase: "phase-2-architecture",
    label: PHASE_LABELS["phase-2-architecture"],
    description: "Generate architecture summary, trust boundary map, value flow map, and protocol diagram.",
    expectedArtifactKinds: ["diagram", "note"],
    dependsOn: ["phase-1-intent"]
  },
  {
    phase: "phase-3-invariants",
    label: PHASE_LABELS["phase-3-invariants"],
    description: "Extract security invariants from architecture and intent analysis.",
    expectedArtifactKinds: ["invariant"],
    dependsOn: ["phase-2-architecture"]
  },
  {
    phase: "phase-4-code-reading",
    label: PHASE_LABELS["phase-4-code-reading"],
    description: "Deep code reading, function annotation, verification planning, and toolchain execution.",
    expectedArtifactKinds: ["test", "note"],
    dependsOn: ["phase-3-invariants"]
  },
  {
    phase: "phase-5-attack-simulation",
    label: PHASE_LABELS["phase-5-attack-simulation"],
    description: "Formulate attack hypotheses based on invariants and verification results.",
    expectedArtifactKinds: ["hypothesis"],
    dependsOn: ["phase-4-code-reading"]
  },
  {
    phase: "phase-6-economic-modeling",
    label: PHASE_LABELS["phase-6-economic-modeling"],
    description: "Model economic and systemic risks across the protocol.",
    expectedArtifactKinds: ["finding", "note"],
    dependsOn: ["phase-5-attack-simulation"]
  },
  {
    phase: "phase-7-cross-contract-paths",
    label: PHASE_LABELS["phase-7-cross-contract-paths"],
    description: "Map cross-contract call paths and state-change flows.",
    expectedArtifactKinds: ["diagram"],
    dependsOn: ["phase-6-economic-modeling"]
  },
  {
    phase: "phase-8-finding-verification",
    label: PHASE_LABELS["phase-8-finding-verification"],
    description: "Verify findings with evidence, run PoC tests, and triage severity.",
    expectedArtifactKinds: ["finding", "test"],
    dependsOn: ["phase-7-cross-contract-paths"]
  },
  {
    phase: "phase-9-reporting",
    label: PHASE_LABELS["phase-9-reporting"],
    description: "Generate the formal security audit report from all accumulated artifacts.",
    expectedArtifactKinds: ["report"],
    dependsOn: ["phase-8-finding-verification"]
  },
  {
    phase: "phase-10-remediation",
    label: PHASE_LABELS["phase-10-remediation"],
    description: "Create remediation roadmap with prioritized fix actions.",
    expectedArtifactKinds: ["note"],
    dependsOn: ["phase-8-finding-verification"]
  }
];

export function getPhaseDefinition(phase: MethodologyPhase): PhaseDefinition {
  const definition = PHASE_DEFINITIONS.find((d) => d.phase === phase);
  if (!definition) {
    throw new Error(`Unknown methodology phase: ${phase}`);
  }
  return definition;
}

export function getPhaseIndex(phase: MethodologyPhase): number {
  return METHODOLOGY_PHASES.indexOf(phase);
}

export function getNextPhase(currentPhase: MethodologyPhase): MethodologyPhase | null {
  const index = getPhaseIndex(currentPhase);
  if (index === -1 || index >= METHODOLOGY_PHASES.length - 1) {
    return null;
  }
  return METHODOLOGY_PHASES[index + 1] ?? null;
}

export function areDependenciesMet(
  phase: MethodologyPhase,
  completedPhases: ReadonlySet<MethodologyPhase>
): boolean {
  const definition = getPhaseDefinition(phase);
  return definition.dependsOn.every((dep) => completedPhases.has(dep));
}
