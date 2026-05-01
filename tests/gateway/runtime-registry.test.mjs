/**
 * Tests: RuntimeRegistry project isolation
 *
 * Validates that state for two distinct projectIds never bleeds across
 * entries — the core guarantee that replaces the old module-level singleton.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import {
  RuntimeRegistry,
  createRuntimeEntry,
  resetRuntimeMemory
} from "../../apps/gateway/dist/runtime/runtime-registry.js";

function makeTmpRoot() {
  return mkdtemp(join(tmpdir(), "srp-registry-"));
}

// ---------------------------------------------------------------------------
// RuntimeRegistry unit tests
// ---------------------------------------------------------------------------

test("RuntimeRegistry: getOrCreate returns distinct entries per projectId", () => {
  const reg = new RuntimeRegistry();
  const a = reg.getOrCreate("project-alpha");
  const b = reg.getOrCreate("project-beta");

  assert.notStrictEqual(a, b, "Different projectIds must yield different entries");
  assert.equal(a.projectId, "project-alpha");
  assert.equal(b.projectId, "project-beta");
});

test("RuntimeRegistry: getOrCreate is idempotent for the same projectId", () => {
  const reg = new RuntimeRegistry();
  const first  = reg.getOrCreate("same-project");
  const second = reg.getOrCreate("same-project");
  assert.strictEqual(first, second, "Same projectId must return the exact same entry object");
});

test("RuntimeRegistry: selected project tracks the most-recent getOrCreate call", () => {
  const reg = new RuntimeRegistry();
  reg.getOrCreate("project-alpha");
  reg.getOrCreate("project-beta");
  assert.equal(reg.getSelectedProjectId(), "project-beta");
});

test("RuntimeRegistry: resolve without argument returns the selected entry", () => {
  const reg = new RuntimeRegistry();
  const entry = reg.getOrCreate("project-alpha");
  reg.getOrCreate("project-beta"); // moves selection to beta
  reg.select("project-alpha");     // manually select alpha back

  const resolved = reg.resolve();
  assert.strictEqual(resolved, entry);
});

test("RuntimeRegistry: resolve with explicit projectId ignores selection", () => {
  const reg = new RuntimeRegistry();
  const alpha = reg.getOrCreate("project-alpha");
  reg.getOrCreate("project-beta"); // selection is now beta

  const resolved = reg.resolve("project-alpha");
  assert.strictEqual(resolved, alpha);
});

test("RuntimeRegistry: resolve returns null for unknown projectId", () => {
  const reg = new RuntimeRegistry();
  reg.getOrCreate("project-alpha");
  assert.equal(reg.resolve("does-not-exist"), null);
});

test("RuntimeRegistry: resolve returns null when nothing has been selected", () => {
  const reg = new RuntimeRegistry();
  assert.equal(reg.resolve(), null);
});

test("RuntimeRegistry: peek does not affect the selected project", () => {
  const reg = new RuntimeRegistry();
  const alpha = reg.getOrCreate("project-alpha");
  reg.getOrCreate("project-beta"); // selection = beta

  reg.peek("project-alpha"); // should not change selection
  assert.equal(reg.getSelectedProjectId(), "project-beta");
});

test("RuntimeRegistry: listProjectIds returns all known ids in insertion order", () => {
  const reg = new RuntimeRegistry();
  reg.getOrCreate("aaa");
  reg.getOrCreate("bbb");
  reg.getOrCreate("ccc");
  assert.deepEqual([...reg.listProjectIds()], ["aaa", "bbb", "ccc"]);
});

test("RuntimeRegistry: clear wipes all entries and selection", () => {
  const reg = new RuntimeRegistry();
  reg.getOrCreate("project-alpha");
  reg.clear();
  assert.equal(reg.listProjectIds().length, 0);
  assert.equal(reg.getSelectedProjectId(), null);
  assert.equal(reg.resolve(), null);
});

test("RuntimeRegistry: rejects empty projectId", () => {
  const reg = new RuntimeRegistry();
  assert.throws(() => reg.getOrCreate(""), /non-empty/);
  assert.throws(() => reg.getOrCreate("   "), /non-empty/);
});

// ---------------------------------------------------------------------------
// RuntimeEntry mutation isolation
// ---------------------------------------------------------------------------

test("RuntimeEntry: mutating one entry's state does not affect another", () => {
  const reg = new RuntimeRegistry();
  const alpha = reg.getOrCreate("project-alpha");
  const beta  = reg.getOrCreate("project-beta");

  alpha.isRunning = true;
  alpha.activeRunId = "run-aaa";
  alpha.liveRunStatus = "running";
  alpha.liveArtifacts = [{ artifactId: "art-1" }];

  assert.equal(beta.isRunning, false);
  assert.equal(beta.activeRunId, null);
  assert.equal(beta.liveRunStatus, "idle");
  assert.equal(beta.liveArtifacts.length, 0);
});

test("RuntimeEntry: runtimeMemory is isolated per project", () => {
  const reg = new RuntimeRegistry();
  const alpha = reg.getOrCreate("project-alpha");
  const beta  = reg.getOrCreate("project-beta");

  alpha.runtimeMemory.currentPhaseIndex = 5;
  alpha.runtimeMemory.pendingWorkspaceAnalysis = { summary: "alpha" };

  assert.equal(beta.runtimeMemory.currentPhaseIndex, -1);
  assert.equal(beta.runtimeMemory.pendingWorkspaceAnalysis, undefined);
});

test("RuntimeEntry: resetRuntimeMemory clears only the target entry", () => {
  const reg = new RuntimeRegistry();
  const alpha = reg.getOrCreate("project-alpha");
  const beta  = reg.getOrCreate("project-beta");

  alpha.runtimeMemory.currentPhaseIndex = 7;
  beta.runtimeMemory.currentPhaseIndex  = 3;

  resetRuntimeMemory(alpha);

  assert.equal(alpha.runtimeMemory.currentPhaseIndex, -1, "alpha should be reset");
  assert.equal(beta.runtimeMemory.currentPhaseIndex, 3, "beta must not be touched");
});

test("RuntimeEntry: agentRegistry / knowledgeBus / auditRoomProjector are distinct objects", () => {
  const reg = new RuntimeRegistry();
  const alpha = reg.getOrCreate("project-alpha");
  const beta  = reg.getOrCreate("project-beta");

  assert.notStrictEqual(alpha.agentRegistry, beta.agentRegistry);
  assert.notStrictEqual(alpha.knowledgeBus,  beta.knowledgeBus);
  assert.notStrictEqual(alpha.auditRoomProjector, beta.auditRoomProjector);
});
