import type { MethodologyPhase, ArtifactKind } from "@srp/shared-types";
/**
 * Ordered list of methodology phases as defined in the senior auditor process.
 * This is the canonical execution order for `srp audit`.
 */
export declare const METHODOLOGY_PHASES: readonly MethodologyPhase[];
/**
 * Human-readable label for each methodology phase.
 */
export declare const PHASE_LABELS: Readonly<Record<MethodologyPhase, string>>;
/**
 * Expected artifact kinds produced by each phase.
 */
export declare const PHASE_ARTIFACT_KINDS: Readonly<Record<MethodologyPhase, readonly ArtifactKind[]>>;
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
export declare const PHASE_DEFINITIONS: readonly PhaseDefinition[];
export declare function getPhaseDefinition(phase: MethodologyPhase): PhaseDefinition;
export declare function getPhaseIndex(phase: MethodologyPhase): number;
export declare function getNextPhase(currentPhase: MethodologyPhase): MethodologyPhase | null;
export declare function areDependenciesMet(phase: MethodologyPhase, completedPhases: ReadonlySet<MethodologyPhase>): boolean;
//# sourceMappingURL=phases.d.ts.map