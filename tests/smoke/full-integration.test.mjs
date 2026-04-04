import test from "node:test";
import assert from "node:assert/strict";

// This test verifies that all packages can be imported together
// and their types are compatible — proving no circular dependencies
// or type mismatches in the entire monorepo.

import { SessionStore, createSessionRecord } from "../../packages/sessions/dist/index.js";
import { NoteStore, QuestionLog, MemoryStore, createArtifactRecord } from "../../packages/artifacts/dist/index.js";
import { TypedEventBus, createSessionStartedEvent, createSessionCompletedEvent, createFindingRegisteredEvent, createNoteCreatedEvent } from "../../packages/events/dist/index.js";
import { METHODOLOGY_PHASES, getPhaseDefinition, createInitialPhaseRecords, markPhaseRunning, markPhaseCompleted, computeRunProgress } from "../../packages/methodology/dist/index.js";
import { AgentRegistry, PhaseOrchestrator } from "../../packages/agents/dist/index.js";
import { compileDiagram, exportToExcalidrawJson } from "../../packages/diagram-engine/dist/index.js";
import { compileReport, findingSeverityCounts } from "../../packages/report-engine/dist/index.js";
import { createEmptyGraph, addNode, addEdge, topologicalSort } from "../../packages/project-graph/dist/index.js";
import { TOOLCHAIN_REGISTRY, getToolchainDefinition, toToolchainExecution } from "../../packages/tools/dist/index.js";
import { resolveModelRoute, ModelRequestLogger, createDefaultProviderSelection } from "../../packages/providers/dist/index.js";
import { asSessionId, asRunId, asEventId, asConversationId } from "../../packages/ids/dist/index.js";

// --------------------------------------------------------------------------
// Full integration: Simulated audit pipeline with all packages
// --------------------------------------------------------------------------

