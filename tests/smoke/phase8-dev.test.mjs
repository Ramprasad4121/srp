/**
 * Smoke tests: Phase-8 Developer Workbench
 *
 * Tests the foundational dev-side agents for NatSpec, tests, and explanations.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  NatSpecAgent,
  TestGenerationAgent,
  ExplainAgent
} from "../../packages/agents/dist/index.js";

test("Phase-8 Dev: NatSpec Generation", async () => {
  const agent = new NatSpecAgent();
  const context = { projectId: "p1", runId: "r1", role: "developer", providers: [] };
  const result = await agent.run(context, { file: "Contract.sol" });

  assert.ok(Array.isArray(result));
  assert.equal(result[0].functionName, "transfer");
  assert.ok(result[0].suggestedNatSpec.includes("@notice"));
});

test("Phase-8 Dev: Test Generation", async () => {
  const agent = new TestGenerationAgent();
  const context = { projectId: "p1", runId: "r1", role: "developer", providers: [] };
  const result = await agent.run(context, { file: "Contract.sol", testType: "fuzz" });

  assert.equal(result.testType, "fuzz");
  assert.equal(result.file, "Contract.sol.t.sol");
  assert.ok(result.content.includes("Generated test"));
});

test("Phase-8 Dev: Explain Code", async () => {
  const agent = new ExplainAgent();
  const context = { projectId: "p1", runId: "r1", role: "developer", providers: [] };
  const result = await agent.run(context, { file: "Contract.sol" });

  assert.equal(result.file, "Contract.sol");
  assert.ok(result.summary.includes("core logic"));
});
