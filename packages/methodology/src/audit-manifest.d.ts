import type { MethodologyPhase, SessionStatus, ArtifactKind } from "@srp/shared-types";
import type { PhaseExecutionRecord } from "./phase-runner.js";
/**
 * Describes the full manifest of an audit run, tracking all phases and their status.
 */
export interface AuditRunManifest {
    readonly runId: string;
    readonly projectId: string;
    readonly sessionId: string;
    readonly status: SessionStatus;
    readonly createdAt: string;
    readonly completedAt?: string;
    readonly currentPhase?: MethodologyPhase;
    readonly phaseRecords: readonly PhaseExecutionRecord[];
    readonly totalArtifacts: number;
}
/**
 * A record of a single artifact produced during an audit phase.
 */
export interface AuditArtifactEntry {
    readonly artifactId: string;
    readonly kind: ArtifactKind;
    readonly title: string;
    readonly phase: MethodologyPhase;
    readonly createdAt: string;
}
/**
 * Summary of an audit run for display in list views.
 */
export interface AuditRunSummary {
    readonly runId: string;
    readonly projectId: string;
    readonly status: SessionStatus;
    readonly createdAt: string;
    readonly completedAt?: string;
    readonly currentPhase?: MethodologyPhase;
    readonly phasesCompleted: number;
    readonly phasesTotal: number;
    readonly totalArtifacts: number;
    readonly progress: number;
}
/**
 * Derives a summary from a full audit manifest.
 */
export declare function summarizeAuditRun(manifest: AuditRunManifest): AuditRunSummary;
//# sourceMappingURL=audit-manifest.d.ts.map