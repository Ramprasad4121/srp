import { spawn } from "node:child_process";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import type { ToolchainExecution } from "@srp/shared-types";

export async function runToolchainWorkflows(
  rootDirectory: string,
  workspaceAnalysis: { readonly isFoundry: boolean; readonly isHardhat: boolean },
  context: { readonly runId: string; readonly projectId: string }
): Promise<ToolchainExecution> {
  const mode = process.env.SRP_TOOLCHAIN_MODE ?? "real";
  if (mode === "mock") {
    return {
      tool: "mock",
      success: true,
      logs: "Mock execution (SRP_TOOLCHAIN_MODE=mock).",
      generatedAt: new Date().toISOString()
    };
  }

  const command = workspaceAnalysis.isFoundry ? "forge" : workspaceAnalysis.isHardhat ? "npx" : null;
  const args = workspaceAnalysis.isFoundry
    ? ["test"]
    : workspaceAnalysis.isHardhat
      ? ["hardhat", "test"]
      : null;

  if (!command || !args) {
    return {
      tool: "none",
      success: true,
      logs: "No toolchain detected (neither Foundry nor Hardhat).",
      generatedAt: new Date().toISOString()
    };
  }

  const spawnArgs = workspaceAnalysis.isFoundry ? args : args;
  const cwd = rootDirectory;

  const child = spawn(command, spawnArgs, {
    cwd,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  const chunks: string[] = [];

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => chunks.push(chunk));
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => chunks.push(chunk));

  const exitCode = await new Promise<number>((resolve) => {
    child.on("close", (code) => resolve(code ?? 0));
    child.on("error", () => resolve(1));
  });

  const logs = chunks.join("");

  return {
    tool: workspaceAnalysis.isFoundry ? "forge test" : "npx hardhat test",
    success: exitCode === 0,
    logs: logs || "No output captured.",
    generatedAt: new Date().toISOString()
  };
}
