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
  "synthesis-functions",
  "synthesis-entry-exit",
  "synthesis-invariants",
  "visual-flow-map",
  "audit-resolve-input",
  "audit-setup",
  "audit-map",
  "audit-hunt",
  "audit-attack",
  "audit-verify",
  "audit-report"
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
  "synthesis-functions": "Synthesis: Main Contracts & Functions",
  "synthesis-entry-exit": "Synthesis: Entry & Exit points",
  "synthesis-invariants": "Synthesis: Protocol Invariants",
  "visual-flow-map": "Visual: Protocol Flow Map",
  "audit-resolve-input": "Audit: Resolve Input",
  "audit-setup": "Audit: Setup & Static Analysis",
  "audit-map": "Audit: System Mapping",
  "audit-hunt": "Audit: Vulnerability Hunting",
  "audit-attack": "Audit: Exploit Proofing (Attack)",
  "audit-verify": "Audit: Skeptic-Judge Verification",
  "audit-report": "Audit: Final Structured Report"
};

export interface PhaseDefinition {
  readonly phase: MethodologyPhase;
  readonly label: string;
  readonly description: string;
  readonly requiredInputs: readonly string[];
  readonly expectedArtifactKinds: readonly ArtifactKind[];
  readonly exitCriteria: readonly string[];
  readonly rescueStrategy: string;
  readonly dependsOn: readonly MethodologyPhase[];
}

