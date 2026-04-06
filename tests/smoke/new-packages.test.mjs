import test from "node:test";
import assert from "node:assert/strict";

// --------------------------------------------------------------------------
// Phase 1: Monorepo foundation — verify all new packages are importable
// and their core APIs work.
// --------------------------------------------------------------------------

// Methodology package
import {
  METHODOLOGY_PHASES,
  PHASE_LABELS,
  PHASE_DEFINITIONS,
  getPhaseDefinition,
  getPhaseIndex,
  getNextPhase,
  areDependenciesMet,
  createInitialPhaseRecords,
  markPhaseRunning,
  markPhaseCompleted,
  markPhaseFailed,
  getCompletedPhases,
  getNextEligiblePhase,
  computeRunProgress,
  totalArtifacts,
  summarizeAuditRun
} from "../../packages/methodology/dist/index.js";

// Agents package
import {
  AGENT_PHASE_MAP,
  AgentRegistry,
  PhaseOrchestrator
} from "../../packages/agents/dist/index.js";

// Diagram engine
import {
  compileDiagram,
  exportToExcalidrawJson,
  DIAGRAM_FAMILIES
} from "../../packages/diagram-engine/dist/index.js";

// Report engine
import {
  compileReport,
  findingSeverityCounts
} from "../../packages/report-engine/dist/index.js";

// Project graph
import {
  createEmptyGraph,
  addNode,
  addEdge,
  getDirectDependencies,
  getReverseDependencies,
  topologicalSort
} from "../../packages/project-graph/dist/index.js";

// Tools
import {
  TOOLCHAIN_REGISTRY,
  getToolchainDefinition,
  toToolchainExecution
} from "../../packages/tools/dist/index.js";

// --------------------------------------------------------------------------
// Methodology tests
// --------------------------------------------------------------------------

test("methodology exports all 11 phases in correct order", () => {
  assert.equal(METHODOLOGY_PHASES.length, 11);
  assert.equal(METHODOLOGY_PHASES[0], "discovery-docs");
  assert.equal(METHODOLOGY_PHASES[10], "visual-flow-map");
});

test("every phase has a human-readable label", () => {
  for (const phase of METHODOLOGY_PHASES) {
    const label = PHASE_LABELS[phase];
    assert.ok(label, `Missing label for ${phase}`);
    assert.ok(label.length > 5, `Label too short for ${phase}: ${label}`);
  }
});

test("phase definitions have valid dependency chains", () => {
  assert.equal(PHASE_DEFINITIONS.length, 11);

  // first phase has no deps
  const prep = getPhaseDefinition("discovery-docs");
  assert.deepEqual(prep.dependsOn, []);

  // second phase depends on first
  const audits = getPhaseDefinition("discovery-audits");
  assert.deepEqual(audits.dependsOn, ["discovery-docs"]);

  // Unknown phase throws
  assert.throws(() => getPhaseDefinition("phase-99-fake"), /Unknown methodology phase/);
});

test("phase index and next phase work correctly", () => {
  assert.equal(getPhaseIndex("discovery-docs"), 0);
  assert.equal(getPhaseIndex("visual-flow-map"), 10);
  assert.equal(getNextPhase("discovery-docs"), "discovery-audits");
  assert.equal(getNextPhase("visual-flow-map"), null);
});

test("dependency checking works across phase graph", () => {
  const empty = new Set();
  assert.equal(areDependenciesMet("discovery-docs", empty), true);
  assert.equal(areDependenciesMet("discovery-audits", empty), false);

  const afterPrep = new Set(["discovery-docs"]);
  assert.equal(areDependenciesMet("discovery-audits", afterPrep), true);
  assert.equal(areDependenciesMet("discovery-governance", afterPrep), false);
});

test("phase runner creates and transitions records correctly", () => {
  let records = createInitialPhaseRecords();
  assert.equal(records.length, 11);
  assert.ok(records.every((r) => r.status === "pending"));

  records = markPhaseRunning(records, "discovery-docs");
  assert.equal(records[0].status, "running");
  assert.ok(records[0].startedAt);

  records = markPhaseCompleted(records, "discovery-docs", 2);
  assert.equal(records[0].status, "completed");
  assert.equal(records[0].artifactCount, 2);
  assert.ok(records[0].completedAt);

  records = markPhaseFailed(records, "discovery-audits", "Network timeout");
  assert.equal(records[1].status, "failed");

  const completed = getCompletedPhases(records);
  assert.equal(completed.size, 1);
  assert.ok(completed.has("discovery-docs"));

  assert.equal(computeRunProgress(records), 1 / 11);
  assert.equal(totalArtifacts(records), 2);
});

test("next eligible phase respects dependencies", () => {
  let records = createInitialPhaseRecords();
  assert.equal(getNextEligiblePhase(records), "discovery-docs");

  records = markPhaseCompleted(records, "discovery-docs", 1);
  assert.equal(getNextEligiblePhase(records), "discovery-audits");
});

