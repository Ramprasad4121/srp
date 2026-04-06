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
    currentPhase: "discovery-docs"
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

  // Phase 0: Discovery Docs
  phaseRecords = markPhaseRunning(phaseRecords, "discovery-docs");
  sessionStore.transition(sessionId, "running", "discovery-docs");

  noteStore.add({
    phase: "discovery-docs",
    category: "observation",
    title: "Workspace analyzed",
    content: "Found 15 Solidity files in a Foundry project.",
    relatedIds: []
  });

  phaseRecords = markPhaseCompleted(phaseRecords, "discovery-docs", 1);

  // Discovery Phases
  for (const phase of ["discovery-audits", "discovery-governance", "discovery-tokenomics", "discovery-onchain"]) {
    phaseRecords = markPhaseRunning(phaseRecords, phase);
    phaseRecords = markPhaseCompleted(phaseRecords, phase, 1);
  }

  // Synthesis Phases
  phaseRecords = markPhaseRunning(phaseRecords, "synthesis-intent");
  phaseRecords = markPhaseCompleted(phaseRecords, "synthesis-intent", 1);
  phaseRecords = markPhaseRunning(phaseRecords, "synthesis-actors");
  sessionStore.transition(sessionId, "running", "synthesis-actors");

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

  phaseRecords = markPhaseCompleted(phaseRecords, "synthesis-actors", 2);

  // Phase: Invariants  
  phaseRecords = markPhaseRunning(phaseRecords, "synthesis-invariants");
  questionLog.ask({
    question: "What is the access control model for Vault.emergencyWithdraw?",
    phase: "synthesis-invariants",
    relatedIds: ["vault"]
  });
  phaseRecords = markPhaseCompleted(phaseRecords, "synthesis-invariants", 2);

  // Remaining phases
  for (const phase of ["synthesis-functions", "synthesis-entry-exit"]) {
    phaseRecords = markPhaseRunning(phaseRecords, phase);
    phaseRecords = markPhaseCompleted(phaseRecords, phase, 1);
  }

  // Phase: Visual Map
  phaseRecords = markPhaseRunning(phaseRecords, "visual-flow-map");

  memoryStore.extract({
    kind: "vulnerability-class",
    title: "Flash loan price manipulation",
    summary: "Oracle uses spot price without TWAP protection.",
    sourceArtifactIds: ["art_oracle"],
    sourcePhase: "visual-flow-map",
    confidence: 0.92
  });

  phaseRecords = markPhaseCompleted(phaseRecords, "visual-flow-map", 1);

  // Phase: Findings (Simulated)
  eventBus.emit(createFindingRegisteredEvent({
    runId, projectId,
    findingId: "F-001", severity: "Critical", title: "Oracle Manipulation"
  }));

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

  // Register only some agents
  registry.register({
    phase: "discovery-docs",
    name: "PrepAgent",
    execute: async () => ({
      phase: "discovery-docs",
      success: true,
      artifacts: [{ kind: "note", title: "Prep", payload: {} }],
      durationMs: 1
    })
  });

  registry.register({
    phase: "discovery-audits",
    name: "IntentAgent",
    execute: async () => ({
      phase: "discovery-audits",
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
  assert.equal(session.currentPhase, "discovery-docs");

  store.transition("sess-integ-001", "running", "discovery-docs");
  store.transition("sess-integ-001", "running", "synthesis-actors");
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
