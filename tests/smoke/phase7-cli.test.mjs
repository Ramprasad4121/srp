/**
 * Smoke tests: Phase-7 CLI Methodology Execution
 *
 * Tests that the srp command-line tool can correctly resolve bootstrap,
 * start an audit session, and track it to completion.
 */

import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function makeFreshRoot() {
  const root = await mkdtemp(join(tmpdir(), "srp-cli-"));
  // Create a minimal manifest so it's "ready"
  const manifest = {
    version: "0.1.0",
    updatedAt: new Date().toISOString(),
    approvedDomains: [],
    state: {
      currentStep: "ready",
      completedSteps: ["welcome", "role-selection", "providers", "toolchain", "skills", "workspace", "ui-preferences"],
      role: "auditor",
      providers: [
        { kind: "openai-compatible", label: "Local", model: "mock", enabled: true }
      ],
      workspace: {
        rootDirectory: root,
        outputDirectory: ".srp",
        useDockerToolchains: false,
        internetMode: "local-only"
      }
    }
  };
  const configDir = join(root, ".srp/config");
  await mkdir(configDir, { recursive: true });
  await writeFile(join(configDir, "setup.json"), JSON.stringify(manifest));
  return root;
}

function runSrp(args, cwd) {
  return new Promise((resolve) => {
    const srpPath = join(process.cwd(), "apps/cli/dist/bin.js");
    const child = spawn("node", [srpPath, ...args], { 
      cwd,
      env: { ...process.env, OPENAI_COMPATIBLE_BASE_URL: "http://mock" }
    });
    
    let stdout = "";
    let stderr = "";
    
    child.stdout.on("data", (data) => stdout += data);
    child.stderr.on("data", (data) => stderr += data);
    
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("Phase-7 CLI: srp --help", async () => {
  const root = await makeFreshRoot();
  try {
    const { code, stdout } = await runSrp(["--help"], root);
    assert.equal(code, 0);
    assert.ok(stdout.includes("Usage:"));
    assert.ok(stdout.includes("audit"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Phase-7 CLI: srp audit (happy path)", async () => {
  const root = await makeFreshRoot();
  try {
    // This will run the simulated pipeline which takes some time
    // but the bin.ts we wrote uses a loop to wait.
    const { code, stdout, stderr } = await runSrp(["audit"], root);
    
    if (code !== 0) {
      console.log("CLI STDOUT:", stdout);
      console.log("CLI STDERR:", stderr);
    }
    assert.equal(code, 0);
    assert.ok(stdout.includes("Starting SRP Audit methodology"));
    assert.ok(stdout.includes("discovery-docs"));
    assert.ok(stdout.includes("Audit methodology completed successfully"));
    assert.ok(stdout.includes("Report generated"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Phase-7 CLI: srp dev", async () => {
  const root = await makeFreshRoot();
  try {
    const { code, stdout } = await runSrp(["dev"], root);
    assert.equal(code, 0);
    assert.ok(stdout.includes("Opening SRP Developer Workbench"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