export const PHASE_DEFINITIONS: readonly PhaseDefinition[] = [
  {
    phase: "discovery-docs",
    label: PHASE_LABELS["discovery-docs"],
    description: "Fetch and analyze whitepapers, Gitbooks, and design docs.",
    requiredInputs: ["workspace root", "repo file inventory"],
    expectedArtifactKinds: ["note"],
    exitCriteria: ["core protocol docs identified", "initial documentation notes persisted"],
    rescueStrategy: "Fallback to local repo analysis when provider or web research fails.",
    dependsOn: []
  },
  {
    phase: "discovery-audits",
    label: PHASE_LABELS["discovery-audits"],
    description: "Scrape and digest prior audit reports (Sherlock, C4, etc).",
    requiredInputs: ["documentation context", "protocol naming and repo links"],
    expectedArtifactKinds: ["note"],
    exitCriteria: ["prior audit sources mapped", "prior audit notes persisted"],
    rescueStrategy: "Continue with local-only audit baseline when external audit sources unavailable.",
    dependsOn: ["discovery-docs"]
  },
  {
    phase: "discovery-governance",
    label: PHASE_LABELS["discovery-governance"],
    description: "Analyze governance forums and Discord discussions.",
    requiredInputs: ["audit source map", "protocol docs"],
    expectedArtifactKinds: ["note"],
    exitCriteria: ["governance actors identified", "governance notes persisted"],
    rescueStrategy: "Use contract roles and docs as trust-boundary fallback when forum data missing.",
    dependsOn: ["discovery-audits"]
  },
  {
    phase: "discovery-tokenomics",
    label: PHASE_LABELS["discovery-tokenomics"],
    description: "Extract economic power and indirect actor models.",
    requiredInputs: ["governance findings", "token and vault contracts"],
    expectedArtifactKinds: ["note"],
    exitCriteria: ["economic risks summarized", "tokenomics notes persisted"],
    rescueStrategy: "Infer incentive model from code paths when docs omit tokenomics.",
    dependsOn: ["discovery-governance"]
  },
  {
    phase: "discovery-onchain",
    label: PHASE_LABELS["discovery-onchain"],
    description: "Scrape Etherscan for constructor args and initial roles.",
    requiredInputs: ["workspace contracts", "deployment references"],
    expectedArtifactKinds: ["note"],
    exitCriteria: ["deployment assumptions captured", "on-chain notes persisted"],
    rescueStrategy: "Mark deployment state unresolved and continue from local sources.",
    dependsOn: ["discovery-tokenomics"]
  },
  {
    phase: "synthesis-intent",
    label: PHASE_LABELS["synthesis-intent"],
    description: "Synthesize 'Ground Truth' intent from all discovery sources.",
    requiredInputs: ["all discovery notes", "workspace analysis", "codebase context"],
    expectedArtifactKinds: ["note"],
    exitCriteria: ["intent summary generated", "protocol intent note persisted"],
    rescueStrategy: "Synthesize from codebase-only evidence when discovery incomplete.",
    dependsOn: ["discovery-onchain"]
  },
  {
    phase: "synthesis-actors",
    label: PHASE_LABELS["synthesis-actors"],
    description: "Map intended actors vs implementation roles.",
    requiredInputs: ["intent summary", "contract roles", "discovery notes"],
    expectedArtifactKinds: ["note"],
    exitCriteria: ["actor model generated", "actor model note persisted"],
    rescueStrategy: "Reduce to trust-boundary list when full role mapping fails.",
    dependsOn: ["synthesis-intent"]
  },
  {
    phase: "synthesis-functions",
    label: PHASE_LABELS["synthesis-functions"],
    description: "Map all contracts and their main state-modifying functions.",
    requiredInputs: ["intent summary", "actor model", "codebase context"],
    expectedArtifactKinds: ["note"],
    exitCriteria: ["function map generated", "function map note persisted"],
    rescueStrategy: "Persist partial function inventory and continue with known state mutators.",
    dependsOn: ["synthesis-actors"]
  },
  {
    phase: "synthesis-entry-exit",
    label: PHASE_LABELS["synthesis-entry-exit"],
    description: "Identify all external entry points and sensitive value exit paths.",
    requiredInputs: ["function map", "architecture summary"],
    expectedArtifactKinds: ["note"],
    exitCriteria: ["entry/exit matrix generated", "value flow note persisted"],
    rescueStrategy: "Flag unresolved exits and continue with partial drainage map.",
    dependsOn: ["synthesis-functions"]
  },
  {
    phase: "synthesis-invariants",
    label: PHASE_LABELS["synthesis-invariants"],
    description: "Extract list of Global, Function, and Economic invariants.",
    requiredInputs: ["entry/exit matrix", "actor model", "intent summary"],
    expectedArtifactKinds: ["invariant"],
    exitCriteria: ["invariant registry generated", "invariant artifact persisted"],
    rescueStrategy: "Fallback to minimal invariant set anchored to custody and accounting.",
    dependsOn: ["synthesis-entry-exit"]
  },
  {
    phase: "visual-flow-map",
    label: PHASE_LABELS["visual-flow-map"],
    description: "Generate interactive Excalidraw value flow diagrams.",
    requiredInputs: ["invariant registry", "function map", "entry/exit matrix"],
    expectedArtifactKinds: ["diagram"],
    exitCriteria: ["diagram generated", "diagram artifact persisted"],
    rescueStrategy: "Persist textual flow notes when diagram generation fails.",
    dependsOn: ["synthesis-invariants"]
  },
  {
    phase: "audit-resolve-input",
    label: PHASE_LABELS["audit-resolve-input"],
    description: "Resolve audit scope from GitHub URLs or local paths.",
    requiredInputs: ["workspace root", "scope selection"],
    expectedArtifactKinds: ["note"],
    exitCriteria: ["audit scope resolved", "scope note persisted"],
    rescueStrategy: "Default to workspace-local audit scope when remote scope unresolved.",
    dependsOn: []
  },
  {
    phase: "audit-setup",
    label: PHASE_LABELS["audit-setup"],
    description: "Run initial static analysis (Slither, Aderyn) and setup environment.",
    requiredInputs: ["audit scope", "toolchain availability"],
    expectedArtifactKinds: ["note"],
    exitCriteria: ["setup note persisted", "static analysis baseline captured"],
    rescueStrategy: "Continue with manual setup note when toolchain execution unavailable.",
    dependsOn: ["audit-resolve-input"]
  },
  {
    phase: "audit-map",
    label: PHASE_LABELS["audit-map"],
    description: "Deep dive into architecture, trust boundaries, and invariants.",
    requiredInputs: ["setup baseline", "diagram", "invariant registry"],
    expectedArtifactKinds: ["note"],
    exitCriteria: ["audit map note persisted", "trust boundaries clarified"],
    rescueStrategy: "Use synthesis artifacts as fallback map when deep-dive lane fails.",
    dependsOn: ["audit-setup"]
  },
  {
    phase: "audit-hunt",
    label: PHASE_LABELS["audit-hunt"],
    description: "Parallel hunt lanes for common and advanced vulnerability patterns.",
    requiredInputs: ["audit map", "invariants", "function map"],
    expectedArtifactKinds: ["hypothesis"],
    exitCriteria: ["hypothesis registry generated", "hunt artifacts persisted"],
    rescueStrategy: "Persist narrowed hypothesis set when full hunt fanout unavailable.",
    dependsOn: ["audit-map"]
  },
  {
    phase: "audit-attack",
    label: PHASE_LABELS["audit-attack"],
    description: "Develop Proof-of-Concepts and exploit sketches for candidate issues.",
    requiredInputs: ["hypothesis registry", "toolchain setup"],
    expectedArtifactKinds: ["test"],
    exitCriteria: ["verification attempts recorded", "evidence artifacts persisted"],
    rescueStrategy: "Store non-runnable exploit reasoning when PoC execution blocked.",
    dependsOn: ["audit-hunt"]
  },
  {
    phase: "audit-verify",
    label: PHASE_LABELS["audit-verify"],
    description: "Formal verification and skeptic review of exploit claims.",
    requiredInputs: ["PoC/evidence ledger", "hypothesis registry", "invariants"],
    expectedArtifactKinds: ["finding"],
    exitCriteria: ["finding registry generated", "confirmed/false-positive split recorded"],
    rescueStrategy: "Downgrade unresolved claims to candidate state and continue.",
    dependsOn: ["audit-attack"]
  },
  {
    phase: "audit-report",
    label: PHASE_LABELS["audit-report"],
    description: "Generate final high-fidelity audit report.",
    requiredInputs: ["finding registry", "remediation plan", "evidence ledger"],
    expectedArtifactKinds: ["report"],
    exitCriteria: ["formal report generated", "report artifact persisted"],
    rescueStrategy: "Produce partial report draft with unresolved sections flagged.",
    dependsOn: ["audit-verify"]
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

export function getPhaseIndex(phase: MethodologyPhase): number {
  return METHODOLOGY_PHASES.indexOf(phase);
}

export function getNextPhase(currentPhase: MethodologyPhase): MethodologyPhase | null {
  const index = getPhaseIndex(currentPhase);
  if (index >= 0 && index < METHODOLOGY_PHASES.length - 1) {
    return METHODOLOGY_PHASES[index + 1] ?? null;
  }
  return null;
}

export function phaseAllowsArtifactKind(
  phase: MethodologyPhase,
  kind: ArtifactKind
): boolean {
  return getPhaseDefinition(phase).expectedArtifactKinds.includes(kind);
}

export function phaseMeetsArtifactGate(
  phase: MethodologyPhase,
  emittedKinds: readonly ArtifactKind[]
): boolean {
  const expectedKinds = getPhaseDefinition(phase).expectedArtifactKinds;
  return emittedKinds.some((kind) => expectedKinds.includes(kind));
}
