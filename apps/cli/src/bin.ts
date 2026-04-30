#!/usr/bin/env node

import { resolveAppBootstrap, createGatewayServer } from "@srp/gateway";
import { startSession, getSessionState } from "@srp/gateway";
import { loadOrCreateSetupManifest, saveSetupManifest } from "@srp/config";
import { setTimeout } from "node:timers/promises";
import type { PhaseState, RuntimeMode } from "@srp/shared-types";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { spawn } from "node:child_process";
import { runSetupWizard } from "./onboarding/wizard.js";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  const rootDir = process.cwd();
  const env = process.env;

  try {
    const bootstrap = await resolveAppBootstrap(rootDir, env);

    if (command === "audit") {
      await runAudit(rootDir, bootstrap);
    } else if (command === "dev") {
      await runDev(rootDir, bootstrap);
    } else if (command === "setup" || command === "configure" || command === "config" || command === "onboard") {
      await runSetupWizard(rootDir);
    } else if (command === "gateway") {
      const subCommand = args[1];
      if (subCommand === "restart" || subCommand === "start") {
        await startGateway(rootDir);
      } else {
        console.error(`Unknown gateway command: ${subCommand}`);
        process.exit(1);
      }
    } else {
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
    }
  } catch (err) {
    console.error("CLI error:", err);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
SRP — Security Reasoning Protocol CLI

Usage:
  srp <command> [options]

Commands:
  audit             Start a methodology-faithful security audit of the current workspace
  dev               Open the developer workbench for smart contract engineering
  setup             Run the interactive onboarding and provider configuration
  configure         Alias for setup
  config            Alias for setup
  onboard           Alias for setup (OpenClaw style)
  gateway restart   Start or restart the SRP local host web UI
  --help            Show this help message
  `);
}

async function startGateway(rootDir: string) {
  console.log("🚀 Starting SRP Gateway...");
  const srv = await createGatewayServer({ port: 6969, rootDirectory: rootDir });
  const url = `http://localhost:${srv.port}`;

  console.log(`\n✅ SRP Web UI is running at: ${url}`);
  console.log("Press Ctrl+C to stop the server.\n");

  // Open browser automatically
  const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", url], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn(openCmd, [url], { detached: true, stdio: "ignore" }).unref();
  }

  // Handle shutdown
  return new Promise<void>((resolve) => {
    process.on("SIGINT", async () => {
      console.log("\n🛑 Stopping SRP Gateway...");
      
      // Safety timeout: force exit after 2 seconds
      global.setTimeout(() => {
        console.log("⚠️  Forcing exit...");
        process.exit(0);
      }, 2000);

      try {
        await srv.stop();
      } catch (err) {
        // Ignore stop errors
      }
      console.log("👋 Goodbye!");
      process.exit(0);
    });
  });
}

async function runAudit(rootDir: string, bootstrap: any) {
  if (bootstrap.decision !== "ready") {
    console.error(`Workspace not ready for audit. Status: ${bootstrap.decision}`);
    console.log(`Please run 'srp configure' or use the Web UI at http://localhost:6969`);
    process.exit(1);
  }

  const manifest = await loadOrCreateSetupManifest(rootDir);
  console.log(`🚀 Starting SRP Audit methodology...`);
  console.log(`Project: ${rootDir}`);
  console.log(`Role:    ${manifest.state.role}`);
  console.log(`---------------------------------------------------------------------------`);

  await startSession(rootDir, manifest.state.providers);

  let lastPhase = "";
  while (true) {
    const state = getSessionState();

    if (state.currentPhase && state.currentPhase !== lastPhase) {
      console.log(`[${new Date().toLocaleTimeString()}] Running: ${state.currentPhase}...`);
      lastPhase = state.currentPhase;
    }

    if (!state.isRunning) {
      // Final log for all phases
      for (const p of state.phases) {
        console.log(`- ${p.phase}: ${p.status}`);
      }

      if (state.phases.every((p: PhaseState) => p.status === "completed")) {
        console.log(`---------------------------------------------------------------------------`);
        console.log(`✅ Audit methodology completed successfully.`);
        if (state.formalReport) {
          console.log(`📄 Report generated: ${state.formalReport.title}`);
        }
      } else {
        console.log(`❌ Audit methodology stopped or failed.`);
      }
      break;
    }

    await setTimeout(100);
  }
}

async function runDev(rootDir: string, bootstrap: any) {
  console.log(`🚀 Opening SRP Developer Workbench...`);
  console.log(`Project: ${rootDir}`);
  console.log(`(Simulated Dev Session)`);
  // Dev session logic would go here
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