test("audit manifest summary derives correctly", () => {
  const records = createInitialPhaseRecords();
  const completedRecords = markPhaseCompleted(
    markPhaseCompleted(records, "discovery-docs", 1),
    "discovery-audits",
    2
  );

  const summary = summarizeAuditRun({
    runId: "run-1",
    projectId: "proj-1",
    sessionId: "sess-1",
    status: "running",
    createdAt: new Date().toISOString(),
    currentPhase: "discovery-governance",
    phaseRecords: completedRecords,
    totalArtifacts: 3
  });

  assert.equal(summary.phasesCompleted, 2);
  assert.equal(summary.phasesTotal, 11);
  assert.equal(summary.totalArtifacts, 3);
  assert.ok(summary.progress > 0);
});

// --------------------------------------------------------------------------
// Agent tests
// --------------------------------------------------------------------------

test("agent registry registers and retrieves agents", () => {
  const registry = new AgentRegistry();
  assert.equal(registry.has("discovery-docs"), false);

  registry.register({
    phase: "discovery-docs",
    name: "TestPrepAgent",
    execute: async () => ({
      phase: "discovery-docs",
      success: true,
      artifacts: [],
      durationMs: 10
    })
  });

  assert.equal(registry.has("discovery-docs"), true);
  assert.equal(registry.get("discovery-docs")?.name, "TestPrepAgent");
  assert.equal(registry.list().length, 1);
  assert.deepEqual(registry.registeredPhases(), ["discovery-docs"]);
});

test("agent phase map covers all expected agent types", () => {
  assert.equal(AGENT_PHASE_MAP["DiscoveryAgent:docs"], "discovery-docs");
  assert.equal(AGENT_PHASE_MAP["SynthesisAgent:intent"], "synthesis-intent");
  assert.equal(AGENT_PHASE_MAP["VisualAgent:flow"], "visual-flow-map");
});

test("orchestrator executes agents in dependency order", async () => {
  const registry = new AgentRegistry();
  const executionOrder = [];

  registry.register({
    phase: "discovery-docs",
    name: "PrepAgent",
    execute: async () => {
      executionOrder.push("phase-0");
      return {
        phase: "discovery-docs",
        success: true,
        artifacts: [{ kind: "note", title: "Workspace", payload: { ok: true } }],
        durationMs: 5
      };
    }
  });

  registry.register({
    phase: "discovery-audits",
    name: "AuditAgent",
    execute: async (ctx) => {
      executionOrder.push("phase-1");
      const prevArtifacts = ctx.previousArtifacts.get("discovery-docs");
      return {
        phase: "discovery-audits",
        success: true,
        artifacts: [{ kind: "note", title: "Audits", payload: { prev: prevArtifacts?.length } }],
        durationMs: 3
      };
    }
  });

  const orchestrator = new PhaseOrchestrator(registry);
  const result = await orchestrator.executeAll({
    runId: "test-run",
    projectId: "test-project",
    rootDirectory: "/tmp/test"
  });

  assert.equal(result.success, true);
  assert.deepEqual(executionOrder, ["phase-0", "phase-1"]);
  assert.equal(result.totalArtifacts, 2);
  assert.ok(result.totalDurationMs >= 0);
});

// --------------------------------------------------------------------------
// Diagram engine tests
// --------------------------------------------------------------------------

test("diagram engine compiles nodes and edges into Excalidraw elements", () => {
  const diagram = compileDiagram({
    family: "protocol-map",
    title: "Test Protocol Map",
    nodes: [
      { id: "vault", label: "Vault" },
      { id: "router", label: "Router" },
      { id: "oracle", label: "Oracle" }
    ],
    edges: [
      { fromId: "vault", toId: "router", label: "deposit" },
      { fromId: "router", toId: "oracle", label: "getPrice" }
    ]
  });

  assert.equal(diagram.type, "excalidraw");
  assert.equal(diagram.version, 2);
  assert.equal(diagram.source, "srp");
  assert.equal(diagram.title, "Test Protocol Map");
  // 3 nodes × 2 elements (rect + text) + 2 arrows = 8 elements
  assert.equal(diagram.elements.length, 8);
});

test("diagram engine exports valid Excalidraw JSON", () => {
  const diagram = compileDiagram({
    family: "trust-boundary",
    title: "Trust Diagram",
    nodes: [{ id: "a", label: "Admin" }],
    edges: []
  });

  const json = exportToExcalidrawJson(diagram);
  const parsed = JSON.parse(json);
  assert.equal(parsed.type, "excalidraw");
  assert.ok(Array.isArray(parsed.elements));
  assert.ok(parsed.appState);
});

test("all 9 diagram families are registered", () => {
  assert.equal(DIAGRAM_FAMILIES.length, 9);
  assert.ok(DIAGRAM_FAMILIES.includes("protocol-map"));
  assert.ok(DIAGRAM_FAMILIES.includes("attack-path"));
  assert.ok(DIAGRAM_FAMILIES.includes("remediation-diff"));
});

