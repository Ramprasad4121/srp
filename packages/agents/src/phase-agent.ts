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
 * Agent type identifiers for the Discovery-First methodology.
 */
export type PhaseAgentType =
  | "DiscoveryAgent"
  | "SynthesisAgent"
  | "VisualAgent";

/**
 * Maps each agent type to its corresponding methodology phase.
 */
export const AGENT_PHASE_MAP: Readonly<Record<string, MethodologyPhase>> = {
  "DiscoveryAgent:docs": "discovery-docs",
  "DiscoveryAgent:audits": "discovery-audits",
  "DiscoveryAgent:governance": "discovery-governance",
  "DiscoveryAgent:tokenomics": "discovery-tokenomics",
  "DiscoveryAgent:onchain": "discovery-onchain",
  "SynthesisAgent:intent": "synthesis-intent",
  "SynthesisAgent:actors": "synthesis-actors",
  "VisualAgent:flow": "visual-flow-map"
};
