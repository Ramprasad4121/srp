import type {
  ArtifactKind,
  MethodologyPhase,
  PhaseStatus,
  PhaseState,
  RuntimeSessionState,
  ProviderSelection,
  RunManifest
} from "@srp/shared-types";
import { randomUUID } from "node:crypto";
import { ProjectStore, DEFAULT_PROJECT_ID } from "@srp/project-memory";
import { PersistenceManager } from "./persistence-manager.js";
import { rebuildBuildRoomProjection } from "./build-room-projection.js";
import { RuntimeArtifactWriter } from "./artifact-writer.js";
import { runAuditWorkflow } from "./workflow-runner.js";
import {
  runtimeRegistry,
  resetRuntimeMemory,
  type RuntimeEntry
} from "./runtime-registry.js";

// ---------------------------------------------------------------------------
// Methodology pipeline configuration
// ---------------------------------------------------------------------------

const TARGET_PHASES: readonly MethodologyPhase[] = [
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
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getCurrentPhase(entry: RuntimeEntry): MethodologyPhase | null {
  const idx = entry.runtimeMemory.currentPhaseIndex;
  return idx >= 0 && idx < TARGET_PHASES.length
    ? (TARGET_PHASES[idx] ?? null)
    : null;
}

/**
 * Build the empty `RuntimeSessionState` returned when no session has
 * ever been started on this server. Mirrors the legacy zero-state.
 */
function emptySessionState(): RuntimeSessionState {
  return {
    hasSession: false,
    isRunning: false,
    sessionId: null,
    runId: null,
    currentPhase: null,
    phases: [],
    agentRegistry: { agents: [] } as any,
    knowledgeBus: { entries: [] } as any,
    auditRoom: undefined as any
  } as RuntimeSessionState;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Snapshot the runtime state for a project. With no `projectId`,
 * resolves to the most-recently-selected project (the one that last
 * called `startSession`); if the server has never started a session,
 * returns the empty state.
 */
export function getSessionState(projectId?: string): RuntimeSessionState {
  const entry = runtimeRegistry.resolve(projectId);
  if (!entry) {
    return emptySessionState();
  }

  const liveManifest: RunManifest | null =
    entry.activeRunId && entry.activeSessionId
      ? {
          runId: entry.activeRunId,
          projectId: entry.projectId,
          sessionId: entry.activeSessionId,
          status: entry.liveRunStatus,
          createdAt: entry.liveRunCreatedAt ?? new Date().toISOString(),
          ...(getCurrentPhase(entry) ? { currentPhase: getCurrentPhase(entry)! } : {}),
          artifacts: [...entry.liveArtifacts]
        }
      : null;

  const state: any = {
    hasSession: entry.activeSessionId !== null,
    isRunning: entry.isRunning,
    sessionId: entry.activeSessionId,
    runId: entry.activeRunId,
    currentPhase: getCurrentPhase(entry),
    phases: [...entry.phaseStates],
    agentRegistry: entry.agentRegistry.getState(),
    knowledgeBus: entry.knowledgeBus.getState(),
    auditRoom: entry.auditRoomProjector.snapshot(
      entry.phaseStates,
      getCurrentPhase(entry)
    ),
    ...(liveManifest
      ? {
          buildRoom: rebuildBuildRoomProjection({
            manifest: liveManifest,
            ...(entry.liveFailureDetail ? { failureDetail: entry.liveFailureDetail } : {})
          })
        }
      : {})
  };

  const m = entry.runtimeMemory;
  if (m.pendingDiscoveryRegistry) state.discoveryRegistry = m.pendingDiscoveryRegistry;
  if (m.pendingWorkspaceAnalysis) state.workspaceAnalysis = m.pendingWorkspaceAnalysis;
  if (m.pendingCodebaseContext) state.codebaseContext = m.pendingCodebaseContext;
  if (m.pendingIntentSummary) state.intentSummary = m.pendingIntentSummary;
  if (m.pendingArchitectureSummary) state.architectureSummary = m.pendingArchitectureSummary;
  if (m.pendingProtocolDiagram) state.protocolDiagram = m.pendingProtocolDiagram;
  if (m.pendingFunctionMap) state.functionMap = m.pendingFunctionMap;
  if (m.pendingEntryExitMatrix) state.entryExitMatrix = m.pendingEntryExitMatrix;
  if (m.pendingInvariantRegistry) state.invariantRegistry = m.pendingInvariantRegistry;
  if (m.pendingVerificationPlan) state.verificationPlan = m.pendingVerificationPlan;
  if (m.pendingToolchainExecution) state.toolchainExecution = m.pendingToolchainExecution;
  if (m.pendingHypothesisRegistry) state.hypothesisRegistry = m.pendingHypothesisRegistry;
  if (m.pendingEconomicAnalysis) state.economicAnalysis = m.pendingEconomicAnalysis;
  if (m.pendingCrossContractAnalysis) state.crossContractAnalysis = m.pendingCrossContractAnalysis;
  if (m.pendingFindingRegistry) state.findingRegistry = m.pendingFindingRegistry;
  if (m.pendingRemediationPlan) state.remediationPlan = m.pendingRemediationPlan;
  if (m.pendingFormalReport) state.formalReport = m.pendingFormalReport;

  return state as RuntimeSessionState;
}

/**
 * Resolve which project id to use when one isn't supplied explicitly.
 * Order:
 *   1. The registry's currently-selected project (most recent startSession).
 *   2. The active project from the on-disk ProjectStore.
 *   3. `DEFAULT_PROJECT_ID` as a last-resort fallback.
 */
async function resolveProjectId(rootDirectory: string, projectId?: string): Promise<string> {
  if (projectId && projectId.trim().length > 0) return projectId;
  const selected = runtimeRegistry.getSelectedProjectId();
  if (selected) return selected;
  try {
    const store = new ProjectStore(rootDirectory);
    await store.init();
    const active = await store.getActive();
    if (active) return active.id;
  } catch {
    // fall through to default
  }
  return DEFAULT_PROJECT_ID;
}

export async function startSession(
  rootDirectory: string,
  providers?: readonly ProviderSelection[],
  projectId?: string,
  outputDirectory: string = ".srp"
): Promise<void> {
  const resolvedProjectId = await resolveProjectId(rootDirectory, projectId);
  const entry = runtimeRegistry.getOrCreate(resolvedProjectId);

  if (entry.isRunning) return; // Prevent double start within this project.

  // Initialize project-scoped persistence.
  entry.persistence = new PersistenceManager(rootDirectory, resolvedProjectId, outputDirectory);
  entry.artifactWriter = new RuntimeArtifactWriter(entry.persistence, entry.auditRoomProjector);

  // Initialize a new session for this project.
  entry.activeSessionId = `session_${randomUUID()}`;
  entry.activeRunId = `run_${randomUUID()}`;
  entry.isRunning = true;
  entry.liveRunCreatedAt = new Date().toISOString();
  entry.activeAbortController = new AbortController();
  resetRuntimeMemory(entry);
  entry.liveArtifacts = [];
  entry.liveRunStatus = "running";
  entry.liveFailureDetail = undefined;

  entry.agentRegistry.clear();
  entry.knowledgeBus.clear();
  entry.auditRoomProjector.reset(entry.activeRunId, entry.activeSessionId);

  entry.phaseStates = TARGET_PHASES.map((p) => ({
    phase: p,
    status: "pending" as PhaseStatus
  }));

  // Kick off background execution loop. Closures bind to *this* entry
  // so the workflow callbacks never read or write another project's state.
  const activeProvider = providers?.find((p) => p.enabled) || undefined;
  entry.activePipelineTask = runAuditWorkflow({
    projectId: resolvedProjectId,
    runId: entry.activeRunId,
    sessionId: entry.activeSessionId,
    rootDirectory,
    activeProvider,
    signal: entry.activeAbortController.signal,
    phases: entry.phaseStates,
    persistence: entry.persistence,
    artifactWriter: entry.artifactWriter,
    agentRegistry: entry.agentRegistry,
    knowledgeBus: entry.knowledgeBus,
    runtimeMemory: entry.runtimeMemory,
    updatePhaseStatus: (index, status, _projectId, runId) =>
      updatePhaseStatusFor(entry, index, status, runId),
    persistArtifact: (runId, projectIdArg, phase, kind, title, payload) =>
      persistArtifactAndEmitFor(entry, runId, projectIdArg, phase, kind, title, payload)
  })
    .catch((err) => {
      if (!entry.activeAbortController?.signal.aborted) {
        entry.liveRunStatus = "failed";
        entry.liveFailureDetail = err instanceof Error ? err.message : String(err);
        console.error(`Pipeline failed for project ${resolvedProjectId}:`, err);
      }
    })
    .finally(() => {
      entry.isRunning = false;
      entry.activeAbortController = null;
    });
  void entry.activePipelineTask;
}

/**
 * Resolve the persistence manager for a project. Throws when no session
 * has been started for that project — callers that need a fallback path
 * should resolve the active project via ProjectStore and instantiate
 * `PersistenceManager` directly (see `getPersistenceOrFallback` in the
 * runs / control-plane handlers).
 */
export async function getPersistence(projectId?: string): Promise<PersistenceManager> {
  const entry = runtimeRegistry.resolve(projectId);
  if (!entry || !entry.persistence) {
    throw new Error("Persistence not initialized. Start a session or init with defaults.");
  }
  return entry.persistence;
}

export async function stopSession(projectId?: string): Promise<void> {
  // No projectId given → stop every running project. This preserves the
  // legacy "stopSession()" semantic used by the server's shutdown hook.
  if (!projectId) {
    const ids = runtimeRegistry.listProjectIds();
    await Promise.all(ids.map((id) => stopSession(id)));
    return;
  }

  const entry = runtimeRegistry.peek(projectId);
  if (!entry || !entry.isRunning) return;

  if (entry.activeAbortController) {
    entry.activeAbortController.abort();
  }
  if (entry.activePipelineTask) {
    try {
      await entry.activePipelineTask;
    } catch {
      // Shutdown path: ignore runtime pipeline errors while stopping.
    }
  }
}

// ---------------------------------------------------------------------------
// Private execution helpers (closure-bound to a single RuntimeEntry)
// ---------------------------------------------------------------------------

function updatePhaseStatusFor(
  entry: RuntimeEntry,
  index: number,
  status: PhaseStatus,
  runId: string
): void {
  const phase = entry.phaseStates[index];
  if (!phase) return;

  const updated: any = { ...phase, status };
  if (status === "running") updated.startedAt = new Date().toISOString();
  if (status === "completed" || status === "failed") {
    updated.completedAt = new Date().toISOString();
  }

  entry.phaseStates[index] = updated as PhaseState;
  entry.liveRunStatus =
    status === "failed"
      ? "failed"
      : index === entry.phaseStates.length - 1 && status === "completed"
        ? "completed"
        : "running";
  if (entry.artifactWriter) {
    void entry.artifactWriter.recordPhaseStatus(
      runId,
      entry.projectId,
      updated.phase,
      status,
      entry.liveRunStatus
    );
  }
}

async function persistArtifactAndEmitFor(
  entry: RuntimeEntry,
  runId: string,
  projectId: string,
  phase: MethodologyPhase,
  kind: ArtifactKind,
  title: string,
  payload: unknown
): Promise<void> {
  if (!entry.artifactWriter) return;
  const metadata = await entry.artifactWriter.persistArtifact(
    runId,
    projectId,
    phase,
    kind,
    title,
    payload
  );
  entry.liveArtifacts = [...entry.liveArtifacts, metadata];
}