// --------------------------------------------------------------------------
// Report engine tests
// --------------------------------------------------------------------------

test("report engine compiles a complete report from artifacts", () => {
  const report = compileReport({
    workspace: {
      rootDirectory: "/test",
      isFoundry: true,
      isHardhat: false,
      solidityFileCount: 10,
      solidityFiles: [],
      topLevelDirectories: [],
      summary: "Test workspace"
    },
    intent: {
      mainContracts: ["Vault", "Router"],
      interfaceCount: 3,
      draftSummary: "DeFi protocol"
    },
    findingRegistry: {
      summary: "2 findings",
      findings: [
        {
          id: "F-1",
          title: "Reentrancy",
          description: "Critical reentrancy",
          severity: "Critical",
          status: "Confirmed",
          targetComponent: "Vault",
          impactedInvariantIds: ["INV-1"]
        },
        {
          id: "F-2",
          title: "Missing Check",
          description: "Low severity issue",
          severity: "Low",
          status: "Confirmed",
          targetComponent: "Router",
          impactedInvariantIds: []
        }
      ],
      generatedByModel: "test"
    }
  });

  assert.ok(report.id.startsWith("REP-"));
  assert.match(report.title, /Vault, Router/);
  assert.match(report.markdownContent, /Executive Summary/);
  assert.match(report.markdownContent, /Security Findings/);
  assert.match(report.markdownContent, /Reentrancy/);
});

test("finding severity counts are correct", () => {
  const counts = findingSeverityCounts({
    summary: "test",
    findings: [
      { id: "1", title: "a", description: "", severity: "Critical", status: "Confirmed", targetComponent: "", impactedInvariantIds: [] },
      { id: "2", title: "b", description: "", severity: "Critical", status: "Confirmed", targetComponent: "", impactedInvariantIds: [] },
      { id: "3", title: "c", description: "", severity: "High", status: "Confirmed", targetComponent: "", impactedInvariantIds: [] }
    ],
    generatedByModel: "test"
  });

  assert.equal(counts["Critical"], 2);
  assert.equal(counts["High"], 1);
});

// --------------------------------------------------------------------------
// Project graph tests
// --------------------------------------------------------------------------

test("project graph supports CRUD and topological sort", () => {
  let graph = createEmptyGraph();
  assert.equal(graph.nodes.length, 0);

  graph = addNode(graph, {
    id: "vault",
    name: "Vault",
    filePath: "src/Vault.sol",
    kind: "contract",
    inheritsFrom: ["ERC20"],
    imports: ["IERC20"]
  });

  graph = addNode(graph, {
    id: "ierc20",
    name: "IERC20",
    filePath: "src/IERC20.sol",
    kind: "interface",
    inheritsFrom: [],
    imports: []
  });

  graph = addEdge(graph, {
    fromId: "vault",
    toId: "ierc20",
    relationship: "imports"
  });

  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges.length, 1);

  const deps = getDirectDependencies(graph, "vault");
  assert.equal(deps.length, 1);
  assert.equal(deps[0].id, "ierc20");

  const reverseDeps = getReverseDependencies(graph, "ierc20");
  assert.equal(reverseDeps.length, 1);
  assert.equal(reverseDeps[0].id, "vault");

  const sorted = topologicalSort(graph);
  assert.equal(sorted.length, 2);
  // ierc20 should come before vault in dependency order
  const ierc20Index = sorted.findIndex((n) => n.id === "ierc20");
  const vaultIndex = sorted.findIndex((n) => n.id === "vault");
  assert.ok(ierc20Index < vaultIndex);
});

// --------------------------------------------------------------------------
// Tools tests
// --------------------------------------------------------------------------

test("toolchain registry has all expected tools", () => {
  assert.ok(TOOLCHAIN_REGISTRY.length >= 7);
  assert.ok(TOOLCHAIN_REGISTRY.some((t) => t.id === "foundry"));
  assert.ok(TOOLCHAIN_REGISTRY.some((t) => t.id === "slither"));
  assert.ok(TOOLCHAIN_REGISTRY.some((t) => t.id === "echidna"));
});

test("getToolchainDefinition returns correct data", () => {
  const foundry = getToolchainDefinition("foundry");
  assert.equal(foundry.command, "forge");
  assert.equal(foundry.requiresDocker, false);

  const slither = getToolchainDefinition("slither");
  assert.equal(slither.requiresDocker, true);

  assert.throws(() => getToolchainDefinition("nonexistent"), /Unknown toolchain/);
});

test("toToolchainExecution creates valid shared-types ToolchainExecution", () => {
  const result = toToolchainExecution({
    toolchainId: "foundry",
    success: true,
    exitCode: 0,
    stdout: "All tests passed",
    stderr: "",
    durationMs: 1500
  });

  assert.equal(result.tool, "foundry");
  assert.equal(result.success, true);
  assert.match(result.logs, /All tests passed/);
  assert.ok(result.generatedAt);
});
