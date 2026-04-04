import type { MethodologyPhase, PhaseStatus, PhaseState, RuntimeSessionState, WorkspaceAnalysis, CodebaseContextSummary, IntentSummary, ArchitectureSummary, InvariantRegistry, VerificationPlan, HypothesisRegistry, EconomicAnalysis, FormalReport, CrossContractAnalysis, FindingRegistry, RemediationPlan, ProtocolDiagram } from "@srp/shared-types";
import { createArtifactCreatedEvent, createPhaseStatusChangedEvent, createSessionStartedEvent } from "@srp/events";
import { sharedEventBus } from "../events/event-bus.js";
import { analyzeWorkspace } from "./analyzers/workspace-analyzer.js";
import { buildCodebaseContext } from "./analyzers/codebase-context.js";
import { generateArchitectureSummary, generateProtocolDiagram, generateInvariants, generateVerificationPlan, generateHypotheses, generateEconomicAnalysis, generateFormalReport, generateCrossContractAnalysis, generateFindingRegistry, generateRemediationPlan } from "./providers/inference-bridge.js";
import type { ProviderSelection } from "@srp/shared-types";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { PersistenceManager } from "./persistence-manager.js";
import type { ArtifactKind, RunEventLogEntry } from "@srp/shared-types";
import { runPoC } from "./poc-runner.js";
import type { ToolchainExecution } from "@srp/shared-types";
import { runToolchainWorkflows } from "./toolchain-runner.js";

// ---------------------------------------------------------------------------
// Simulated methodology pipeline configuration
// ---------------------------------------------------------------------------

const TARGET_PHASES: readonly MethodologyPhase[] = [
  "phase-0-preparation",
  "phase-1-recon",
  "phase-2-architecture",
  "phase-3-invariants",
  "phase-4-hypotheses",
  "phase-5-code-reading",
  "phase-6-notes",
  "phase-7-simulations",
  "phase-8-interaction-matrix",
  "phase-9-economic-modeling",
  "phase-10-cross-contract-paths",
  "phase-11-reporting",
  "phase-12-remediation"
];

// ---------------------------------------------------------------------------
// Memory Store (Active Session)
// ---------------------------------------------------------------------------

let activeSessionId: string | null = null;
let activeRunId: string | null = null;
let isRunning = false;
let currentPhaseIndex = -1;
let phaseStates: PhaseState[] = [];
let pendingWorkspaceAnalysis: WorkspaceAnalysis | undefined;
let pendingCodebaseContext: CodebaseContextSummary | undefined;
let pendingIntentSummary: IntentSummary | undefined;
let pendingArchitectureSummary: ArchitectureSummary | undefined;
let pendingProtocolDiagram: ProtocolDiagram | undefined;
let pendingInvariantRegistry: InvariantRegistry | undefined;
let pendingVerificationPlan: VerificationPlan | undefined;
let pendingToolchainExecution: ToolchainExecution | undefined;
let pendingHypothesisRegistry: HypothesisRegistry | undefined;
let pendingEconomicAnalysis: EconomicAnalysis | undefined;
let pendingCrossContractAnalysis: CrossContractAnalysis | undefined;
let pendingFindingRegistry: FindingRegistry | undefined;
let pendingRemediationPlan: RemediationPlan | undefined;
let pendingFormalReport: FormalReport | undefined;
let activeAbortController: AbortController | null = null;
let activePipelineTask: Promise<void> | null = null;

