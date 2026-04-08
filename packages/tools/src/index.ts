import type { ToolchainExecution } from "@srp/shared-types";

export * from "./adapters/slither.js";
export * from "./adapters/forge.js";
export * from "./adapters/aderyn.js";
export * from "./adapters/sc-auditor/run-slither.js";
export * from "./adapters/sc-auditor/run-aderyn.js";
export * from "./adapters/sc-auditor/run-echidna.js";
export * from "./adapters/sc-auditor/run-halmos.js";
export * from "./adapters/sc-auditor/run-medusa.js";
export * from "./adapters/sc-auditor/search-findings.js";
export * from "./adapters/sc-auditor/get-checklist.js";
export * from "./adapters/sc-auditor/generate-foundry-poc.js";

/**
 * Supported toolchain identifiers per the master plan.
 */
export type ToolchainId =
  | "foundry"
  | "anvil"
  | "hardhat"
  | "slither"
  | "aderyn"
  | "echidna"
  | "docker"
  | "sc-auditor"
  | "agent";

/**
 * Describes a toolchain integration.
 */
export interface ToolchainDefinition {
  readonly id: ToolchainId;
  readonly name: string;
  readonly description: string;
  readonly command: string;
  readonly requiresDocker: boolean;
  readonly categories: readonly ("testing" | "static-analysis" | "fuzzing" | "forking")[];
}

/**
 * Registry of all supported toolchain integrations.
 */
export const TOOLCHAIN_REGISTRY: readonly ToolchainDefinition[] = [
  {
    id: "foundry",
    name: "Foundry",
    description: "Blazing fast Solidity development framework with built-in testing via Forge.",
    command: "forge",
    requiresDocker: false,
    categories: ["testing"]
  },
  {
    id: "anvil",
    name: "Anvil",
    description: "Local Ethereum development node, part of the Foundry suite.",
    command: "anvil",
    requiresDocker: false,
    categories: ["forking"]
  },
  {
    id: "hardhat",
    name: "Hardhat",
    description: "Ethereum development environment for compiling, testing, deploying, and debugging.",
    command: "npx hardhat",
    requiresDocker: false,
    categories: ["testing"]
  },
  {
    id: "slither",
    name: "Slither",
    description: "Static analysis framework for Solidity. Detects vulnerabilities and code quality issues.",
    command: "slither",
    requiresDocker: true,
    categories: ["static-analysis"]
  },
  {
    id: "aderyn",
    name: "Aderyn",
    description: "Rust-based static analyzer for Solidity smart contracts.",
    command: "aderyn",
    requiresDocker: false,
    categories: ["static-analysis"]
  },
  {
    id: "echidna",
    name: "Echidna",
    description: "Property-based fuzzer for Ethereum smart contracts.",
    command: "echidna",
    requiresDocker: true,
    categories: ["fuzzing"]
  },
  {
    id: "docker",
    name: "Docker",
    description: "Container runtime for isolated tool execution.",
    command: "docker",
    requiresDocker: false,
    categories: []
  },
  {
    id: "sc-auditor",
    name: "SC-Auditor",
    description: "Orchestrated security auditing toolsuite.",
    command: "node",
    requiresDocker: false,
    categories: ["static-analysis", "fuzzing"]
  }
];

/**
 * Describes the health status of a toolchain.
 */
export interface ToolchainHealthCheck {
  readonly id: ToolchainId;
  readonly available: boolean;
  readonly version?: string;
  readonly errorMessage?: string;
}

/**
 * Returns the definition for a given toolchain ID.
 */
export function getToolchainDefinition(id: ToolchainId): ToolchainDefinition {
  const definition = TOOLCHAIN_REGISTRY.find((t) => t.id === id);
  if (!definition) {
    throw new Error(`Unknown toolchain: ${id}`);
  }
  return definition;
}

/**
 * Describes the approval model for tool execution.
 */
export type ApprovalLevel = "auto" | "confirm" | "deny";

export interface ToolExecutionRequest {
  readonly toolchainId: ToolchainId;
  readonly command: string;
  readonly args: readonly string[];
  readonly workingDirectory: string;
  readonly approvalLevel: ApprovalLevel;
  readonly timeoutMs: number;
}

export interface ToolExecutionResult {
  readonly toolchainId: ToolchainId;
  readonly success: boolean;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
}

/**
 * Creates a typed toolchain execution result compatible with the shared-types contract.
 */
export function toToolchainExecution(
  result: ToolExecutionResult
): ToolchainExecution {
  return {
    tool: result.toolchainId,
    success: result.success,
    logs: result.stdout + (result.stderr ? `\n--- stderr ---\n${result.stderr}` : ""),
    generatedAt: new Date().toISOString()
  };
}
