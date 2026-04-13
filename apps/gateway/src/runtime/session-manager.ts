import type { 
  ArtifactKind,
  MethodologyPhase, 
  PhaseStatus, 
  PhaseState, 
  RuntimeSessionState, 
  ProviderSelection
} from "@srp/shared-types";
import { randomUUID } from "node:crypto";
import { PersistenceManager } from "./persistence-manager.js";
import { AgentRegistry, KnowledgeBus } from "./agent-coordinator.js";
import { AuditRoomProjector } from "./room-projection.js";
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

let persistence: PersistenceManager | null = null;
let artifactWriter: RuntimeArtifactWriter | null = null;
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
  const state: any = {
    hasSession: activeSessionId !== null,
    isRunning,
    sessionId: activeSessionId,
    runId: activeRunId,
    currentPhase: getCurrentPhase(),
    phases: [...phaseStates],
    agentRegistry: agentRegistry.getState(),
    knowledgeBus: knowledgeBus.getState(),
    auditRoom: auditRoomProjector.snapshot(
      phaseStates,
      getCurrentPhase()
    )
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
  projectId: string = "default-project",
  outputDirectory: string = ".srp"
): void {
  if (isRunning) return; // Prevent double start

  // Initialize persistence
  persistence = new PersistenceManager(rootDirectory, outputDirectory);
  artifactWriter = new RuntimeArtifactWriter(persistence, auditRoomProjector);

  // Initialize new session
  activeSessionId = `session_${randomUUID()}`;
  activeRunId = `run_${randomUUID()}`;
  isRunning = true;
  activeAbortController = new AbortController();
  resetRuntimeMemory();

  agentRegistry.clear();
  knowledgeBus.clear();
  auditRoomProjector.reset(activeRunId, activeSessionId);

  phaseStates = TARGET_PHASES.map((p) => ({
    phase: p,
    status: "pending" as PhaseStatus
  }));

  // Kick off background execution loop
  const activeProvider = providers?.find(p => p.enabled) || undefined;
  activePipelineTask = runAuditWorkflow({
    projectId,
    runId: activeRunId,
    sessionId: activeSessionId,
    rootDirectory,
    activeProvider,
    signal: activeAbortController.signal,
    phases: phaseStates,
    persistence,
    artifactWriter,
    agentRegistry,
    knowledgeBus,
    runtimeMemory,
    updatePhaseStatus,
    persistArtifact: persistArtifactAndEmit
  }).catch((err) => {
    if (!activeAbortController?.signal.aborted) {
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
  if (artifactWriter) {
    const sessionStatus =
      status === "failed"
        ? "failed"
        : index === phaseStates.length - 1 && status === "completed"
          ? "completed"
          : "running";
    void artifactWriter.recordPhaseStatus(runId, projectId, updated.phase, status, sessionStatus);
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
  await artifactWriter.persistArtifact(runId, projectId, phase, kind, title, payload);
}