test("full integration: entire audit pipeline runs with all packages", async () => {
  // 1. Create a session
  const sessionStore = new SessionStore();
  const sessionId = asSessionId("sess_int_001");
  const runId = asRunId("run_int_001");
  const projectId = "proj_int_001";

  const session = sessionStore.create({
    sessionId,
    runId,
    projectId,
    status: "running",
    currentPhase: "phase-0-preparation"
  });
  assert.equal(session.status, "running");

  // 2. Initialize event bus and track events
  const eventBus = new TypedEventBus();
  const eventLog = [];
  eventBus.on("*", (event) => eventLog.push(event.type));

  eventBus.emit(createSessionStartedEvent({ runId, projectId, sessionId }));
  assert.equal(eventLog.length, 1);

  // 3. Initialize data stores
  const noteStore = new NoteStore();
  const questionLog = new QuestionLog();
  const memoryStore = new MemoryStore();

  // 4. Run through methodology phases
  let phaseRecords = createInitialPhaseRecords();

  // Phase 0: Preparation
  phaseRecords = markPhaseRunning(phaseRecords, "phase-0-preparation");
  sessionStore.transition(sessionId, "running", "phase-0-preparation");

  noteStore.add({
    phase: "phase-0-preparation",
    category: "observation",
    title: "Workspace analyzed",
    content: "Found 15 Solidity files in a Foundry project.",
    relatedIds: []
  });

  phaseRecords = markPhaseCompleted(phaseRecords, "phase-0-preparation", 1);

  // Phase 2: Architecture
  phaseRecords = markPhaseRunning(phaseRecords, "phase-1-intent");
  phaseRecords = markPhaseCompleted(phaseRecords, "phase-1-intent", 1);
  phaseRecords = markPhaseRunning(phaseRecords, "phase-2-architecture");
  sessionStore.transition(sessionId, "running", "phase-2-architecture");

  // Build project graph
  let graph = createEmptyGraph();
  graph = addNode(graph, { id: "vault", name: "Vault", filePath: "src/Vault.sol", kind: "contract", inheritsFrom: ["ERC20"], imports: ["IERC20"] });
  graph = addNode(graph, { id: "oracle", name: "Oracle", filePath: "src/Oracle.sol", kind: "contract", inheritsFrom: [], imports: [] });
  graph = addNode(graph, { id: "ierc20", name: "IERC20", filePath: "lib/IERC20.sol", kind: "interface", inheritsFrom: [], imports: [] });
  graph = addEdge(graph, { fromId: "vault", toId: "ierc20", relationship: "imports" });
  graph = addEdge(graph, { fromId: "vault", toId: "oracle", relationship: "calls" });

  const sorted = topologicalSort(graph);
  assert.equal(sorted.length, 3);

  // Generate protocol diagram
  const diagram = compileDiagram({
    family: "protocol-map",
    title: "Audit Target Protocol Map",
    nodes: graph.nodes.map((n) => ({ id: n.id, label: n.name })),
    edges: graph.edges.map((e) => ({ fromId: e.fromId, toId: e.toId, label: e.relationship }))
  });
  assert.equal(diagram.type, "excalidraw");
  assert.ok(diagram.elements.length > 0);

  const excalidrawJson = exportToExcalidrawJson(diagram);
  const parsedScene = JSON.parse(excalidrawJson);
  assert.equal(parsedScene.type, "excalidraw");

  phaseRecords = markPhaseCompleted(phaseRecords, "phase-2-architecture", 2);

  // Phase 3: Invariants  
  phaseRecords = markPhaseRunning(phaseRecords, "phase-3-invariants");
  questionLog.ask({
    question: "What is the access control model for Vault.emergencyWithdraw?",
    phase: "phase-3-invariants",
    relatedIds: ["vault"]
  });
  phaseRecords = markPhaseCompleted(phaseRecords, "phase-3-invariants", 2);

  // Phase 5: Attack simulation
  phaseRecords = markPhaseRunning(phaseRecords, "phase-4-code-reading");
  phaseRecords = markPhaseCompleted(phaseRecords, "phase-4-code-reading", 1);
  phaseRecords = markPhaseRunning(phaseRecords, "phase-5-attack-simulation");

  memoryStore.extract({
    kind: "vulnerability-class",
    title: "Flash loan price manipulation",
    summary: "Oracle uses spot price without TWAP protection.",
    sourceArtifactIds: ["art_oracle"],
    sourcePhase: "phase-5-attack-simulation",
    confidence: 0.92
  });

  phaseRecords = markPhaseCompleted(phaseRecords, "phase-5-attack-simulation", 1);

  // Phases 6-8
  for (const phase of ["phase-6-economic-modeling", "phase-7-cross-contract-paths", "phase-8-finding-verification"]) {
    phaseRecords = markPhaseRunning(phaseRecords, phase);
    phaseRecords = markPhaseCompleted(phaseRecords, phase, 1);
  }

  // Phase 9: Report generation
  phaseRecords = markPhaseRunning(phaseRecords, "phase-9-reporting");

  const report = compileReport({
    workspace: {
      rootDirectory: "/test/project",
      isFoundry: true,
      isHardhat: false,
      solidityFileCount: 15,
      solidityFiles: [],
      topLevelDirectories: [],
      summary: "Foundry project"
    },
    intent: {
      mainContracts: ["Vault", "Oracle"],
      interfaceCount: 5,
      draftSummary: "DeFi lending protocol"
    },
    findingRegistry: {
      summary: "3 findings",
      findings: [
        { id: "F-001", title: "Oracle Manipulation", description: "Flash loan price manipulation possible.", severity: "Critical", status: "Confirmed", targetComponent: "Oracle", impactedInvariantIds: ["INV-001"] },
        { id: "F-002", title: "Missing Access Control", description: "emergencyWithdraw has no modifier.", severity: "High", status: "Confirmed", targetComponent: "Vault", impactedInvariantIds: ["INV-002"] },
        { id: "F-003", title: "Missing Events", description: "No events emitted on transfers.", severity: "Informational", status: "Confirmed", targetComponent: "Vault", impactedInvariantIds: [] }
      ],
      generatedByModel: "integration-test"
    }
  });

  assert.match(report.markdownContent, /Executive Summary/);
  assert.match(report.markdownContent, /Oracle Manipulation/);

  const severities = findingSeverityCounts({
    summary: "",
    findings: [
      { id: "F-001", title: "", description: "", severity: "Critical", status: "Confirmed", targetComponent: "", impactedInvariantIds: [] },
      { id: "F-002", title: "", description: "", severity: "High", status: "Confirmed", targetComponent: "", impactedInvariantIds: [] },
      { id: "F-003", title: "", description: "", severity: "Informational", status: "Confirmed", targetComponent: "", impactedInvariantIds: [] }
    ],
    generatedByModel: ""
  });
  assert.equal(severities["Critical"], 1);
  assert.equal(severities["High"], 1);

  eventBus.emit(createFindingRegisteredEvent({
    runId, projectId,
    findingId: "F-001", severity: "Critical", title: "Oracle Manipulation"
  }));

  phaseRecords = markPhaseCompleted(phaseRecords, "phase-9-reporting", 1);

  // Phase 10: Remediation
  phaseRecords = markPhaseRunning(phaseRecords, "phase-10-remediation");
  phaseRecords = markPhaseCompleted(phaseRecords, "phase-10-remediation", 1);

  // 5. Final assertions
  const progress = computeRunProgress(phaseRecords);
  assert.equal(progress, 1.0);

  sessionStore.transition(sessionId, "completed");
  const finalSession = sessionStore.get(sessionId);
  assert.equal(finalSession?.status, "completed");

  const transitions = sessionStore.getHistory(sessionId);
  assert.ok(transitions.length >= 3); // multiple phase transitions

  eventBus.emit(createSessionCompletedEvent({
    runId, projectId, sessionId,
    totalPhases: 11, totalArtifacts: 12, durationMs: 5000
  }));

  assert.ok(eventLog.length >= 3); // started + finding + completed

  // Verify data stores are populated
  assert.ok(noteStore.count() > 0, "Notes should be populated");
  assert.ok(questionLog.count() > 0, "Questions should be asked");
  assert.ok(memoryStore.count() > 0, "Memories should be extracted");
  assert.ok(memoryStore.highConfidence(0.9).length > 0, "High confidence memories exist");
});

