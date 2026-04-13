import { METHODOLOGY_PHASES, areDependenciesMet } from "./phases.js";
/**
 * Creates the initial set of phase records for a new audit run.
 */
export function createInitialPhaseRecords() {
    return METHODOLOGY_PHASES.map((phase) => ({
        phase,
        status: "pending",
        artifactCount: 0
    }));
}
/**
 * Marks a phase as running.
 */
export function markPhaseRunning(records, phase) {
    return records.map((record) => record.phase === phase
        ? { ...record, status: "running", startedAt: new Date().toISOString() }
        : record);
}
/**
 * Marks a phase as completed.
 */
export function markPhaseCompleted(records, phase, artifactCount) {
    return records.map((record) => record.phase === phase
        ? {
            ...record,
            status: "completed",
            completedAt: new Date().toISOString(),
            artifactCount
        }
        : record);
}
/**
 * Marks a phase as failed.
 */
export function markPhaseFailed(records, phase, errorMessage) {
    return records.map((record) => record.phase === phase
        ? {
            ...record,
            status: "failed",
            completedAt: new Date().toISOString(),
            ...(errorMessage ? { errorMessage } : {})
        }
        : record);
}
/**
 * Gets the set of completed phases from a list of records.
 */
export function getCompletedPhases(records) {
    return new Set(records.filter((r) => r.status === "completed").map((r) => r.phase));
}
/**
 * Gets the next phase eligible for execution.
 */
export function getNextEligiblePhase(records) {
    const completed = getCompletedPhases(records);
    const pending = records.find((r) => r.status === "pending" && areDependenciesMet(r.phase, completed));
    return pending?.phase ?? null;
}
/**
 * Computes overall run progress as a fraction between 0.0 and 1.0.
 */
export function computeRunProgress(records) {
    if (records.length === 0)
        return 0;
    const completed = records.filter((r) => r.status === "completed").length;
    return completed / records.length;
}
/**
 * Total artifact count across all phases.
 */
export function totalArtifacts(records) {
    return records.reduce((sum, r) => sum + r.artifactCount, 0);
}
//# sourceMappingURL=phase-runner.js.map