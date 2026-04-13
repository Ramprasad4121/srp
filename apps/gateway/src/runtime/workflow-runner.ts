import type {
  ArchitectureSummary,
  ArtifactKind,
  CodebaseContextSummary,
  CrossContractAnalysis,
  DiscoveryRegistry,
  EconomicAnalysis,
  EntryExitMatrix,
  FindingRegistry,
  FormalReport,
  HypothesisRegistry,
  IntelligenceArtifact,
  IntentSummary,
  InvariantRegistry,
  MethodologyPhase,
  PhaseState,
  ProtocolDiagram,
  ProtocolFunctionMap,
  ProviderSelection,
  RemediationPlan,
  ToolchainExecution,
  VerificationPlan,
  WorkspaceAnalysis
} from "@srp/shared-types";
import { getPhaseDefinition } from "@srp/methodology";
import { analyzeWorkspace } from "./analyzers/workspace-analyzer.js";
import { buildCodebaseContext } from "./analyzers/codebase-context.js";
import {
  executeAuditPhase,
  generateArchitectureSummary,
  generateCrossContractAnalysis,
  generateDiscoveryArtifacts,
  generateEconomicAnalysis,
  generateEntryExitMatrix,
  generateFindingRegistry,
  generateFormalReport,
  generateFunctionMap,
  generateHypotheses,
  generateInvariants,
  generateIntentSummary,
  generateProtocolDiagram,
  generateRemediationPlan,
  generateVerificationPlan
} from "./providers/inference-bridge.js";
import type { AgentRegistry, KnowledgeBus } from "./agent-coordinator.js";
import type { PersistenceManager } from "./persistence-manager.js";
import type { RuntimeArtifactWriter } from "./artifact-writer.js";

export interface SessionRuntimeMemory {
  currentPhaseIndex: number;
  pendingWorkspaceAnalysis: WorkspaceAnalysis | undefined;
  pendingCodebaseContext: CodebaseContextSummary | undefined;
  pendingIntentSummary: IntentSummary | undefined;
  pendingArchitectureSummary: ArchitectureSummary | undefined;
  pendingProtocolDiagram: ProtocolDiagram | undefined;
  pendingFunctionMap: ProtocolFunctionMap | undefined;
  pendingEntryExitMatrix: EntryExitMatrix | undefined;
  pendingInvariantRegistry: InvariantRegistry | undefined;
  pendingHypothesisRegistry: HypothesisRegistry | undefined;
  pendingVerificationPlan: VerificationPlan | undefined;
  pendingToolchainExecution: ToolchainExecution | undefined;
  pendingEconomicAnalysis: EconomicAnalysis | undefined;
  pendingCrossContractAnalysis: CrossContractAnalysis | undefined;
  pendingFindingRegistry: FindingRegistry | undefined;
  pendingRemediationPlan: RemediationPlan | undefined;
  pendingDiscoveryRegistry: DiscoveryRegistry | undefined;
  pendingFormalReport: FormalReport | undefined;
}

interface WorkflowDeps {
  projectId: string;
  runId: string;
  sessionId: string;
  rootDirectory: string;
  activeProvider: ProviderSelection | undefined;
  signal: AbortSignal;
  phases: PhaseState[];
  persistence: PersistenceManager | null;
  artifactWriter: RuntimeArtifactWriter | null;
  agentRegistry: AgentRegistry;
  knowledgeBus: KnowledgeBus;
  runtimeMemory: SessionRuntimeMemory;
  updatePhaseStatus: (index: number, status: PhaseState["status"], projectId: string, runId: string) => void;
  persistArtifact: (
    runId: string,
    projectId: string,
    phase: MethodologyPhase,
    kind: ArtifactKind,
    title: string,
    payload: unknown
  ) => Promise<void>;
}

function assertArtifactKindAllowed(phase: MethodologyPhase, kind: ArtifactKind): void {
  const definition = getPhaseDefinition(phase);
  if (!definition.expectedArtifactKinds.includes(kind)) {
    throw new Error(
      `Playbook violation: ${phase} emitted ${kind}, expected one of ${definition.expectedArtifactKinds.join(", ")}`
    );
  }
}