let persistence: PersistenceManager | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getSessionState(): RuntimeSessionState {
  const state: any = {
    hasSession: activeSessionId !== null,
    isRunning,
    sessionId: activeSessionId,
    runId: activeRunId,
    currentPhase: currentPhaseIndex >= 0 && currentPhaseIndex < TARGET_PHASES.length
      ? (TARGET_PHASES[currentPhaseIndex] ?? null)
      : null,
    phases: [...phaseStates]
  };

  if (pendingWorkspaceAnalysis) state.workspaceAnalysis = pendingWorkspaceAnalysis;
  if (pendingCodebaseContext) state.codebaseContext = pendingCodebaseContext;
  if (pendingIntentSummary) state.intentSummary = pendingIntentSummary;
  if (pendingArchitectureSummary) state.architectureSummary = pendingArchitectureSummary;
  if (pendingProtocolDiagram) state.protocolDiagram = pendingProtocolDiagram;
  if (pendingInvariantRegistry) state.invariantRegistry = pendingInvariantRegistry;
  if (pendingVerificationPlan) state.verificationPlan = pendingVerificationPlan;
  if (pendingToolchainExecution) state.toolchainExecution = pendingToolchainExecution;
  if (pendingHypothesisRegistry) state.hypothesisRegistry = pendingHypothesisRegistry;
  if (pendingEconomicAnalysis) state.economicAnalysis = pendingEconomicAnalysis;
  if (pendingCrossContractAnalysis) state.crossContractAnalysis = pendingCrossContractAnalysis;
  if (pendingFindingRegistry) state.findingRegistry = pendingFindingRegistry;
  if (pendingRemediationPlan) state.remediationPlan = pendingRemediationPlan;
  if (pendingFormalReport) state.formalReport = pendingFormalReport;

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

  // Initialize new session
  activeSessionId = `session_${randomUUID()}`;
  activeRunId = `run_${randomUUID()}`;
  isRunning = true;
  activeAbortController = new AbortController();
  currentPhaseIndex = -1;
  pendingWorkspaceAnalysis = undefined;
  pendingCodebaseContext = undefined;
  pendingIntentSummary = undefined;
  pendingArchitectureSummary = undefined;
  pendingProtocolDiagram = undefined;
  pendingInvariantRegistry = undefined;
  pendingVerificationPlan = undefined;
  pendingToolchainExecution = undefined;
  pendingHypothesisRegistry = undefined;
  pendingEconomicAnalysis = undefined;
  pendingCrossContractAnalysis = undefined;
  pendingFindingRegistry = undefined;
  pendingRemediationPlan = undefined;
  pendingFormalReport = undefined;

  phaseStates = TARGET_PHASES.map((p) => ({
    phase: p,
    status: "pending" as PhaseStatus
  }));

  // Emit Session Started
  sharedEventBus.emit(
    createSessionStartedEvent({
      projectId,
      runId: activeRunId,
      sessionId: activeSessionId
    })
  );

  // Kick off background execution loop
  const activeProvider = providers?.find(p => p.enabled) || undefined;
  activePipelineTask = runSimulatedPipeline(
    projectId,
    activeRunId,
    activeSessionId,
    rootDirectory,
    activeProvider,
    activeAbortController.signal
  );
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

  const phaseEvent = createPhaseStatusChangedEvent({
    projectId,
    runId,
    phase: updated.phase,
    status
  });
  sharedEventBus.emit(phaseEvent);

  // Sync run status to disk
  if (persistence) {
    if (status === "running") {
      void persistence.updateRunStatus(runId, "running", updated.phase);
    } else if (index === phaseStates.length - 1 && status === "completed") {
      void persistence.updateRunStatus(runId, "completed", updated.phase);
    }
    const runEvent: RunEventLogEntry = {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      runId,
      projectId,
      type: "phase.status.changed",
      emittedAt: phaseEvent.emittedAt,
      phase: updated.phase,
      status
    };
    void persistence.appendEvent(runId, runEvent);
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
  if (!persistence) {
    return;
  }

  const metadata = await persistence.saveArtifact(runId, projectId, phase, kind, title, payload);
  const artifactEvent = createArtifactCreatedEvent({
    projectId,
    runId,
    phase,
    artifactId: metadata.artifactId,
    artifactKind: metadata.kind,
    artifactTitle: metadata.title
  });
  sharedEventBus.emit(artifactEvent);

  const runEvent: RunEventLogEntry = {
    eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    runId,
    projectId,
    type: "artifact.created",
    emittedAt: artifactEvent.emittedAt,
    phase,
    artifactId: metadata.artifactId,
    artifactKind: metadata.kind,
    artifactTitle: metadata.title
  };
  await persistence.appendEvent(runId, runEvent);
}

async function runSimulatedPipeline(
  projectId: string, 
  runId: string, 
  sessionId: string,
  rootDirectory: string,
  activeProvider: ProviderSelection | undefined,
  signal: AbortSignal
) {
  try {
    if (persistence) {
      await persistence.init();
      await persistence.createRun(runId, projectId, sessionId);
      const sessionEvent: RunEventLogEntry = {
        eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        runId,
        projectId,
        type: "session.started",
        emittedAt: new Date().toISOString()
      };
      await persistence.appendEvent(runId, sessionEvent);
    }

    for (let i = 0; i < phaseStates.length; i++) {
      if (signal.aborted) {
        break;
      }
      currentPhaseIndex = i;
      updatePhaseStatus(i, "running", projectId, runId);
      const phaseName = phaseStates[i]?.phase;

      // PHASE 0: PREPARATION
      if (phaseName === "phase-0-preparation") {
        pendingWorkspaceAnalysis = await analyzeWorkspace(rootDirectory);
        const prep = await generatePreAuditPrep({ workspace: pendingWorkspaceAnalysis }, activeProvider);
        await persistArtifactAndEmit(runId, projectId, phaseName, "note", "Pre-Audit Prep", prep);
      } 
      
      // PHASE 1: RECON
      else if (phaseName === "phase-1-recon") {
        const recon = await generateReconResult({ workspace: pendingWorkspaceAnalysis! }, activeProvider);
        const ctxResult = await buildCodebaseContext(pendingWorkspaceAnalysis!);
        pendingCodebaseContext = ctxResult.summary;
        pendingIntentSummary = ctxResult.intent;
        await persistArtifactAndEmit(runId, projectId, phaseName, "note", "Reconnaissance", recon);
      } 
      
      // PHASE 2: ARCHITECTURE
      else if (phaseName === "phase-2-architecture") {
        pendingArchitectureSummary = await generateArchitectureSummary(
          { workspace: pendingWorkspaceAnalysis!, codebase: pendingCodebaseContext!, intent: pendingIntentSummary! },
          activeProvider
        );
        pendingProtocolDiagram = await generateProtocolDiagram(
          { workspace: pendingWorkspaceAnalysis!, architecture: pendingArchitectureSummary! },
          activeProvider
        );
        await persistArtifactAndEmit(runId, projectId, phaseName, "diagram", "System Architecture", pendingProtocolDiagram);
      } 
      
      // PHASE 3: INVARIANTS
      else if (phaseName === "phase-3-invariants") {
        pendingInvariantRegistry = await generateInvariants(
          { architecture: pendingArchitectureSummary! },
          activeProvider
        );
        await persistArtifactAndEmit(runId, projectId, phaseName, "invariant", "Invariants Registry", pendingInvariantRegistry);
      } 
      
      // PHASE 4: HYPOTHESES
      else if (phaseName === "phase-4-hypotheses") {
        pendingHypothesisRegistry = await generateHypotheses(
          { invariants: pendingInvariantRegistry! },
          activeProvider
        );
        await persistArtifactAndEmit(runId, projectId, phaseName, "hypothesis", "Hypothesis Registry", pendingHypothesisRegistry);
      } 
      
      // PHASE 5: CODE READING
      else if (phaseName === "phase-5-code-reading") {
        const annotations = await generateFunctionAnnotations({ codebase: pendingCodebaseContext! }, activeProvider);
        await persistArtifactAndEmit(runId, projectId, phaseName, "note", "Function Annotations", annotations);
      } 
      
      // PHASE 6: NOTES & QUESTIONS
      else if (phaseName === "phase-6-notes") {
        const questions = await generateQuestionLog({}, activeProvider);
        await persistArtifactAndEmit(runId, projectId, phaseName, "question", "Question Log", questions);
      } 
      
      // PHASE 7: SIMULATIONS
      else if (phaseName === "phase-7-simulations") {
        pendingEconomicAnalysis = await generateEconomicAnalysis(
          { hypotheses: pendingHypothesisRegistry! },
          activeProvider
        );
        await persistArtifactAndEmit(runId, projectId, phaseName, "finding", "Simulation Findings", pendingEconomicAnalysis);
      } 
      
      // PHASE 8: INTERACTION MATRIX
      else if (phaseName === "phase-8-interaction-matrix") {
        const matrix = await generateInteractionMatrix({ architecture: pendingArchitectureSummary! }, activeProvider);
        await persistArtifactAndEmit(runId, projectId, phaseName, "diagram", "Interaction Matrix", matrix);
      } 
      
      // PHASE 9: ECONOMIC MODELING
      else if (phaseName === "phase-9-economic-modeling") {
        const scenarios = await generateEconomicScenarios({ economicAnalysis: pendingEconomicAnalysis! }, activeProvider);
        await persistArtifactAndEmit(runId, projectId, phaseName, "finding", "Economic Scenarios", scenarios);
      } 
      
      // PHASE 10: CROSS-CONTRACT PATHS
      else if (phaseName === "phase-10-cross-contract-paths") {
        pendingCrossContractAnalysis = await generateCrossContractAnalysis(
          { architecture: pendingArchitectureSummary! },
          activeProvider
        );
        await persistArtifactAndEmit(runId, projectId, phaseName, "diagram", "Cross-Contract Paths", pendingCrossContractAnalysis);
      } 
      
      // PHASE 11: REPORTING
      else if (phaseName === "phase-11-reporting") {
        pendingFindingRegistry = await generateFindingRegistry({ economicAnalysis: pendingEconomicAnalysis! }, activeProvider);
        pendingFormalReport = await generateFormalReport({ findingRegistry: pendingFindingRegistry! }, activeProvider);
        await persistArtifactAndEmit(runId, projectId, phaseName, "report", "Audit Report", pendingFormalReport);
      } 
      
      // PHASE 12: REMEDIATION
      else if (phaseName === "phase-12-remediation") {
        pendingRemediationPlan = await generateRemediationPlan({ findingRegistry: pendingFindingRegistry! }, activeProvider);
        await persistArtifactAndEmit(runId, projectId, phaseName, "note", "Remediation Plan", pendingRemediationPlan);
      }

      updatePhaseStatus(i, "completed", projectId, runId);
    }
  } catch (err) {
    if (signal.aborted) return;
    console.error("Pipeline failed:", err);
    if (currentPhaseIndex >= 0) updatePhaseStatus(currentPhaseIndex, "failed", projectId, runId);
  } finally {
    isRunning = false;
    activeAbortController = null;
  }

}
