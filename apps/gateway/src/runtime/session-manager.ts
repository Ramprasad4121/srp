import type { 
  ArtifactMetadata,
  ArtifactKind,
  MethodologyPhase, 
  PhaseStatus, 
  PhaseState, 
  ProjectMemory,
  SetupIdentity,
  RuntimeSessionState, 
  ProviderSelection,
  RunManifest,
  SessionStatus
} from "@srp/shared-types";
import { randomUUID } from "node:crypto";
import { PersistenceManager } from "./persistence-manager.js";
import { AgentRegistry, KnowledgeBus } from "./agent-coordinator.js";
import { AuditRoomProjector } from "./room-projection.js";
import { rebuildBuildRoomProjection } from "./build-room-projection.js";
import { RuntimeArtifactWriter } from "./artifact-writer.js";
import { runAuditWorkflow, type SessionRuntimeMemory } from "./workflow-runner.js";

const knowledgeBus = new KnowledgeBus();
const agentRegistry = new AgentRegistry();
const auditRoomProjector = new AuditRoomProjector();

// ---------------------------------------------------------------------------
// Simulated methodology pipeline configuration
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
// Memory Store (Active Session)
// ---------------------------------------------------------------------------

let activeSessionId: string | null = null;
let activeRunId: string | null = null;
let isRunning = false;
let phaseStates: PhaseState[] = [];
let activeAbortController: AbortController | null = null;
let activePipelineTask: Promise<void> | null = null;
let liveRunCreatedAt: string | null = null;

let persistence: PersistenceManager | null = null;
let artifactWriter: RuntimeArtifactWriter | null = null;
let liveArtifacts: ArtifactMetadata[] = [];
let liveRunStatus: SessionStatus = "idle";
let liveFailureDetail: string | undefined;
let activeProjectId: string | null = null;
let activeIdentity: SetupIdentity | undefined;
let activeProjectMemory: ProjectMemory | undefined;
const runtimeMemory: SessionRuntimeMemory = {
  currentPhaseIndex: -1,
  pendingDiscoveryRegistry: undefined,
  pendingWorkspaceAnalysis: undefined,
  pendingCodebaseContext: undefined,
  pendingIntentSummary: undefined,
  pendingArchitectureSummary: undefined,
  pendingProtocolDiagram: undefined,
  pendingFunctionMap: undefined,
  pendingEntryExitMatrix: undefined,
  pendingInvariantRegistry: undefined,
  pendingHypothesisRegistry: undefined,
  pendingVerificationPlan: undefined,
  pendingToolchainExecution: undefined,
  pendingEconomicAnalysis: undefined,
  pendingCrossContractAnalysis: undefined,
  pendingFindingRegistry: undefined,
  pendingRemediationPlan: undefined,
  pendingFormalReport: undefined
};

function getCurrentPhase(): MethodologyPhase | null {
  return runtimeMemory.currentPhaseIndex >= 0 && runtimeMemory.currentPhaseIndex < TARGET_PHASES.length
    ? (TARGET_PHASES[runtimeMemory.currentPhaseIndex] ?? null)
    : null;
}

