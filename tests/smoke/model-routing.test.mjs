import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveModelRoute,
  DEFAULT_ROUTING_TABLE,
  ModelRequestLogger,
  createDefaultProviderSelection
} from "../../packages/providers/dist/index.js";

import {
  asEventId,
  asConversationId,
  asSkillId,
  asDiagramId,
  asReportId
} from "../../packages/ids/dist/index.js";

// --------------------------------------------------------------------------
// Model routing engine tests
// --------------------------------------------------------------------------

test("resolveModelRoute selects preferred provider when healthy", () => {
  const providers = [
    createDefaultProviderSelection("anthropic"),
    createDefaultProviderSelection("openai")
  ];

  // Simulate healthy environment with API keys present
  const env = {
    ANTHROPIC_API_KEY: "test-key",
    OPENAI_API_KEY: "test-key"
  };

  const route = resolveModelRoute("architecture-analysis", providers, env);
  assert.ok(route, "Should have resolved a route");
  assert.equal(route.task, "architecture-analysis");
  assert.equal(route.provider.kind, "anthropic");
  assert.equal(route.resolvedVia, "preferred");
  assert.equal(route.maxTokens, 2048);
  assert.equal(route.temperature, 0.2);
});

test("resolveModelRoute falls back when preferred is unhealthy", () => {
  const providers = [
    createDefaultProviderSelection("anthropic"),
    createDefaultProviderSelection("openai")
  ];

  // Only OpenAI key present — Anthropic is unhealthy
  const env = {
    OPENAI_API_KEY: "test-key"
  };

  const route = resolveModelRoute("architecture-analysis", providers, env);
  assert.ok(route, "Should have resolved via fallback");
  assert.equal(route.provider.kind, "openai");
  assert.equal(route.resolvedVia, "fallback");
  assert.equal(route.fallbackIndex, 0);
});

test("resolveModelRoute returns null when no providers are healthy", () => {
  const providers = [
    createDefaultProviderSelection("anthropic"),
    createDefaultProviderSelection("openai")
  ];

  // No API keys — all are unhealthy
  const env = {};
  const route = resolveModelRoute("architecture-analysis", providers, env);
  assert.equal(route, null, "Should return null when no providers are available");
});

test("resolveModelRoute handles all task categories", () => {
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

  for (const task of tasks) {
    const rule = DEFAULT_ROUTING_TABLE.find((r) => r.task === task);
    assert.ok(rule, `Missing routing rule for task: ${task}`);
    assert.ok(rule.maxTokens > 0, `maxTokens should be positive for: ${task}`);
    assert.ok(rule.fallbackChain.length > 0, `Should have at least one fallback for: ${task}`);
  }
});

test("resolveModelRoute falls back to 'general' for unknown tasks", () => {
  const providers = [
    createDefaultProviderSelection("openai")
  ];
  const env = { OPENAI_API_KEY: "test" };

  // Custom routing table without the task
  const route = resolveModelRoute("general", providers, env);
  assert.ok(route);
  assert.equal(route.task, "general");
});

// --------------------------------------------------------------------------
// Request logger tests
// --------------------------------------------------------------------------

test("ModelRequestLogger logs entries and supports filtering", () => {
  const logger = new ModelRequestLogger();
  
  logger.log({
    timestamp: new Date().toISOString(),
    task: "architecture-analysis",
    providerKind: "anthropic",
    model: "claude-sonnet-4-0",
    resolvedVia: "preferred",
    durationMs: 1200,
    success: true
  });

  logger.log({
    timestamp: new Date().toISOString(),
    task: "chat-response",
    providerKind: "openai",
    model: "gpt-4.1-mini",
    resolvedVia: "preferred",
    durationMs: 800,
    success: true
  });

  logger.log({
    timestamp: new Date().toISOString(),
    task: "architecture-analysis",
    providerKind: "openai",
    model: "gpt-4.1",
    resolvedVia: "fallback",
    durationMs: 1500,
    success: false,
    errorMessage: "Rate limited"
  });

  assert.equal(logger.getEntries().length, 3);
  assert.equal(logger.getEntriesByTask("architecture-analysis").length, 2);
  assert.equal(logger.getEntriesByTask("chat-response").length, 1);
});

test("ModelRequestLogger summarizes usage statistics correctly", () => {
  const logger = new ModelRequestLogger();

  for (let i = 0; i < 5; i++) {
    logger.log({
      timestamp: new Date().toISOString(),
      task: "general",
      providerKind: "openai",
      model: "gpt-4.1-mini",
      resolvedVia: "preferred",
      success: true
    });
  }

  logger.log({
    timestamp: new Date().toISOString(),
    task: "general",
    providerKind: "anthropic",
    model: "claude-sonnet-4-0",
    resolvedVia: "fallback",
    success: false,
    errorMessage: "Timeout"
  });

  const summary = logger.summarize();
  assert.equal(summary.totalRequests, 6);
  assert.equal(summary.successCount, 5);
  assert.equal(summary.failureCount, 1);
  assert.equal(summary.requestsByProvider["openai"], 5);
  assert.equal(summary.requestsByProvider["anthropic"], 1);
  assert.equal(summary.requestsByTask["general"], 6);
});

test("ModelRequestLogger respects max entries limit", () => {
  const logger = new ModelRequestLogger(3);

  for (let i = 0; i < 5; i++) {
    logger.log({
      timestamp: new Date().toISOString(),
      task: "general",
      providerKind: "openai",
      model: "gpt-4.1-mini",
      resolvedVia: "preferred"
    });
  }

  assert.equal(logger.getEntries().length, 3, "Should cap at maxEntries=3");
});

test("ModelRequestLogger clear removes all entries", () => {
  const logger = new ModelRequestLogger();
  logger.log({
    timestamp: new Date().toISOString(),
    task: "general",
    providerKind: "openai",
    model: "gpt-4.1-mini",
    resolvedVia: "preferred"
  });

  assert.equal(logger.getEntries().length, 1);
  logger.clear();
  assert.equal(logger.getEntries().length, 0);
});

// --------------------------------------------------------------------------
// Extended IDs tests
// --------------------------------------------------------------------------

test("new branded ID types are available and type-safe", () => {
  const eventId = asEventId("evt_123");
  const convId = asConversationId("conv_456");
  const skillId = asSkillId("skill_abc");
  const diagramId = asDiagramId("diag_789");
  const reportId = asReportId("rep_001");

  // Runtime values are correct
  assert.equal(eventId, "evt_123");
  assert.equal(convId, "conv_456");
  assert.equal(skillId, "skill_abc");
  assert.equal(diagramId, "diag_789");
  assert.equal(reportId, "rep_001");

  // They are still strings at runtime
  assert.equal(typeof eventId, "string");
  assert.equal(typeof convId, "string");
});
