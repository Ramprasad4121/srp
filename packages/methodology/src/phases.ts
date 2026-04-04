import type { MethodologyPhase, ArtifactKind } from "@srp/shared-types";

/**
 * Ordered list of methodology phases as defined in the senior auditor process.
 * This is the canonical execution order for `srp audit`.
 */
export const METHODOLOGY_PHASES: readonly MethodologyPhase[] = [
  "phase-0-preparation",
  "phase-1-recon",
  "phase-2-architecture",
  "phase-3-invariants",
  "phase-4-hypotheses",
  "phase-5-code-reading",
  "phase-6-notes",
  "phase-7-simulations",
  "phase-8-interaction-matrix",
  "phase-9-economic-modeling",
  "phase-10-cross-contract-paths",
  "phase-11-reporting",
  "phase-12-remediation"
] as const;

/**
 * Human-readable label for each methodology phase.
 */
export const PHASE_LABELS: Readonly<Record<MethodologyPhase, string>> = {
  "phase-0-preparation": "Phase 0: Pre-Audit Preparation",
  "phase-1-recon": "Phase 1: Reconnaissance",
  "phase-2-architecture": "Phase 2: Architecture Understanding",
  "phase-3-invariants": "Phase 3: Invariant Extraction",
  "phase-4-hypotheses": "Phase 4: Attack Hypothesis Generation",
  "phase-5-code-reading": "Phase 5: Structured Code Reading",
  "phase-6-notes": "Phase 6: Note-Making & Question Logging",
  "phase-7-simulations": "Phase 7: Attack Simulations",
  "phase-8-interaction-matrix": "Phase 8: Interaction Matrix",
  "phase-9-economic-modeling": "Phase 9: Economic Attack Modeling",
  "phase-10-cross-contract-paths": "Phase 10: Cross-Contract Attack Paths",
  "phase-11-reporting": "Phase 11: Final Reporting",
  "phase-12-remediation": "Phase 12: Remediation Planning"
};

/**
 * Expected artifact kinds produced by each phase.
 */
export const PHASE_ARTIFACT_KINDS: Readonly<Record<MethodologyPhase, readonly ArtifactKind[]>> = {
  "phase-0-preparation": ["note"],
  "phase-1-recon": ["note"],
  "phase-2-architecture": ["diagram", "note"],
  "phase-3-invariants": ["invariant"],
  "phase-4-hypotheses": ["hypothesis"],
  "phase-5-code-reading": ["note"],
  "phase-6-notes": ["note", "question"],
  "phase-7-simulations": ["finding", "note"],
  "phase-8-interaction-matrix": ["diagram", "note"],
  "phase-9-economic-modeling": ["finding", "note"],
  "phase-10-cross-contract-paths": ["diagram", "finding"],
  "phase-11-reporting": ["report"],
  "phase-12-remediation": ["note"]
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
    description: "Define value prop, money flow, actors, and worst case outcomes.",
    expectedArtifactKinds: ["note"],
    dependsOn: []
  },
  {
    phase: "phase-1-recon",
    label: PHASE_LABELS["phase-1-recon"],
    description: "Gather security guarantees, prior audits, and external signals.",
    expectedArtifactKinds: ["note"],
    dependsOn: ["phase-0-preparation"]
  },
  {
    phase: "phase-2-architecture",
    label: PHASE_LABELS["phase-2-architecture"],
    description: "Map trust boundaries, value flows, and state variables.",
    expectedArtifactKinds: ["diagram", "note"],
    dependsOn: ["phase-1-recon"]
  },
  {
    phase: "phase-3-invariants",
    label: PHASE_LABELS["phase-3-invariants"],
    description: "Extract global, function-level, and economic invariants.",
    expectedArtifactKinds: ["invariant"],
    dependsOn: ["phase-2-architecture"]
  },
  {
    phase: "phase-4-hypotheses",
    label: PHASE_LABELS["phase-4-hypotheses"],
    description: "Generate 30-50 specific attack hypotheses (Who can Action by Method).",
    expectedArtifactKinds: ["hypothesis"],
    dependsOn: ["phase-3-invariants"]
  },
  {
    phase: "phase-5-code-reading",
    label: PHASE_LABELS["phase-5-code-reading"],
    description: "Non-linear code reading with function annotations and math deep-dives.",
    expectedArtifactKinds: ["note"],
    dependsOn: ["phase-4-hypotheses"]
  },
  {
    phase: "phase-6-notes",
    label: PHASE_LABELS["phase-6-notes"],
    description: "Maintain question logs and rigorous evidence mapping.",
    expectedArtifactKinds: ["note", "question"],
    dependsOn: ["phase-5-code-reading"]
  },
  {
    phase: "phase-7-simulations",
    label: PHASE_LABELS["phase-7-simulations"],
    description: "Run 'What-If' simulations for input, time, order, and admin control.",
    expectedArtifactKinds: ["finding", "note"],
    dependsOn: ["phase-6-notes"]
  },
  {
    phase: "phase-8-interaction-matrix",
    label: PHASE_LABELS["phase-8-interaction-matrix"],
    description: "Compute contract-to-contract read/write matrix and unexpected write paths.",
    expectedArtifactKinds: ["diagram", "note"],
    dependsOn: ["phase-7-simulations"]
  },
  {
    phase: "phase-9-economic-modeling",
    label: PHASE_LABELS["phase-9-economic-modeling"],
    description: "Model flash loans, oracle manipulation, and slow accounting drift.",
    expectedArtifactKinds: ["finding", "note"],
    dependsOn: ["phase-8-interaction-matrix"]
  },
  {
    phase: "phase-10-cross-contract-paths",
    label: PHASE_LABELS["phase-10-cross-contract-paths"],
    description: "Analyze callbacks, reentrancy surfaces, and call chain exploit narratives.",
    expectedArtifactKinds: ["diagram", "finding"],
    dependsOn: ["phase-9-economic-modeling"]
  },
  {
    phase: "phase-11-reporting",
    label: PHASE_LABELS["phase-11-reporting"],
    description: "Compile formal audit report linked to methodology evidence.",
    expectedArtifactKinds: ["report"],
    dependsOn: ["phase-10-cross-contract-paths"]
  },
  {
    phase: "phase-12-remediation",
    label: PHASE_LABELS["phase-12-remediation"],
    description: "Create prioritized remediation roadmap and fix verification.",
    expectedArtifactKinds: ["note"],
    dependsOn: ["phase-11-reporting"]
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