// --------------------------------------------------------------------------
// Model routing integration
// --------------------------------------------------------------------------

test("model routing integrates with provider health for all tasks", () => {
  const providers = [
    createDefaultProviderSelection("openai"),
    createDefaultProviderSelection("anthropic"),
    createDefaultProviderSelection("ollama")
  ];

  // OpenAI and Ollama available, Anthropic not configured
  const env = { OPENAI_API_KEY: "test-key" };

  const tasks = [
    "architecture-analysis",
    "invariant-extraction",
    "hypothesis-formulation",
    "finding-verification",
    "report-generation",
    "chat-response",
    "code-reading",
    "economic-modeling",
    "general"
  ];

  const logger = new ModelRequestLogger();

  for (const task of tasks) {
    const route = resolveModelRoute(task, providers, env);
    assert.ok(route, `Should resolve route for task: ${task}`);

    // Log the routing decision
    logger.log({
      timestamp: new Date().toISOString(),
      task: route.task,
      providerKind: route.provider.kind,
      model: route.provider.model,
      resolvedVia: route.resolvedVia,
      success: true
    });
  }

  const summary = logger.summarize();
  assert.equal(summary.totalRequests, 9);
  assert.equal(summary.successCount, 9);
  assert.equal(summary.failureCount, 0);
});

// --------------------------------------------------------------------------
// Toolchain integration
// --------------------------------------------------------------------------

test("toolchain definitions are accessible for all registered tools", () => {
  for (const tool of TOOLCHAIN_REGISTRY) {
    const def = getToolchainDefinition(tool.id);
    assert.equal(def.id, tool.id);
    assert.ok(def.name.length > 0);
    assert.ok(def.command.length > 0);
  }
});

// --------------------------------------------------------------------------
// Agent orchestration integration
// --------------------------------------------------------------------------

test("agent orchestration handles mixed success/skip scenarios", async () => {
  const registry = new AgentRegistry();

  // Register only phase-0 and phase-1 agents
  registry.register({
    phase: "phase-0-preparation",
    name: "PrepAgent",
    execute: async () => ({
      phase: "phase-0-preparation",
      success: true,
      artifacts: [{ kind: "note", title: "Prep", payload: {} }],
      durationMs: 1
    })
  });

  registry.register({
    phase: "phase-1-intent",
    name: "IntentAgent",
    execute: async () => ({
      phase: "phase-1-intent",
      success: true,
      artifacts: [{ kind: "note", title: "Intent", payload: {} }],
      durationMs: 2
    })
  });

  const orchestrator = new PhaseOrchestrator(registry);
  const result = await orchestrator.executeAll({
    runId: "test-run",
    projectId: "test-project",
    rootDirectory: "/tmp/test"
  });

  assert.equal(result.success, true);
  assert.equal(result.totalArtifacts, 2);
  // Unregistered phases should still show up as skipped with success
  assert.ok(result.phaseResults.length === METHODOLOGY_PHASES.length);
});

// --------------------------------------------------------------------------
// Session store integration
// --------------------------------------------------------------------------

test("session store tracks full lifecycle with transitions", () => {
  const store = new SessionStore();

  const session = store.create({
    sessionId: "sess-integ-001",
    runId: "run-001",
    projectId: "proj-001"
  });

  assert.equal(session.status, "idle");
  assert.equal(session.currentPhase, "phase-0-preparation");

  store.transition("sess-integ-001", "running", "phase-0-preparation");
  store.transition("sess-integ-001", "running", "phase-2-architecture");
  store.transition("sess-integ-001", "completed");

  const final = store.get("sess-integ-001");
  assert.equal(final?.status, "completed");

  const history = store.getHistory("sess-integ-001");
  assert.equal(history.length, 3);
  assert.equal(history[0]?.from, "idle");
  assert.equal(history[0]?.to, "running");
  assert.equal(history[2]?.to, "completed");

  assert.equal(store.listActive().length, 0); // completed session is not active
});
