import type { MethodologyPhase, ArtifactKind } from "@srp/shared-types";

/**
 * Redefined Discovery-First methodology phases.
 */
export const METHODOLOGY_PHASES: readonly MethodologyPhase[] = [
  "discovery-docs",
  "discovery-audits",
  "discovery-governance",
  "discovery-tokenomics",
  "discovery-onchain",
  "synthesis-intent",
  "synthesis-actors",
  "visual-flow-map"
] as const;

/**
 * Human-readable labels.
 */
export const PHASE_LABELS: Readonly<Record<MethodologyPhase, string>> = {
  "discovery-docs": "Discovery: Documentation & Whitepapers",
  "discovery-audits": "Discovery: Prior Audit Reports",
  "discovery-governance": "Discovery: Governance & Forums",
  "discovery-tokenomics": "Discovery: Tokenomics & Economics",
  "discovery-onchain": "Discovery: On-Chain Deployments",
  "synthesis-intent": "Synthesis: Protocol Intent",
  "synthesis-actors": "Synthesis: Actor Model",
  "visual-flow-map": "Visual: Protocol Flow Map"
};

export interface PhaseDefinition {
  readonly phase: MethodologyPhase;
  readonly label: string;
  readonly description: string;
  readonly expectedArtifactKinds: readonly ArtifactKind[];
  readonly dependsOn: readonly MethodologyPhase[];
}

export const PHASE_DEFINITIONS: readonly PhaseDefinition[] = [
  {
    phase: "discovery-docs",
    label: PHASE_LABELS["discovery-docs"],
    description: "Fetch and analyze whitepapers, Gitbooks, and design docs.",
    expectedArtifactKinds: ["note"],
    dependsOn: []
  },
  {
    phase: "discovery-audits",
    label: PHASE_LABELS["discovery-audits"],
    description: "Scrape and digest prior audit reports (Sherlock, C4, etc).",
    expectedArtifactKinds: ["note"],
    dependsOn: ["discovery-docs"]
  },
  {
    phase: "discovery-governance",
    label: PHASE_LABELS["discovery-governance"],
    description: "Analyze governance forums and Discord discussions.",
    expectedArtifactKinds: ["note"],
    dependsOn: ["discovery-audits"]
  },
  {
    phase: "discovery-tokenomics",
    label: PHASE_LABELS["discovery-tokenomics"],
    description: "Extract economic power and indirect actor models.",
    expectedArtifactKinds: ["note"],
    dependsOn: ["discovery-governance"]
  },
  {
    phase: "discovery-onchain",
    label: PHASE_LABELS["discovery-onchain"],
    description: "Scrape Etherscan for constructor args and initial roles.",
    expectedArtifactKinds: ["note"],
    dependsOn: ["discovery-tokenomics"]
  },
  {
    phase: "synthesis-intent",
    label: PHASE_LABELS["synthesis-intent"],
    description: "Synthesize 'Ground Truth' intent from all discovery sources.",
    expectedArtifactKinds: ["note"],
    dependsOn: ["discovery-onchain"]
  },
  {
    phase: "synthesis-actors",
    label: PHASE_LABELS["synthesis-actors"],
    description: "Map intended actors vs implementation roles.",
    expectedArtifactKinds: ["note"],
    dependsOn: ["synthesis-intent"]
  },
  {
    phase: "visual-flow-map",
    label: PHASE_LABELS["visual-flow-map"],
    description: "Generate interactive Excalidraw value flow diagrams.",
    expectedArtifactKinds: ["diagram"],
    dependsOn: ["synthesis-actors"]
  }
];

export function getPhaseDefinition(phase: MethodologyPhase): PhaseDefinition {
  const definition = PHASE_DEFINITIONS.find((d) => d.phase === phase);
  if (!definition) {
    throw new Error(`Unknown methodology phase: ${phase}`);
  }
  return definition;
}

export function areDependenciesMet(
  phase: MethodologyPhase,
  completedPhases: ReadonlySet<MethodologyPhase>
): boolean {
  const definition = getPhaseDefinition(phase);
  return definition.dependsOn.every((dep) => completedPhases.has(dep));
}
