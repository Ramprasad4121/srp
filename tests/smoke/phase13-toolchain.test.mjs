/**
 * Smoke tests: Phase-13 Toolchain Adapters
 *
 * Tests the native TypeScript adapters for parsing structured tool outputs
 * from Slither and Forge.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { SlitherAdapter, ForgeAdapter } from "../../packages/tools/dist/index.js";

test("Phase-13 Toolchain: Slither Adapter (JSON parsing)", () => {
  const adapter = new SlitherAdapter();
  const mockResult = {
    toolchainId: "slither",
    success: true,
    exitCode: 0,
    stdout: JSON.stringify({
      results: {
        detectors: [
          {
            check: "reentrancy-eth",
            impact: "High",
            confidence: "High",
            description: "Reentrancy vulnerability",
            elements: [
              {
                type: "function",
                name: "withdraw",
                source_mapping: { filename_relative: "Contract.sol", lines: [10, 11] }
              }
            ]
          }
        ]
      }
    }),
    stderr: "",
    durationMs: 100
  };

  const findings = adapter.parse(mockResult);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].check, "reentrancy-eth");
  assert.equal(findings[0].impact, "High");
});

test("Phase-13 Toolchain: Forge Adapter (JSON parsing)", () => {
  const adapter = new ForgeAdapter();
  const mockResult = {
    toolchainId: "foundry",
    success: true,
    exitCode: 0,
    stdout: JSON.stringify({
      "test/Contract.t.sol:ContractTest": {
        test_results: {
          "testWithdraw()": {
            status: "Success",
            gas_used: 1000
          },
          "testFailDeposit()": {
            status: "Failure",
            gas_used: 500,
            reason: "Insufficient funds"
          }
        }
      }
    }),
    stderr: "",
    durationMs: 200
  };

  const results = adapter.parse(mockResult);
  assert.equal(results.length, 2);
  assert.ok(results.some(r => r.name === "testWithdraw()" && r.status === "success"));
  assert.ok(results.some(r => r.name === "testFailDeposit()" && r.status === "failure"));
});

test("Phase-13 Toolchain: Forge Adapter (Text fallback)", () => {
  const adapter = new ForgeAdapter();
  const mockResult = {
    toolchainId: "foundry",
    success: true,
    exitCode: 0,
    stdout: "[PASS] testExample()\n[FAIL] testFailingExample()",
    stderr: "",
    durationMs: 50
  };

  const results = adapter.parse(mockResult);
  assert.equal(results.length, 2);
  assert.ok(results.some(r => r.name === "testExample" && r.status === "success"));
  assert.ok(results.some(r => r.name === "testFailingExample" && r.status === "failure"));
});
