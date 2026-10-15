import { spawnSync } from "node:child_process";
import { CHAINS } from "./audit.ts";
import { DETECTORS } from "./catalog.ts";

export interface Capabilities {
  schemaVersion: "srp.capabilities/v1";
  version: string;
  reportSchema: "srp.audit/v1";
  chains: string[];
  analyzers: Array<{ id: string; languages: string[]; chains: string[]; description: string }>;
  detectors: typeof DETECTORS;
  /** Local tools SRP can point you at for running PoCs. SRP never runs them itself. */
  tools: Array<{ id: string; available: boolean; version?: string; purpose: string }>;
  notBuilt: string[];
}

export const SRP_VERSION = "0.2.0";

function probe(command: string, args: string[]): { available: boolean; version?: string } {
  try {
    const result = spawnSync(command, args, { encoding: "utf8", timeout: 3000 });
    if (result.status !== 0) return { available: false };
    return { available: true, version: (result.stdout || result.stderr).trim().split("\n")[0] };
  } catch {
    return { available: false };
  }
}

/** The doctor: what this SRP install can analyze and which local tools are present. */
export function capabilities(probeTools = true): Capabilities {
  const tool = (id: string, command: string, args: string[], purpose: string) => ({ id, purpose, ...(probeTools ? probe(command, args) : { available: false }) });
  return {
    schemaVersion: "srp.capabilities/v1",
    version: SRP_VERSION,
    reportSchema: "srp.audit/v1",
    chains: CHAINS,
    analyzers: [
      { id: "srp-structural", languages: ["solidity"], chains: CHAINS.filter((chain) => chain !== "solana"), description: "Per-function Solidity index: visibility, modifiers, params, state writes." },
      { id: "srp-anchor", languages: ["rust"], chains: ["solana"], description: "Anchor #[derive(Accounts)] constraints and #[account] data structs." },
      { id: "srp-pattern", languages: ["solidity"], chains: CHAINS.filter((chain) => chain !== "solana"), description: "Guarded file-level patterns on comment-stripped source." }
    ],
    detectors: DETECTORS,
    tools: [
      tool("forge", "forge", ["--version"], "Run generated Foundry harnesses, then attach the result as a proof."),
      tool("anchor", "anchor", ["--version"], "Run Anchor tests for Solana PoCs."),
      tool("solc", "solc", ["--version"], "Not used yet; planned for AST-based analysis.")
    ],
    notBuilt: [
      "LLM reasoning (all steps are deterministic and offline)",
      "Exploit execution inside SRP",
      "Cross-file analysis (inheritance, imports, cross-contract calls)",
      "Native (non-Anchor) Solana analysis"
    ]
  };
}
