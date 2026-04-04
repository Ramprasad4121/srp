import type { MethodologyPhase, PhaseStatus } from "@srp/shared-types";
import { METHODOLOGY_PHASES, areDependenciesMet, getPhaseDefinition } from "./phases.js";

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
export function createInitialPhaseRecords(): readonly PhaseExecutionRecord[] {
  return METHODOLOGY_PHASES.map((phase) => ({
    phase,
    status: "pending" as PhaseStatus,
    artifactCount: 0
  }));
}

/**
 * Marks a phase as running.
 */
export function markPhaseRunning(
  records: readonly PhaseExecutionRecord[],
  phase: MethodologyPhase
): readonly PhaseExecutionRecord[] {
  return records.map((record) =>
    record.phase === phase
      ? { ...record, status: "running" as PhaseStatus, startedAt: new Date().toISOString() }
      : record
  );
}

/**
 * Marks a phase as completed.
 */
export function markPhaseCompleted(
  records: readonly PhaseExecutionRecord[],
  phase: MethodologyPhase,
  artifactCount: number
): readonly PhaseExecutionRecord[] {
  return records.map((record) =>
    record.phase === phase
      ? {
          ...record,
          status: "completed" as PhaseStatus,
          completedAt: new Date().toISOString(),
          artifactCount
        }
      : record
  );
}

/**
 * Marks a phase as failed.
 */
export function markPhaseFailed(
  records: readonly PhaseExecutionRecord[],
  phase: MethodologyPhase,
  errorMessage: string
): readonly PhaseExecutionRecord[] {
  return records.map((record) =>
    record.phase === phase
      ? {
          ...record,
          status: "failed" as PhaseStatus,
          completedAt: new Date().toISOString(),
          ...(errorMessage ? { errorMessage } : {})
        }
      : record
  );
}

/**
 * Gets the set of completed phases from a list of records.
 */
export function getCompletedPhases(
  records: readonly PhaseExecutionRecord[]
): ReadonlySet<MethodologyPhase> {
  return new Set(
    records.filter((r) => r.status === "completed").map((r) => r.phase)
  );
}

/**
 * Gets the next phase eligible for execution.
 */
export function getNextEligiblePhase(
  records: readonly PhaseExecutionRecord[]
): MethodologyPhase | null {
  const completed = getCompletedPhases(records);
  const pending = records.find(
    (r) => r.status === "pending" && areDependenciesMet(r.phase, completed)
  );
  return pending?.phase ?? null;
}

/**
 * Computes overall run progress as a fraction between 0.0 and 1.0.
 */
export function computeRunProgress(records: readonly PhaseExecutionRecord[]): number {
  if (records.length === 0) return 0;
  const completed = records.filter((r) => r.status === "completed").length;
  return completed / records.length;
}

/**
 * Total artifact count across all phases.
 */
export function totalArtifacts(records: readonly PhaseExecutionRecord[]): number {
  return records.reduce((sum, r) => sum + r.artifactCount, 0);
}
