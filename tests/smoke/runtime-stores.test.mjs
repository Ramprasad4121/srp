import test from "node:test";
import assert from "node:assert/strict";

import {
  NoteStore,
  QuestionLog,
  MemoryStore,
  createArtifactRecord
} from "../../packages/artifacts/dist/index.js";

import {
  createSessionStartedEvent,
  createSessionCompletedEvent,
  createSessionFailedEvent,
  createFindingRegisteredEvent,
  createModelRequestEvent,
  createNoteCreatedEvent,
  createQuestionAskedEvent,
  createMemoryExtractedEvent,
  isSessionEvent,
  isPhaseEvent,
  isArtifactEvent,
  TypedEventBus
} from "../../packages/events/dist/index.js";

// --------------------------------------------------------------------------
// NoteStore tests
// --------------------------------------------------------------------------

test("NoteStore can add, retrieve, and filter notes", () => {
  const store = new NoteStore();
  assert.equal(store.count(), 0);

  const note1 = store.add({
    phase: "phase-2-architecture",
    category: "observation",
    title: "Upgradeable proxy detected",
    content: "The Vault is behind a UUPS proxy, which means admin can upgrade logic.",
    relatedIds: ["Vault.sol"]
  });

  const note2 = store.add({
    phase: "phase-2-architecture",
    category: "concern",
    title: "No timelock on upgrade",
    content: "Upgrade has no timelock — immediate rug risk.",
    relatedIds: ["Vault.sol", "ProxyAdmin.sol"]
  });

  const note3 = store.add({
    phase: "phase-5-attack-simulation",
    category: "insight",
    title: "Flash loan vector possible",
    content: "The oracle does not use TWAP.",
    relatedIds: ["Oracle.sol"]
  });

  assert.equal(store.count(), 3);

  const retrieved = store.get(note1.id);
  assert.equal(retrieved?.title, "Upgradeable proxy detected");

  const archNotes = store.listByPhase("phase-2-architecture");
  assert.equal(archNotes.length, 2);

  const concerns = store.listByCategory("concern");
  assert.equal(concerns.length, 1);
  assert.equal(concerns[0]?.title, "No timelock on upgrade");
});

// --------------------------------------------------------------------------
// QuestionLog tests
// --------------------------------------------------------------------------

test("QuestionLog manages the lifecycle of audit questions", () => {
  const log = new QuestionLog();
  assert.equal(log.count(), 0);

  const q1 = log.ask({
    question: "What is the intended access control for emergencyWithdraw?",
    phase: "phase-3-invariants"
  });

  const q2 = log.ask({
    question: "Is the oracle price check bounded by a circuit breaker?",
    phase: "phase-6-economic-modeling",
    relatedIds: ["Oracle.sol"]
  });

  assert.equal(log.count(), 2);
  assert.equal(log.openCount(), 2);
  assert.equal(q1.status, "open");

  // Resolve q1
  const resolved = log.resolve(q1.id, "Only ADMIN_ROLE via AccessControl modifier.");
  assert.equal(resolved?.status, "resolved");
  assert.ok(resolved?.answer?.includes("ADMIN_ROLE"));
  assert.ok(resolved?.resolvedAt);

  assert.equal(log.openCount(), 1);
  assert.equal(log.listOpen().length, 1);

  // Update q2 status
  log.updateStatus(q2.id, "investigating");
  const q2Updated = log.all().find((q) => q.id === q2.id);
  assert.equal(q2Updated?.status, "investigating");

  // Filter by phase
  const invariantQs = log.listByPhase("phase-3-invariants");
  assert.equal(invariantQs.length, 1);
});

test("QuestionLog resolve returns undefined for unknown ID", () => {
  const log = new QuestionLog();
  const result = log.resolve("nonexistent", "answer");
  assert.equal(result, undefined);
});

// --------------------------------------------------------------------------
// MemoryStore tests
// --------------------------------------------------------------------------

test("MemoryStore extracts and filters memories", () => {
  const store = new MemoryStore();

  const m1 = store.extract({
    kind: "vulnerability-class",
    title: "Reentrancy in withdraw pattern",
    summary: "External call before state update allows reentrancy.",
    sourceArtifactIds: ["art_001"],
    sourcePhase: "phase-5-attack-simulation",
    confidence: 0.95
  });

  store.extract({
    kind: "pattern",
    title: "Pull-over-push pattern used",
    summary: "Withdrawals use pull pattern which prevents reentrancy.",
    sourceArtifactIds: ["art_002"],
    sourcePhase: "phase-2-architecture",
    confidence: 0.7
  });

  store.extract({
    kind: "trust-assumption",
    title: "Admin is trusted",
    summary: "Protocol assumes admin keys are held by a multi-sig.",
    sourceArtifactIds: ["art_003"],
    sourcePhase: "phase-3-invariants",
    confidence: 0.85
  });

  assert.equal(store.count(), 3);
  assert.equal(store.listByKind("vulnerability-class").length, 1);
  assert.equal(store.listByPhase("phase-2-architecture").length, 1);

  const highConf = store.highConfidence(0.8);
  assert.equal(highConf.length, 2); // 0.95 and 0.85
});

