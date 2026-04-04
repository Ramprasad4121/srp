import type { MethodologyPhase, ArtifactKind } from "@srp/shared-types";

/**
 * The result produced by a phase agent after execution.
 */
export interface PhaseAgentResult {
  readonly phase: MethodologyPhase;
  readonly success: boolean;
  readonly artifacts: readonly PhaseArtifactOutput[];
  readonly errorMessage?: string;
  readonly durationMs: number;
}

/**
 * Describes an artifact output from a phase agent.
 */
export interface PhaseArtifactOutput {
  readonly kind: ArtifactKind;
  readonly title: string;
  readonly payload: unknown;
}

/**
 * Context injected into a phase agent for execution.
 */
export interface PhaseAgentContext {
  readonly runId: string;
  readonly projectId: string;
  readonly rootDirectory: string;
  readonly previousArtifacts: ReadonlyMap<MethodologyPhase, readonly PhaseArtifactOutput[]>;
}

/**
 * Interface that all phase agents must implement.
 * Each phase in the methodology has a dedicated agent.
 */
export interface PhaseAgent {
  /** Which methodology phase this agent handles. */
  readonly phase: MethodologyPhase;
  /** Human-readable name for this agent. */
  readonly name: string;
  /** Execute the phase and produce artifacts. */
  execute(context: PhaseAgentContext): Promise<PhaseAgentResult>;
}

/**
 * Agent type identifiers matching the master plan's agent list.
 */
export type PhaseAgentType =
  | "PreparationAgent"
  | "ReconAgent"
  | "ArchitectureAgent"
  | "InvariantAgent"
  | "HypothesisAgent"
  | "CodeReadingAgent"
  | "AttackSimulationAgent"
  | "EconomicModelingAgent"
  | "CrossContractPathAgent"
  | "FindingVerificationAgent"
  | "ReportAgent"
  | "TraceAgent";

/**
 * Maps each agent type to its corresponding methodology phase.
 */
export const AGENT_PHASE_MAP: Readonly<Record<PhaseAgentType, MethodologyPhase>> = {
  PreparationAgent: "phase-0-preparation",
  ReconAgent: "phase-1-intent",
  ArchitectureAgent: "phase-2-architecture",
  InvariantAgent: "phase-3-invariants",
  CodeReadingAgent: "phase-4-code-reading",
  AttackSimulationAgent: "phase-5-attack-simulation",
  EconomicModelingAgent: "phase-6-economic-modeling",
  CrossContractPathAgent: "phase-7-cross-contract-paths",
  FindingVerificationAgent: "phase-8-finding-verification",
  ReportAgent: "phase-9-reporting",
  TraceAgent: "phase-10-remediation",
  HypothesisAgent: "phase-5-attack-simulation"
};
