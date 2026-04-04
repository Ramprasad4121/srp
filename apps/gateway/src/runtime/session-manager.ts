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
  "phase-1-intent",
  "phase-2-architecture",
  "phase-3-invariants",
  "phase-4-code-reading",
  "phase-5-attack-simulation",
  "phase-6-economic-modeling",
  "phase-7-cross-contract-paths",
  "phase-8-finding-verification",
  "phase-10-remediation",
  "phase-9-reporting"
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

      // 1. Mark Running
      updatePhaseStatus(i, "running", projectId, runId);

      const phaseName = phaseStates[i]?.phase;

      // Phase execution
      if (phaseName === "phase-0-preparation") {
        pendingWorkspaceAnalysis = await analyzeWorkspace(rootDirectory);
        await persistArtifactAndEmit(runId, projectId, phaseName, "note", "Workspace Analysis", pendingWorkspaceAnalysis);
      } else if (phaseName === "phase-1-intent") {
        if (pendingWorkspaceAnalysis) {
          const ctxResult = await buildCodebaseContext(pendingWorkspaceAnalysis);
          pendingCodebaseContext = ctxResult.summary;
          pendingIntentSummary = ctxResult.intent;
          await persistArtifactAndEmit(runId, projectId, phaseName, "note", "Codebase Context", pendingCodebaseContext);
          await persistArtifactAndEmit(runId, projectId, phaseName, "note", "Intent Summary", pendingIntentSummary);
        }
      } else if (phaseName === "phase-2-architecture") {
        if (pendingWorkspaceAnalysis && pendingCodebaseContext && pendingIntentSummary) {
          pendingArchitectureSummary = await generateArchitectureSummary(
            {
              workspace: pendingWorkspaceAnalysis,
              codebase: pendingCodebaseContext,
              intent: pendingIntentSummary
            },
            activeProvider
          );
          await persistArtifactAndEmit(runId, projectId, phaseName, "diagram", "Architecture Summary", pendingArchitectureSummary);
          pendingProtocolDiagram = await generateProtocolDiagram(
            {
              workspace: pendingWorkspaceAnalysis,
              codebase: pendingCodebaseContext,
              intent: pendingIntentSummary,
              architecture: pendingArchitectureSummary
            },
            activeProvider
          );
          await persistArtifactAndEmit(runId, projectId, phaseName, "diagram", "Protocol Map", pendingProtocolDiagram);
        }
      } else if (phaseName === "phase-3-invariants") {
        if (pendingWorkspaceAnalysis && pendingCodebaseContext && pendingIntentSummary) {
          pendingInvariantRegistry = await generateInvariants(
            {
              workspace: pendingWorkspaceAnalysis,
              codebase: pendingCodebaseContext,
              intent: pendingIntentSummary,
              architecture: pendingArchitectureSummary
            },
            activeProvider
          );
          await persistArtifactAndEmit(runId, projectId, phaseName, "invariant", "Invariants Registry", pendingInvariantRegistry);
        }
      } else if (phaseName === "phase-4-code-reading") {
        if (pendingWorkspaceAnalysis && pendingCodebaseContext && pendingIntentSummary) {
          pendingVerificationPlan = await generateVerificationPlan(
            {
              workspace: pendingWorkspaceAnalysis,
              codebase: pendingCodebaseContext,
              intent: pendingIntentSummary,
              architecture: pendingArchitectureSummary,
              invariants: pendingInvariantRegistry
            },
            activeProvider
          );
          await persistArtifactAndEmit(runId, projectId, phaseName, "test", "Verification Plan", pendingVerificationPlan);
          pendingToolchainExecution = await runToolchainWorkflows(
            rootDirectory,
            { isFoundry: pendingWorkspaceAnalysis.isFoundry, isHardhat: pendingWorkspaceAnalysis.isHardhat },
            { runId, projectId }
          );
          await persistArtifactAndEmit(runId, projectId, phaseName, "test", "Toolchain Execution", pendingToolchainExecution);
        }
      } else if (phaseName === "phase-5-attack-simulation") {
        if (pendingWorkspaceAnalysis && pendingCodebaseContext && pendingIntentSummary) {
          pendingHypothesisRegistry = await generateHypotheses(
            {
              workspace: pendingWorkspaceAnalysis,
              codebase: pendingCodebaseContext,
              intent: pendingIntentSummary,
              architecture: pendingArchitectureSummary,
              invariants: pendingInvariantRegistry,
              verificationPlan: pendingVerificationPlan
            },
            activeProvider
          );
          await persistArtifactAndEmit(runId, projectId, phaseName, "hypothesis", "Hypothesis Registry", pendingHypothesisRegistry);
        }
      } else if (phaseName === "phase-6-economic-modeling") {
        if (pendingWorkspaceAnalysis && pendingCodebaseContext && pendingIntentSummary) {
          pendingEconomicAnalysis = await generateEconomicAnalysis(
            {
              workspace: pendingWorkspaceAnalysis,
              codebase: pendingCodebaseContext,
              intent: pendingIntentSummary,
              architecture: pendingArchitectureSummary,
              invariants: pendingInvariantRegistry,
              verificationPlan: pendingVerificationPlan,
              hypotheses: pendingHypothesisRegistry
            },
            activeProvider
          );
          await persistArtifactAndEmit(runId, projectId, phaseName, "finding", "Economic Analysis", pendingEconomicAnalysis);
        }
      } else if (phaseName === "phase-7-cross-contract-paths") {
        if (pendingWorkspaceAnalysis && pendingCodebaseContext && pendingIntentSummary) {
          pendingCrossContractAnalysis = await generateCrossContractAnalysis(
            {
              workspace: pendingWorkspaceAnalysis,
              codebase: pendingCodebaseContext,
              intent: pendingIntentSummary,
              architecture: pendingArchitectureSummary,
              invariants: pendingInvariantRegistry,
              verificationPlan: pendingVerificationPlan,
              hypotheses: pendingHypothesisRegistry,
              economicAnalysis: pendingEconomicAnalysis
            },
            activeProvider
          );
          await persistArtifactAndEmit(runId, projectId, phaseName, "diagram", "Cross-Contract Call Paths", pendingCrossContractAnalysis);
        }
      } else if (phaseName === "phase-8-finding-verification") {
        if (pendingWorkspaceAnalysis && pendingCodebaseContext && pendingIntentSummary) {
          pendingFindingRegistry = await generateFindingRegistry(
            {
              workspace: pendingWorkspaceAnalysis,
              codebase: pendingCodebaseContext,
              intent: pendingIntentSummary,
              architecture: pendingArchitectureSummary,
              invariants: pendingInvariantRegistry,
              verificationPlan: pendingVerificationPlan,
              hypotheses: pendingHypothesisRegistry,
              economicAnalysis: pendingEconomicAnalysis,
              crossContractAnalysis: pendingCrossContractAnalysis
            },
            activeProvider
          );
          await persistArtifactAndEmit(runId, projectId, phaseName, "finding", "Finding Registry", pendingFindingRegistry);
          const pocLimit = Math.max(0, Math.min(3, Number(process.env["SRP_POC_LIMIT"] ?? "1")));
          const findingsToProve = pendingFindingRegistry.findings.slice(0, pocLimit);
          const updatedFindings = [...pendingFindingRegistry.findings];
          for (let fi = 0; fi < findingsToProve.length; fi++) {
            const finding = findingsToProve[fi]!;
            const findingData: Record<string, unknown> = { ...finding };
            const proof = await runPoC(findingData, rootDirectory);
            updatedFindings[fi] = { ...finding, proof };
            await persistArtifactAndEmit(runId, projectId, phaseName, "test", `PoC ${finding.id}`, proof);
          }
          pendingFindingRegistry = {
            ...pendingFindingRegistry,
            findings: updatedFindings
          };
        }
      } else if (phaseName === "phase-10-remediation") {
        if (pendingWorkspaceAnalysis && pendingCodebaseContext && pendingIntentSummary) {
          pendingRemediationPlan = await generateRemediationPlan(
            {
              workspace: pendingWorkspaceAnalysis,
              codebase: pendingCodebaseContext,
              intent: pendingIntentSummary,
              architecture: pendingArchitectureSummary,
              invariants: pendingInvariantRegistry,
              verificationPlan: pendingVerificationPlan,
              hypotheses: pendingHypothesisRegistry,
              economicAnalysis: pendingEconomicAnalysis,
              crossContractAnalysis: pendingCrossContractAnalysis,
              findingRegistry: pendingFindingRegistry
            },
            activeProvider
          );
          await persistArtifactAndEmit(runId, projectId, phaseName, "note", "Remediation Plan", pendingRemediationPlan);
        }
      } else if (phaseName === "phase-9-reporting") {
        if (pendingWorkspaceAnalysis && pendingCodebaseContext && pendingIntentSummary) {
          pendingFormalReport = await generateFormalReport(
            {
              workspace: pendingWorkspaceAnalysis,
              codebase: pendingCodebaseContext,
              intent: pendingIntentSummary,
              architecture: pendingArchitectureSummary,
              invariants: pendingInvariantRegistry,
              verificationPlan: pendingVerificationPlan,
              hypotheses: pendingHypothesisRegistry,
              economicAnalysis: pendingEconomicAnalysis,
              crossContractAnalysis: pendingCrossContractAnalysis,
              findingRegistry: pendingFindingRegistry,
              remediationPlan: pendingRemediationPlan
            },
            activeProvider
          );
          await persistArtifactAndEmit(runId, projectId, phaseName, "report", "Formal Report", pendingFormalReport);
        }
      } else {
        await setTimeout(300, undefined, { signal });
      }

      // 2. Mark Completed
      updatePhaseStatus(i, "completed", projectId, runId);
    }
  } catch (err) {
    if (signal.aborted) {
      return;
    }
    console.error("Runtime execution failed:", err);
    if (currentPhaseIndex >= 0 && currentPhaseIndex < phaseStates.length) {
      updatePhaseStatus(currentPhaseIndex, "failed", projectId, runId);
    }
    if (persistence) {
      void persistence.updateRunStatus(runId, "failed");
    }
  } finally {
    isRunning = false;
    activeAbortController = null;
    activePipelineTask = null;
  }
}