function resetRuntimeMemory(): void {
  runtimeMemory.currentPhaseIndex = -1;
  runtimeMemory.pendingDiscoveryRegistry = undefined;
  runtimeMemory.pendingWorkspaceAnalysis = undefined;
  runtimeMemory.pendingCodebaseContext = undefined;
  runtimeMemory.pendingIntentSummary = undefined;
  runtimeMemory.pendingArchitectureSummary = undefined;
  runtimeMemory.pendingProtocolDiagram = undefined;
  runtimeMemory.pendingFunctionMap = undefined;
  runtimeMemory.pendingEntryExitMatrix = undefined;
  runtimeMemory.pendingInvariantRegistry = undefined;
  runtimeMemory.pendingVerificationPlan = undefined;
  runtimeMemory.pendingToolchainExecution = undefined;
  runtimeMemory.pendingHypothesisRegistry = undefined;
  runtimeMemory.pendingEconomicAnalysis = undefined;
  runtimeMemory.pendingCrossContractAnalysis = undefined;
  runtimeMemory.pendingFindingRegistry = undefined;
  runtimeMemory.pendingRemediationPlan = undefined;
  runtimeMemory.pendingFormalReport = undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getSessionState(): RuntimeSessionState {
  const liveManifest: RunManifest | null =
    activeRunId && activeSessionId && activeProjectId
      ? {
          runId: activeRunId,
          projectId: activeProjectId,
          sessionId: activeSessionId,
          status: liveRunStatus,
          createdAt: liveRunCreatedAt ?? new Date().toISOString(),
          ...(getCurrentPhase() ? { currentPhase: getCurrentPhase()! } : {}),
          artifacts: [...liveArtifacts]
        }
      : null;
  const state: any = {
    hasSession: activeSessionId !== null,
    isRunning,
    sessionId: activeSessionId,
    runId: activeRunId,
    projectId: activeProjectId,
    ...(activeIdentity ? { identity: activeIdentity } : {}),
    ...(activeProjectMemory ? { projectMemory: activeProjectMemory } : {}),
    currentPhase: getCurrentPhase(),
    phases: [...phaseStates],
    agentRegistry: agentRegistry.getState(),
    knowledgeBus: knowledgeBus.getState(),
    auditRoom: auditRoomProjector.snapshot(
      phaseStates,
      getCurrentPhase()
    ),
    ...(liveManifest
      ? {
          buildRoom: rebuildBuildRoomProjection({
            manifest: liveManifest,
            ...(liveFailureDetail ? { failureDetail: liveFailureDetail } : {})
          })
        }
      : {})
  };

  if (runtimeMemory.pendingDiscoveryRegistry) state.discoveryRegistry = runtimeMemory.pendingDiscoveryRegistry;
  if (runtimeMemory.pendingWorkspaceAnalysis) state.workspaceAnalysis = runtimeMemory.pendingWorkspaceAnalysis;
  if (runtimeMemory.pendingCodebaseContext) state.codebaseContext = runtimeMemory.pendingCodebaseContext;
  if (runtimeMemory.pendingIntentSummary) state.intentSummary = runtimeMemory.pendingIntentSummary;
  if (runtimeMemory.pendingArchitectureSummary) state.architectureSummary = runtimeMemory.pendingArchitectureSummary;
  if (runtimeMemory.pendingProtocolDiagram) state.protocolDiagram = runtimeMemory.pendingProtocolDiagram;
  if (runtimeMemory.pendingFunctionMap) state.functionMap = runtimeMemory.pendingFunctionMap;
  if (runtimeMemory.pendingEntryExitMatrix) state.entryExitMatrix = runtimeMemory.pendingEntryExitMatrix;
  if (runtimeMemory.pendingInvariantRegistry) state.invariantRegistry = runtimeMemory.pendingInvariantRegistry;
  if (runtimeMemory.pendingVerificationPlan) state.verificationPlan = runtimeMemory.pendingVerificationPlan;
  if (runtimeMemory.pendingToolchainExecution) state.toolchainExecution = runtimeMemory.pendingToolchainExecution;
  if (runtimeMemory.pendingHypothesisRegistry) state.hypothesisRegistry = runtimeMemory.pendingHypothesisRegistry;
  if (runtimeMemory.pendingEconomicAnalysis) state.economicAnalysis = runtimeMemory.pendingEconomicAnalysis;
  if (runtimeMemory.pendingCrossContractAnalysis) state.crossContractAnalysis = runtimeMemory.pendingCrossContractAnalysis;
  if (runtimeMemory.pendingFindingRegistry) state.findingRegistry = runtimeMemory.pendingFindingRegistry;
  if (runtimeMemory.pendingRemediationPlan) state.remediationPlan = runtimeMemory.pendingRemediationPlan;
  if (runtimeMemory.pendingFormalReport) state.formalReport = runtimeMemory.pendingFormalReport;

  return state as RuntimeSessionState;
}

export function startSession(
  rootDirectory: string,
  providers?: readonly ProviderSelection[],
  options?: {
    readonly projectId?: string;
    readonly identity?: SetupIdentity;
    readonly outputDirectory?: string;
  }
): void {
  if (isRunning) return; // Prevent double start

  // Initialize persistence
  const outputDirectory = options?.outputDirectory ?? ".srp";
  persistence = new PersistenceManager(rootDirectory, outputDirectory);
  artifactWriter = new RuntimeArtifactWriter(persistence, auditRoomProjector);

  // Initialize new session
  activeSessionId = `session_${randomUUID()}`;
  activeRunId = `run_${randomUUID()}`;
  activeProjectId = options?.projectId ?? "default-project";
  activeIdentity = options?.identity;
  isRunning = true;
  liveRunCreatedAt = new Date().toISOString();
  activeAbortController = new AbortController();
  resetRuntimeMemory();
  liveArtifacts = [];
  liveRunStatus = "running";
  liveFailureDetail = undefined;
  activeProjectMemory = undefined;

  agentRegistry.clear();
  knowledgeBus.clear();
  auditRoomProjector.reset(activeRunId, activeSessionId);

  phaseStates = TARGET_PHASES.map((p) => ({
    phase: p,
    status: "pending" as PhaseStatus
  }));

  // Kick off background execution loop
  const activeProvider = providers?.find(p => p.enabled) || undefined;
  activePipelineTask = (async () => {
    await persistence!.init();
    activeProjectMemory = await persistence!.loadOrCreateProjectMemory(
      activeIdentity ?? {
        userProfile: "builder",
        goal: "build",
        department: "build"
      }
    );
    activeProjectId = activeProjectMemory.projectId;

    await runAuditWorkflow({
      projectId: activeProjectId,
      runId: activeRunId!,
      sessionId: activeSessionId!,
      rootDirectory,
      activeProvider,
      signal: activeAbortController!.signal,
      phases: phaseStates,
      persistence: persistence!,
      artifactWriter: artifactWriter!,
      agentRegistry,
      knowledgeBus,
      runtimeMemory,
      updatePhaseStatus,
      persistArtifact: persistArtifactAndEmit
    });
  })().catch((err) => {
    if (!activeAbortController?.signal.aborted) {
      liveRunStatus = "failed";
      liveFailureDetail = err instanceof Error ? err.message : String(err);
      console.error("Pipeline failed:", err);
    }
  }).finally(() => {
    isRunning = false;
    activeAbortController = null;
  });
  void activePipelineTask;
}

export async function getPersistence(): Promise<PersistenceManager> {
  if (!persistence) {
    throw new Error("Persistence not initialized. Start a session or init with defaults.");
  }
  return persistence;
}

export async function stopSession(): Promise<void> {
  if (!isRunning) {
    return;
  }

  if (activeAbortController) {
    activeAbortController.abort();
  }

  if (activePipelineTask) {
    try {
      await activePipelineTask;
    } catch {
      // Shutdown path: ignore runtime pipeline errors while stopping.
    }
  }
}

// ---------------------------------------------------------------------------
// Private Execution Loop
// ---------------------------------------------------------------------------

function updatePhaseStatus(index: number, status: PhaseStatus, projectId: string, runId: string) {
  const phase = phaseStates[index];
  if (!phase) return;

  const updated: any = { ...phase, status };
  if (status === "running") updated.startedAt = new Date().toISOString();
  if (status === "completed" || status === "failed") updated.completedAt = new Date().toISOString();

  phaseStates[index] = updated as PhaseState;
  liveRunStatus =
    status === "failed"
      ? "failed"
      : index === phaseStates.length - 1 && status === "completed"
        ? "completed"
        : "running";
  if (artifactWriter) {
    void artifactWriter.recordPhaseStatus(runId, projectId, updated.phase, status, liveRunStatus);
  }
}

async function persistArtifactAndEmit(
  runId: string,
  projectId: string,
  phase: MethodologyPhase,
  kind: ArtifactKind,
  title: string,
  payload: unknown
): Promise<void> {
  if (!artifactWriter) {
    return;
  }
  const metadata = await artifactWriter.persistArtifact(runId, projectId, phase, kind, title, payload);
  liveArtifacts = [...liveArtifacts, metadata];
  if (persistence) {
    activeProjectMemory = await persistence.getProjectMemory() ?? activeProjectMemory;
  }
}
