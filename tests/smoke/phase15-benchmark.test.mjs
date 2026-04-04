/**
 * Smoke tests: Phase-15 Benchmark Suite
 *
 * Tests the evaluation logic for comparing detected findings against
 * expected ground truth results.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { BenchmarkRunner } from "../../packages/benchmark/dist/index.js";

test("Phase-15 Benchmark: Scoring Accuracy", () => {
  const runner = new BenchmarkRunner();
  
  const detected = [
    { id: "F1", title: "Reentrancy in withdraw", severity: "High" },
    { id: "F2", title: "Unchecked return value", severity: "Medium" }
  ];
  
  const expected = [
    { id: "GT1", title: "Reentrancy", severity: "High" },
    { id: "GT2", title: "Integer Overflow", severity: "High" }
  ];

  const report = runner.run("project-X", detected, expected);

  assert.equal(report.projectId, "project-X");
  assert.equal(report.totalExpected, 2);
  assert.equal(report.totalDetected, 2);
  assert.equal(report.truePositives, 1); // F1 matches GT1
  assert.equal(report.falsePositives, 1); // F2 doesn't match
  assert.equal(report.falseNegatives, 1); // GT2 not detected
  assert.equal(report.precision, 0.5);
  assert.equal(report.recall, 0.5);
  assert.equal(report.f1Score, 0.5);
});
