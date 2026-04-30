import type {
  ArtifactMetadata,
  PhaseState,
  SessionStatus
} from "@srp/shared-types";
import { PersistenceManager } from "./persistence-manager.js";
import { AgentRegistry, KnowledgeBus } from "./agent-coordinator.js";
import { AuditRoomProjector } from "./room-projection.js";
import { RuntimeArtifactWriter } from "./artifact-writer.js";
import type { SessionRuntimeMemory } from "./workflow-runner.js";

/**
 * Per-project runtime state. Everything that used to live as module-level
 * `let` bindings in session-manager.ts now lives inside one of these,
 * keyed by `projectId` in the RuntimeRegistry below.
 *
 * Each project gets its own KnowledgeBus, AgentRegistry, and
 * AuditRoomProjector so concurrent work on different projects cannot
 * cross-contaminate state.
 */
export interface RuntimeEntry {
  readonly projectId: string;

  activeSessionId: string | null;
  activeRunId: string | null;
  isRunning: boolean;
  phaseStates: PhaseState[];
  activeAbortController: AbortController | null;
  activePipelineTask: Promise<void> | null;
  liveRunCreatedAt: string | null;

  persistence: PersistenceManager | null;
  artifactWriter: RuntimeArtifactWriter | null;
  liveArtifacts: ArtifactMetadata[];
  liveRunStatus: SessionStatus;
  liveFailureDetail: string | undefined;

  runtimeMemory: SessionRuntimeMemory;

  knowledgeBus: KnowledgeBus;
  agentRegistry: AgentRegistry;
  auditRoomProjector: AuditRoomProjector;
}

function createEmptyRuntimeMemory(): SessionRuntimeMemory {
  return {
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
}

export function createRuntimeEntry(projectId: string): RuntimeEntry {
  return {
    projectId,
    activeSessionId: null,
    activeRunId: null,
    isRunning: false,
    phaseStates: [],
    activeAbortController: null,
    activePipelineTask: null,
    liveRunCreatedAt: null,
    persistence: null,
    artifactWriter: null,
    liveArtifacts: [],
    liveRunStatus: "idle",
    liveFailureDetail: undefined,
    runtimeMemory: createEmptyRuntimeMemory(),
    knowledgeBus: new KnowledgeBus(),
    agentRegistry: new AgentRegistry(),
    auditRoomProjector: new AuditRoomProjector()
  };
}

export function resetRuntimeMemory(entry: RuntimeEntry): void {
  const m = entry.runtimeMemory;
  m.currentPhaseIndex = -1;
  m.pendingDiscoveryRegistry = undefined;
  m.pendingWorkspaceAnalysis = undefined;
  m.pendingCodebaseContext = undefined;
  m.pendingIntentSummary = undefined;
  m.pendingArchitectureSummary = undefined;
  m.pendingProtocolDiagram = undefined;
  m.pendingFunctionMap = undefined;
  m.pendingEntryExitMatrix = undefined;
  m.pendingInvariantRegistry = undefined;
  m.pendingHypothesisRegistry = undefined;
  m.pendingVerificationPlan = undefined;
  m.pendingToolchainExecution = undefined;
  m.pendingEconomicAnalysis = undefined;
  m.pendingCrossContractAnalysis = undefined;
  m.pendingFindingRegistry = undefined;
  m.pendingRemediationPlan = undefined;
  m.pendingFormalReport = undefined;
}

/**
 * Project-keyed runtime registry. Replaces the module-level singleton
 * state that used to live in session-manager.ts.
 *
 * The registry also tracks a `selectedProjectId` so the legacy
 * zero-argument facade calls (`getSessionState()`, `getPersistence()`,
 * `stopSession()`) can keep working while T007 wires per-request
 * `projectId` through the gateway handlers.
 */
export class RuntimeRegistry {
  private readonly entries = new Map<string, RuntimeEntry>();
  private selectedProjectId: string | null = null;

  /**
   * Get an existing entry, creating an empty one if none exists yet.
   * Also marks the project as the currently selected one so subsequent
   * facade calls without a `projectId` argument resolve to it.
   */
  getOrCreate(projectId: string): RuntimeEntry {
    if (!projectId || projectId.trim().length === 0) {
      throw new Error("RuntimeRegistry: projectId must be a non-empty string.");
    }
    let entry = this.entries.get(projectId);
    if (!entry) {
      entry = createRuntimeEntry(projectId);
      this.entries.set(projectId, entry);
    }
    this.selectedProjectId = projectId;
    return entry;
  }

  /** Get an existing entry or null. Does not change the selected id. */
  peek(projectId: string): RuntimeEntry | null {
    return this.entries.get(projectId) ?? null;
  }

  /**
   * Resolve which entry zero-arg calls should use:
   *   - explicit `projectId` if provided
   *   - the currently selected project otherwise
   *   - null if neither applies (fresh server, no session ever started)
   */
  resolve(projectId?: string): RuntimeEntry | null {
    if (projectId) {
      return this.entries.get(projectId) ?? null;
    }
    if (this.selectedProjectId) {
      return this.entries.get(this.selectedProjectId) ?? null;
    }
    return null;
  }

  /** Mark a project as selected without touching its state. */
  select(projectId: string): void {
    this.selectedProjectId = projectId;
  }

  /** Currently selected project id, if any. */
  getSelectedProjectId(): string | null {
    return this.selectedProjectId;
  }

  /** Test/teardown hook — wipe everything. */
  clear(): void {
    this.entries.clear();
    this.selectedProjectId = null;
  }

  /** All known project ids (in insertion order). */
  listProjectIds(): readonly string[] {
    return Array.from(this.entries.keys());
  }
}

/**
 * Process-wide singleton registry. The registry itself replaces the old
 * scattered module-level `let` bindings — it is *one* container, not
 * many flags — so this remains a single source of truth without
 * conflating projects.
 */
export const runtimeRegistry = new RuntimeRegistry();