// --------------------------------------------------------------------------
// Typed Event Bus tests
// --------------------------------------------------------------------------

test("TypedEventBus dispatches events to correct handlers", () => {
  const bus = new TypedEventBus();
  const received = [];

  bus.on("session.started", (event) => {
    received.push(event.type);
  });

  bus.on("artifact.created", (event) => {
    received.push(event.type);
  });

  bus.emit(createSessionStartedEvent({
    runId: "run-1",
    projectId: "proj-1",
    sessionId: "sess-1"
  }));

  // This shouldn't trigger session.started handler
  bus.emit({
    type: "setup.updated",
    emittedAt: new Date().toISOString()
  });

  assert.equal(received.length, 1);
  assert.equal(received[0], "session.started");
});

test("TypedEventBus wildcard handler receives all events", () => {
  const bus = new TypedEventBus();
  const all = [];

  bus.on("*", (event) => all.push(event.type));

  bus.emit(createSessionStartedEvent({ runId: "r1", projectId: "p1", sessionId: "s1" }));
  bus.emit({ type: "setup.updated", emittedAt: new Date().toISOString() });
  bus.emit({ type: "bootstrap.updated", emittedAt: new Date().toISOString() });

  assert.equal(all.length, 3);
});

test("TypedEventBus off removes handler", () => {
  const bus = new TypedEventBus();
  const count = { value: 0 };
  const handler = () => { count.value++; };

  bus.on("session.started", handler);
  bus.emit(createSessionStartedEvent({ runId: "r1", projectId: "p1", sessionId: "s1" }));
  assert.equal(count.value, 1);

  bus.off("session.started", handler);
  bus.emit(createSessionStartedEvent({ runId: "r2", projectId: "p2", sessionId: "s2" }));
  assert.equal(count.value, 1); // Should not have changed
});

// --------------------------------------------------------------------------
// New Event factory tests
// --------------------------------------------------------------------------

test("session lifecycle event factories produce correct types", () => {
  const started = createSessionStartedEvent({ runId: "r1", projectId: "p1", sessionId: "s1" });
  assert.equal(started.type, "session.started");
  assert.ok(started.emittedAt);

  const completed = createSessionCompletedEvent({
    runId: "r1", projectId: "p1", sessionId: "s1",
    totalPhases: 11, totalArtifacts: 25, durationMs: 5000
  });
  assert.equal(completed.type, "session.completed");
  assert.equal(completed.totalPhases, 11);

  const failed = createSessionFailedEvent({
    runId: "r1", projectId: "p1", sessionId: "s1",
    errorMessage: "Timeout",
    failedPhase: "phase-3-invariants"
  });
  assert.equal(failed.type, "session.failed");
  assert.equal(failed.failedPhase, "phase-3-invariants");
});

test("domain-specific event factories produce correct types", () => {
  const finding = createFindingRegisteredEvent({
    runId: "r1", projectId: "p1",
    findingId: "F-001", severity: "Critical", title: "Reentrancy"
  });
  assert.equal(finding.type, "finding.registered");

  const model = createModelRequestEvent({
    runId: "r1", projectId: "p1",
    task: "architecture-analysis",
    providerKind: "anthropic",
    model: "claude-sonnet-4-0",
    success: true,
    durationMs: 1200
  });
  assert.equal(model.type, "model.request");

  const note = createNoteCreatedEvent({
    runId: "r1", projectId: "p1",
    noteId: "n1", category: "observation",
    phase: "phase-2-architecture"
  });
  assert.equal(note.type, "note.created");

  const question = createQuestionAskedEvent({
    runId: "r1", projectId: "p1",
    questionId: "q1", phase: "phase-3-invariants"
  });
  assert.equal(question.type, "question.asked");

  const memory = createMemoryExtractedEvent({
    runId: "r1", projectId: "p1",
    memoryId: "m1", kind: "pattern", confidence: 0.9
  });
  assert.equal(memory.type, "memory.extracted");
});

// --------------------------------------------------------------------------
// Event type guard tests
// --------------------------------------------------------------------------

test("event type guards correctly discriminate event types", () => {
  const sessionStarted = createSessionStartedEvent({ runId: "r1", projectId: "p1", sessionId: "s1" });
  assert.equal(isSessionEvent(sessionStarted), true);
  assert.equal(isPhaseEvent(sessionStarted), false);
  assert.equal(isArtifactEvent(sessionStarted), false);
});