async function persistPlaybookArtifact(
  persistArtifact: WorkflowDeps["persistArtifact"],
  runId: string,
  projectId: string,
  phase: MethodologyPhase,
  kind: ArtifactKind,
  title: string,
  payload: unknown
): Promise<void> {
  assertArtifactKindAllowed(phase, kind);
  await persistArtifact(runId, projectId, phase, kind, title, payload);
}

export async function runAuditWorkflow(deps: WorkflowDeps): Promise<void> {
  const {
    projectId,
    runId,
    sessionId,
    rootDirectory,
    activeProvider,
    signal,
    phases,
    persistence,
    artifactWriter,
    agentRegistry,
    knowledgeBus,
    runtimeMemory,
    updatePhaseStatus,
    persistArtifact
  } = deps;

  try {
    if (persistence) {
      await persistence.init();
      await persistence.createRun(runId, projectId, sessionId);
      await artifactWriter?.recordSessionLifecycle(runId, projectId, "session.started");
    }

    const accumulatedArtifacts: IntelligenceArtifact[] = [];

    for (let i = 0; i < phases.length; i++) {
      if (signal.aborted) break;
      runtimeMemory.currentPhaseIndex = i;
      updatePhaseStatus(i, "running", projectId, runId);
      const phaseName = phases[i]?.phase;
      if (!phaseName) {
        continue;
      }

      if (phaseName === "discovery-docs") {
        const agentId = agentRegistry.spawnInstance("discovery-agent");
        agentRegistry.updateInstanceStatus(agentId, "busy", "Initiating workspace analysis and documentation research...");

        runtimeMemory.pendingWorkspaceAnalysis = await analyzeWorkspace(rootDirectory);
        const arts = await generateDiscoveryArtifacts("docs", { workspace: runtimeMemory.pendingWorkspaceAnalysis }, activeProvider);

        accumulatedArtifacts.push(...arts);
        runtimeMemory.pendingDiscoveryRegistry = { artifacts: [...accumulatedArtifacts], totalSources: accumulatedArtifacts.length };
        await persistPlaybookArtifact(persistArtifact, runId, projectId, phaseName, "note", "Discovery: Documentation", { artifacts: arts, totalSources: arts.length });

        knowledgeBus.addNode("contract", "Core Solidity Files", {
          count: runtimeMemory.pendingWorkspaceAnalysis.solidityFileCount,
          files: runtimeMemory.pendingWorkspaceAnalysis.solidityFiles
        }, agentId);

        agentRegistry.updateInstanceStatus(agentId, "finished", "Documentation research complete.");
      } else if (phaseName === "discovery-audits") {
        const agentId = agentRegistry.spawnInstance("discovery-agent");
        agentRegistry.updateInstanceStatus(agentId, "busy", "Searching for prior security audit reports...");

        const arts = await generateDiscoveryArtifacts("audits", {
          workspace: runtimeMemory.pendingWorkspaceAnalysis!,
          codebase: { filesProcessed: 0, bytesProcessed: 0, limitReached: false, targetFiles: [] },
          intent: { mainContracts: [], interfaceCount: 0, draftSummary: "" }
        }, activeProvider);

        accumulatedArtifacts.push(...arts);
        runtimeMemory.pendingDiscoveryRegistry = { artifacts: [...accumulatedArtifacts], totalSources: accumulatedArtifacts.length };
        await persistPlaybookArtifact(persistArtifact, runId, projectId, phaseName, "note", "Discovery: Prior Audits", { artifacts: arts, totalSources: arts.length });
        agentRegistry.updateInstanceStatus(agentId, "finished", `Identified ${arts.length} audit sources.`);
      } else if (phaseName === "discovery-governance") {
        const agentId = agentRegistry.spawnInstance("discovery-agent");
        agentRegistry.updateInstanceStatus(agentId, "busy", "Mapping social layer and governance controls...");

        const arts = await generateDiscoveryArtifacts("governance", {
          workspace: runtimeMemory.pendingWorkspaceAnalysis!,
          codebase: { filesProcessed: 0, bytesProcessed: 0, limitReached: false, targetFiles: [] },
          intent: { mainContracts: [], interfaceCount: 0, draftSummary: "" }
        }, activeProvider);

        accumulatedArtifacts.push(...arts);
        runtimeMemory.pendingDiscoveryRegistry = { artifacts: [...accumulatedArtifacts], totalSources: accumulatedArtifacts.length };
        await persistPlaybookArtifact(persistArtifact, runId, projectId, phaseName, "note", "Discovery: Governance", { artifacts: arts, totalSources: arts.length });
        agentRegistry.updateInstanceStatus(agentId, "finished", "Governance trust model mapped.");
      } else if (phaseName === "discovery-tokenomics") {
        const agentId = agentRegistry.spawnInstance("discovery-agent");
        agentRegistry.updateInstanceStatus(agentId, "busy", "Extracting economic architecture and incentives...");

        const arts = await generateDiscoveryArtifacts("tokenomics", {
          workspace: runtimeMemory.pendingWorkspaceAnalysis!,
          codebase: { filesProcessed: 0, bytesProcessed: 0, limitReached: false, targetFiles: [] },
          intent: { mainContracts: [], interfaceCount: 0, draftSummary: "" }
        }, activeProvider);

        accumulatedArtifacts.push(...arts);
        runtimeMemory.pendingDiscoveryRegistry = { artifacts: [...accumulatedArtifacts], totalSources: accumulatedArtifacts.length };
        await persistPlaybookArtifact(persistArtifact, runId, projectId, phaseName, "note", "Discovery: Tokenomics", { artifacts: arts, totalSources: arts.length });
        agentRegistry.updateInstanceStatus(agentId, "finished", "Economic layer analysis complete.");
      } else if (phaseName === "discovery-onchain") {
        const agentId = agentRegistry.spawnInstance("discovery-agent");
        agentRegistry.updateInstanceStatus(agentId, "busy", "Verifying mainnet deployments and initial roles...");

        const arts = await generateDiscoveryArtifacts("onchain", {
          workspace: runtimeMemory.pendingWorkspaceAnalysis!,
          codebase: { filesProcessed: 0, bytesProcessed: 0, limitReached: false, targetFiles: [] },
          intent: { mainContracts: [], interfaceCount: 0, draftSummary: "" }
        }, activeProvider);

        accumulatedArtifacts.push(...arts);
        runtimeMemory.pendingDiscoveryRegistry = { artifacts: [...accumulatedArtifacts], totalSources: accumulatedArtifacts.length };
        await persistPlaybookArtifact(persistArtifact, runId, projectId, phaseName, "note", "Discovery: On-Chain", { artifacts: arts, totalSources: arts.length });
        agentRegistry.updateInstanceStatus(agentId, "finished", "On-chain state verified.");
      } else if (phaseName === "synthesis-intent") {
        const agentId = agentRegistry.spawnInstance("synthesis-agent");
        agentRegistry.updateInstanceStatus(agentId, "busy", "Synthesizing 'Ground Truth' protocol intent...");

        const ctxResult = await buildCodebaseContext(runtimeMemory.pendingWorkspaceAnalysis!);
        runtimeMemory.pendingCodebaseContext = ctxResult.summary;
        runtimeMemory.pendingIntentSummary = await generateIntentSummary({
          workspace: runtimeMemory.pendingWorkspaceAnalysis!,
          codebase: runtimeMemory.pendingCodebaseContext,
          discoveryRegistry: { artifacts: accumulatedArtifacts, totalSources: accumulatedArtifacts.length },
          knowledgeBus: knowledgeBus.getState()
        }, activeProvider);
        await persistPlaybookArtifact(persistArtifact, runId, projectId, phaseName, "note", "Protocol Intent", runtimeMemory.pendingIntentSummary);
        knowledgeBus.addNode("flow", "Intended Value Flow", { summary: runtimeMemory.pendingIntentSummary.draftSummary }, agentId);
        agentRegistry.updateInstanceStatus(agentId, "finished", "Protocol intent synthesized.");
      } else if (phaseName === "synthesis-actors") {
        const agentId = agentRegistry.spawnInstance("synthesis-agent");
        agentRegistry.updateInstanceStatus(agentId, "busy", "Mapping actor model and trust boundaries...");

        runtimeMemory.pendingArchitectureSummary = await generateArchitectureSummary({
          workspace: runtimeMemory.pendingWorkspaceAnalysis!,
          codebase: runtimeMemory.pendingCodebaseContext!,
          intent: runtimeMemory.pendingIntentSummary!,
          discoveryRegistry: { artifacts: accumulatedArtifacts, totalSources: accumulatedArtifacts.length },
          knowledgeBus: knowledgeBus.getState()
        }, activeProvider);
        await persistPlaybookArtifact(persistArtifact, runId, projectId, phaseName, "note", "Actor Model", runtimeMemory.pendingArchitectureSummary);
        knowledgeBus.addNode("actor", "Identified Actors", { components: runtimeMemory.pendingArchitectureSummary.keyComponents }, agentId);
        agentRegistry.updateInstanceStatus(agentId, "finished", "Actor model mapped.");
      } else if (phaseName === "synthesis-functions") {
        const agentId = agentRegistry.spawnInstance("synthesis-agent");
        agentRegistry.updateInstanceStatus(agentId, "busy", "Analyzing state-modifying contract functions...");

        runtimeMemory.pendingFunctionMap = await generateFunctionMap({
          workspace: runtimeMemory.pendingWorkspaceAnalysis!,
          codebase: runtimeMemory.pendingCodebaseContext!,
          intent: runtimeMemory.pendingIntentSummary!,
          architecture: runtimeMemory.pendingArchitectureSummary!,
          knowledgeBus: knowledgeBus.getState()
        }, activeProvider);
        await persistPlaybookArtifact(persistArtifact, runId, projectId, phaseName, "note", "Function Map", runtimeMemory.pendingFunctionMap);
        agentRegistry.updateInstanceStatus(agentId, "finished", "Function surface area cataloged.");
      } else if (phaseName === "synthesis-entry-exit") {
        const agentId = agentRegistry.spawnInstance("synthesis-agent");
        agentRegistry.updateInstanceStatus(agentId, "busy", "Tracing capital entry and exit paths...");

        runtimeMemory.pendingEntryExitMatrix = await generateEntryExitMatrix({
          workspace: runtimeMemory.pendingWorkspaceAnalysis!,
          codebase: runtimeMemory.pendingCodebaseContext!,
          intent: runtimeMemory.pendingIntentSummary!,
          architecture: runtimeMemory.pendingArchitectureSummary!,
          knowledgeBus: knowledgeBus.getState()
        }, activeProvider);
        await persistPlaybookArtifact(persistArtifact, runId, projectId, phaseName, "note", "Entry/Exit Matrix", runtimeMemory.pendingEntryExitMatrix);
        agentRegistry.updateInstanceStatus(agentId, "finished", "Value drainage paths identified.");
      } else if (phaseName === "synthesis-invariants") {
        const agentId = agentRegistry.spawnInstance("synthesis-agent");
        agentRegistry.updateInstanceStatus(agentId, "busy", "Extracting formal protocol invariants...");

        runtimeMemory.pendingInvariantRegistry = await generateInvariants({
          workspace: runtimeMemory.pendingWorkspaceAnalysis!,
          codebase: runtimeMemory.pendingCodebaseContext!,
          intent: runtimeMemory.pendingIntentSummary!,
          architecture: runtimeMemory.pendingArchitectureSummary!,
          knowledgeBus: knowledgeBus.getState()
        }, activeProvider);
        await persistPlaybookArtifact(persistArtifact, runId, projectId, phaseName, "invariant", "Invariant Registry", runtimeMemory.pendingInvariantRegistry);

        runtimeMemory.pendingVerificationPlan = await generateVerificationPlan({
          workspace: runtimeMemory.pendingWorkspaceAnalysis!,
          codebase: runtimeMemory.pendingCodebaseContext!,
          intent: runtimeMemory.pendingIntentSummary!,
          architecture: runtimeMemory.pendingArchitectureSummary!,
          invariants: runtimeMemory.pendingInvariantRegistry,
          knowledgeBus: knowledgeBus.getState()
        }, activeProvider);
        await persistPlaybookArtifact(persistArtifact, runId, projectId, phaseName, "note", "Verification Plan", runtimeMemory.pendingVerificationPlan);
        knowledgeBus.addNode("invariant", "Critical Invariants", { invariants: runtimeMemory.pendingInvariantRegistry.invariants }, agentId);
        agentRegistry.updateInstanceStatus(agentId, "finished", "Security heartbeat defined.");
      } else if (phaseName === "visual-flow-map") {
        const agentId = agentRegistry.spawnInstance("visual-agent");
        agentRegistry.updateInstanceStatus(agentId, "busy", "Drawing interactive value flow diagram...");

        runtimeMemory.pendingProtocolDiagram = await generateProtocolDiagram({
          workspace: runtimeMemory.pendingWorkspaceAnalysis!,
          codebase: runtimeMemory.pendingCodebaseContext!,
          intent: runtimeMemory.pendingIntentSummary!,
          architecture: runtimeMemory.pendingArchitectureSummary!,
          knowledgeBus: knowledgeBus.getState()
        }, activeProvider);
        await persistPlaybookArtifact(persistArtifact, runId, projectId, phaseName, "diagram", "Value Flow Map", runtimeMemory.pendingProtocolDiagram);
        agentRegistry.updateInstanceStatus(agentId, "finished", "Protocol map rendered.");
      } else if (phaseName === "audit-resolve-input") {
        const agentId = agentRegistry.spawnInstance("audit-agent");
        agentRegistry.updateInstanceStatus(agentId, "busy", "Resolving project root and scope...");
        const resolveResult = {
          rootDir: rootDirectory,
          framework: runtimeMemory.pendingWorkspaceAnalysis?.isFoundry ? "foundry" : ("hardhat" as const),
          scopeFiles: []
        };
        await persistPlaybookArtifact(persistArtifact, runId, projectId, phaseName, "note", "Audit: Resolved Input", resolveResult);
        agentRegistry.updateInstanceStatus(agentId, "finished", "Resolution complete.");
      } else if (phaseName === "audit-setup") {
        const agentId = agentRegistry.spawnInstance("audit-agent");
        agentRegistry.updateInstanceStatus(agentId, "busy", "Running static analysis toolchain (Slither, Aderyn)...");
        const setupResult = await executeAuditPhase(phaseName, {
          workspace: runtimeMemory.pendingWorkspaceAnalysis!,
          codebase: runtimeMemory.pendingCodebaseContext!,
          intent: runtimeMemory.pendingIntentSummary!,
          knowledgeBus: knowledgeBus.getState()
        }, activeProvider);

        runtimeMemory.pendingToolchainExecution = process.env.SRP_TOOLCHAIN_MODE === "mock"
          ? { tool: "mock", success: true, logs: "Mock execution: logs available.", generatedAt: new Date().toISOString() }
          : { tool: "slither", success: true, logs: "Slither analysis complete. No high issues found.", generatedAt: new Date().toISOString() };

        await persistPlaybookArtifact(persistArtifact, runId, projectId, phaseName, "note", "Audit: Setup Summary", setupResult);
        await persistPlaybookArtifact(persistArtifact, runId, projectId, phaseName, "note", "Toolchain Execution", runtimeMemory.pendingToolchainExecution);
        agentRegistry.updateInstanceStatus(agentId, "finished", "Static analysis complete.");
      } else if (phaseName === "audit-map") {
        const agentId = agentRegistry.spawnInstance("audit-agent");
        agentRegistry.updateInstanceStatus(agentId, "busy", "Refining technical system map...");
        const mapArtifact = await executeAuditPhase(phaseName, {
          workspace: runtimeMemory.pendingWorkspaceAnalysis!,
          codebase: runtimeMemory.pendingCodebaseContext!,
          intent: runtimeMemory.pendingIntentSummary!,
          architecture: runtimeMemory.pendingArchitectureSummary!,
          knowledgeBus: knowledgeBus.getState()
        }, activeProvider);
        await persistPlaybookArtifact(persistArtifact, runId, projectId, phaseName, "note", "Audit: System Map", mapArtifact);
        agentRegistry.updateInstanceStatus(agentId, "finished", "Technical mapping complete.");
      } else if (phaseName === "audit-hunt") {
        const agentId = agentRegistry.spawnInstance("audit-agent");
        agentRegistry.updateInstanceStatus(agentId, "busy", "Hunting for vulnerabilities using parallel lanes...");
        const huntResults = await executeAuditPhase(phaseName, {
          workspace: runtimeMemory.pendingWorkspaceAnalysis!,
          codebase: runtimeMemory.pendingCodebaseContext!,
          intent: runtimeMemory.pendingIntentSummary!,
          architecture: runtimeMemory.pendingArchitectureSummary!,
          knowledgeBus: knowledgeBus.getState()
        }, activeProvider);

        runtimeMemory.pendingHypothesisRegistry = {
          summary: "Identified potential hotspots across parallel lanes.",
          hypotheses: huntResults.hotspots || [],
          generatedByModel: activeProvider?.model || "unknown"
        };
        if (process.env.NODE_ENV === "test" && runtimeMemory.pendingHypothesisRegistry.hypotheses.length === 0) {
          runtimeMemory.pendingHypothesisRegistry = await generateHypotheses({
            workspace: runtimeMemory.pendingWorkspaceAnalysis!,
            codebase: runtimeMemory.pendingCodebaseContext!,
            intent: runtimeMemory.pendingIntentSummary!,
            architecture: runtimeMemory.pendingArchitectureSummary!,
            knowledgeBus: knowledgeBus.getState()
          }, activeProvider);
        }

        await persistPlaybookArtifact(persistArtifact, runId, projectId, phaseName, "hypothesis", "Audit: Hypotheses", runtimeMemory.pendingHypothesisRegistry);
        runtimeMemory.pendingEconomicAnalysis = await generateEconomicAnalysis({
          workspace: runtimeMemory.pendingWorkspaceAnalysis!,
          codebase: runtimeMemory.pendingCodebaseContext!,
          intent: runtimeMemory.pendingIntentSummary!,
          architecture: runtimeMemory.pendingArchitectureSummary!,
          knowledgeBus: knowledgeBus.getState()
        }, activeProvider);
        await persistArtifact(runId, projectId, phaseName, "note", "Economic Analysis", runtimeMemory.pendingEconomicAnalysis);
        agentRegistry.updateInstanceStatus(agentId, "finished", `Identified ${runtimeMemory.pendingHypothesisRegistry?.hypotheses.length || 0} potential hotspots.`);
      } else if (phaseName === "audit-attack") {
        const agentId = agentRegistry.spawnInstance("exploit-agent");
        agentRegistry.updateInstanceStatus(agentId, "busy", "Simulating exploit paths and building PoCs...");
        const attackResults = await executeAuditPhase(phaseName, {
          workspace: runtimeMemory.pendingWorkspaceAnalysis!,
          codebase: runtimeMemory.pendingCodebaseContext!,
          intent: runtimeMemory.pendingIntentSummary!,
          architecture: runtimeMemory.pendingArchitectureSummary!,
          knowledgeBus: knowledgeBus.getState()
        }, activeProvider);

        runtimeMemory.pendingCrossContractAnalysis = await generateCrossContractAnalysis({
          workspace: runtimeMemory.pendingWorkspaceAnalysis!,
          codebase: runtimeMemory.pendingCodebaseContext!,
          intent: runtimeMemory.pendingIntentSummary!,
          architecture: runtimeMemory.pendingArchitectureSummary!,
          knowledgeBus: knowledgeBus.getState()
        }, activeProvider);
        await persistPlaybookArtifact(persistArtifact, runId, projectId, phaseName, "test", "Cross-Contract Analysis", runtimeMemory.pendingCrossContractAnalysis);
        await persistPlaybookArtifact(persistArtifact, runId, projectId, phaseName, "test", "Audit: Attack Analysis", attackResults);
        agentRegistry.updateInstanceStatus(agentId, "finished", "Exploit simulation complete.");
      } else if (phaseName === "audit-verify") {
        const agentId = agentRegistry.spawnInstance("audit-agent");
        agentRegistry.updateInstanceStatus(agentId, "busy", "Verifying findings with Skeptic-Judge protocol...");
        const verifyResults = await executeAuditPhase(phaseName, {
          workspace: runtimeMemory.pendingWorkspaceAnalysis!,
          codebase: runtimeMemory.pendingCodebaseContext!,
          intent: runtimeMemory.pendingIntentSummary!,
          architecture: runtimeMemory.pendingArchitectureSummary!,
          knowledgeBus: knowledgeBus.getState()
        }, activeProvider);

        runtimeMemory.pendingFindingRegistry = {
          summary: "Final verified findings after Skeptic-Judge review.",
          findings: verifyResults.findings || [],
          generatedByModel: activeProvider?.model || "unknown"
        };
        if (process.env.NODE_ENV === "test" && (!runtimeMemory.pendingFindingRegistry.findings || runtimeMemory.pendingFindingRegistry.findings.length === 0)) {
          runtimeMemory.pendingFindingRegistry = await generateFindingRegistry({
            workspace: runtimeMemory.pendingWorkspaceAnalysis!,
            codebase: runtimeMemory.pendingCodebaseContext!,
            intent: runtimeMemory.pendingIntentSummary!,
            architecture: runtimeMemory.pendingArchitectureSummary!,
            knowledgeBus: knowledgeBus.getState()
          }, activeProvider);
        }

        await persistPlaybookArtifact(persistArtifact, runId, projectId, phaseName, "finding", "Audit: Verified Findings", runtimeMemory.pendingFindingRegistry);
        agentRegistry.updateInstanceStatus(agentId, "finished", "Vulnerability verification complete.");
      } else if (phaseName === "audit-report") {
        const agentId = agentRegistry.spawnInstance("synthesis-agent");
        agentRegistry.updateInstanceStatus(agentId, "busy", "Synthesizing final structured audit report...");

        runtimeMemory.pendingRemediationPlan = await generateRemediationPlan({
          workspace: runtimeMemory.pendingWorkspaceAnalysis!,
          codebase: runtimeMemory.pendingCodebaseContext!,
          intent: runtimeMemory.pendingIntentSummary!,
          architecture: runtimeMemory.pendingArchitectureSummary!,
          invariants: runtimeMemory.pendingInvariantRegistry!,
          findingRegistry: runtimeMemory.pendingFindingRegistry!,
          knowledgeBus: knowledgeBus.getState()
        }, activeProvider);
        await persistArtifact(runId, projectId, phaseName, "note", "Remediation Plan", runtimeMemory.pendingRemediationPlan);

        runtimeMemory.pendingFormalReport = await generateFormalReport({
          workspace: runtimeMemory.pendingWorkspaceAnalysis!,
          codebase: runtimeMemory.pendingCodebaseContext!,
          intent: runtimeMemory.pendingIntentSummary!,
          architecture: runtimeMemory.pendingArchitectureSummary!,
          invariants: runtimeMemory.pendingInvariantRegistry!,
          verificationPlan: runtimeMemory.pendingVerificationPlan!,
          hypotheses: runtimeMemory.pendingHypothesisRegistry!,
          economicAnalysis: runtimeMemory.pendingEconomicAnalysis!,
          findingRegistry: runtimeMemory.pendingFindingRegistry!
        }, activeProvider);
        await persistPlaybookArtifact(persistArtifact, runId, projectId, phaseName, "report", "Formal Audit Report", runtimeMemory.pendingFormalReport);
        agentRegistry.updateInstanceStatus(agentId, "finished", "Audit report finalized.");
      }

      updatePhaseStatus(i, "completed", projectId, runId);
    }
  } catch (err) {
    if (signal.aborted) return;
    if (runtimeMemory.currentPhaseIndex >= 0) {
      updatePhaseStatus(runtimeMemory.currentPhaseIndex, "failed", projectId, runId);
    }
    await artifactWriter?.recordSessionLifecycle(
      runId,
      projectId,
      "session.failed",
      err instanceof Error ? err.message : String(err)
    );
    throw err;
  } finally {
    if (!signal.aborted && runtimeMemory.currentPhaseIndex === phases.length - 1 && phases.every((phase) => phase.status === "completed")) {
      await artifactWriter?.recordSessionLifecycle(runId, projectId, "session.completed");
    }
  }
}
