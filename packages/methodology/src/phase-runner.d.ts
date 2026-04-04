import type { MethodologyPhase, PhaseStatus } from "@srp/shared-types";
/**
 * Tracks the execution state of a single phase within a run.
 */
export interface PhaseExecutionRecord {
    readonly phase: MethodologyPhase;
    readonly status: PhaseStatus;
    readonly startedAt?: string;
    readonly completedAt?: string;
    readonly artifactCount: number;
    readonly errorMessage?: string;
}
/**
 * Creates the initial set of phase records for a new audit run.
 */
export declare function createInitialPhaseRecords(): readonly PhaseExecutionRecord[];
/**
 * Marks a phase as running.
 */
export declare function markPhaseRunning(records: readonly PhaseExecutionRecord[], phase: MethodologyPhase): readonly PhaseExecutionRecord[];
/**
 * Marks a phase as completed.
 */
export declare function markPhaseCompleted(records: readonly PhaseExecutionRecord[], phase: MethodologyPhase, artifactCount: number): readonly PhaseExecutionRecord[];
/**
 * Marks a phase as failed.
 */
export declare function markPhaseFailed(records: readonly PhaseExecutionRecord[], phase: MethodologyPhase, errorMessage: string): readonly PhaseExecutionRecord[];
/**
 * Gets the set of completed phases from a list of records.
 */
export declare function getCompletedPhases(records: readonly PhaseExecutionRecord[]): ReadonlySet<MethodologyPhase>;
/**
 * Gets the next phase eligible for execution.
 */
export declare function getNextEligiblePhase(records: readonly PhaseExecutionRecord[]): MethodologyPhase | null;
/**
 * Computes overall run progress as a fraction between 0.0 and 1.0.
 */
export declare function computeRunProgress(records: readonly PhaseExecutionRecord[]): number;
/**
 * Total artifact count across all phases.
 */
export declare function totalArtifacts(records: readonly PhaseExecutionRecord[]): number;
//# sourceMappingURL=phase-runner.d.ts.map