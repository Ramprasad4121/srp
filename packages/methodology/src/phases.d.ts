import type { MethodologyPhase, ArtifactKind } from "@srp/shared-types";
/**
 * Redefined Discovery-First methodology phases.
 */
export declare const METHODOLOGY_PHASES: readonly MethodologyPhase[];
/**
 * Human-readable labels.
 */
export declare const PHASE_LABELS: Readonly<Record<MethodologyPhase, string>>;
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
export declare const PHASE_DEFINITIONS: readonly PhaseDefinition[];
export declare function getPhaseDefinition(phase: MethodologyPhase): PhaseDefinition;
export declare function areDependenciesMet(phase: MethodologyPhase, completedPhases: ReadonlySet<MethodologyPhase>): boolean;
export declare function getPhaseIndex(phase: MethodologyPhase): number;
export declare function getNextPhase(currentPhase: MethodologyPhase): MethodologyPhase | null;
//# sourceMappingURL=phases.d.ts.map