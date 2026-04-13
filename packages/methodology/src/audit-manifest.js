/**
 * Derives a summary from a full audit manifest.
 */
export function summarizeAuditRun(manifest) {
    const phasesCompleted = manifest.phaseRecords.filter((r) => r.status === "completed").length;
    const phasesTotal = manifest.phaseRecords.length;
    return {
        runId: manifest.runId,
        projectId: manifest.projectId,
        status: manifest.status,
        createdAt: manifest.createdAt,
        ...(manifest.completedAt ? { completedAt: manifest.completedAt } : {}),
        ...(manifest.currentPhase ? { currentPhase: manifest.currentPhase } : {}),
        phasesCompleted,
        phasesTotal,
        totalArtifacts: manifest.totalArtifacts,
        progress: phasesTotal > 0 ? phasesCompleted / phasesTotal : 0
    };
}
//# sourceMappingURL=audit-manifest.js.map