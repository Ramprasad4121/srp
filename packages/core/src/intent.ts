import type { ProtocolInput, ProtocolIntent } from "./types.ts";
import { keywordSentences, stableId } from "./utils.ts";

const ACTOR_WORDS = ["owner", "admin", "governor", "guardian", "keeper", "validator", "authority", "multisig"];
const ASSET_WORDS = ["treasury", "vault", "pool", "bridge", "oracle", "collateral", "liquidity", "stake", "reward"];
const GUARANTEE_WORDS = ["must", "only", "guarantee", "invariant", "ensure", "prevent", "permission"];

export function buildProtocolIntent(input: ProtocolInput): ProtocolIntent {
  const corpus = [...input.documents.map((doc) => doc.content), ...input.sources.map((source) => source.content)].join("\n");
  const lower = corpus.toLowerCase();
  const assumptions = extractAssumptions(corpus, lower);
  const securityGuarantees = keywordSentences(corpus, GUARANTEE_WORDS, 8);
  const trustBoundaries = extractTrustBoundaries(lower);
  const attackSurfaces = extractAttackSurfaces(lower);
  const invariants = extractInvariants(corpus, lower);
  const assets = unique(ASSET_WORDS.filter((word) => lower.includes(word)));
  const actors = unique(ACTOR_WORDS.filter((word) => lower.includes(word)));
  const entrypoints = extractEntrypoints(input);
  const nodes = [
    { id: "protocol", type: "protocol", label: input.name },
    ...assets.map((asset) => ({ id: `asset:${asset}`, type: "asset", label: asset })),
    ...actors.map((actor) => ({ id: `actor:${actor}`, type: "actor", label: actor })),
    ...entrypoints.map((entrypoint) => ({ id: `entrypoint:${entrypoint}`, type: "entrypoint", label: entrypoint }))
  ];
  const edges = [
    ...assets.map((asset) => ({ from: "protocol", to: `asset:${asset}`, relation: "custodies" })),
    ...actors.map((actor) => ({ from: `actor:${actor}`, to: "protocol", relation: "controls_or_observes" })),
    ...entrypoints.map((entrypoint) => ({ from: "protocol", to: `entrypoint:${entrypoint}`, relation: "exposes" }))
  ];

  return {
    assumptions,
    securityGuarantees,
    trustBoundaries,
    attackSurfaces,
    invariants,
    knowledgeGraph: { nodes, edges },
    threatModel: {
      assets: assets.length ? assets : ["protocol state"],
      actors: actors.length ? actors : ["external user", "protocol operator"],
      entrypoints,
      abuseCases: attackSurfaces.map((surface) => `Abuse ${surface} to violate protocol guarantees`)
    }
  };
}

function extractAssumptions(corpus: string, lower: string): string[] {
  const assumptions = keywordSentences(corpus, ["assume", "trusted", "expected", "requires"], 6);
  if (lower.includes("oracle")) assumptions.push("Oracle prices are assumed to be fresh and manipulation resistant.");
  if (lower.includes("upgrade")) assumptions.push("Upgrade authority is assumed to be correctly governed and delay-protected.");
  return unique(assumptions);
}

function extractTrustBoundaries(lower: string): string[] {
  const boundaries = [];
  if (lower.includes("onlyowner") || lower.includes("owner")) boundaries.push("Privileged owner/admin boundary");
  if (lower.includes("oracle")) boundaries.push("External oracle data boundary");
  if (lower.includes("bridge")) boundaries.push("Cross-chain bridge message boundary");
  if (lower.includes("cpi") || lower.includes("program_id")) boundaries.push("Solana CPI program boundary");
  return boundaries.length ? boundaries : ["Public user to protocol contract boundary"];
}

function extractAttackSurfaces(lower: string): string[] {
  const surfaces = [];
  if (lower.includes("withdraw") || lower.includes("transfer")) surfaces.push("asset withdrawal and transfer flow");
  if (lower.includes("liquidat")) surfaces.push("liquidation flow");
  if (lower.includes("reward") || lower.includes("stake")) surfaces.push("staking and reward accounting");
  if (lower.includes("upgrade")) surfaces.push("upgrade administration");
  if (lower.includes("govern")) surfaces.push("governance execution");
  if (lower.includes("oracle")) surfaces.push("oracle price consumption");
  if (lower.includes("invoke") || lower.includes("cpi")) surfaces.push("cross-program invocation");
  return surfaces.length ? surfaces : ["public transaction entrypoints"];
}

function extractInvariants(corpus: string, lower: string): string[] {
  const invariants = keywordSentences(corpus, ["invariant", "must never", "total", "solvent", "conservation"], 8);
  if (lower.includes("vault") || lower.includes("pool")) invariants.push("Protocol accounting must remain solvent after deposits, withdrawals, and liquidations.");
  if (lower.includes("reward")) invariants.push("Rewards distributed must not exceed rewards accrued.");
  return unique(invariants);
}

function extractEntrypoints(input: ProtocolInput): string[] {
  const entries = new Set<string>();
  for (const source of input.sources) {
    for (const match of source.content.matchAll(/\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) entries.add(match[1] ?? "function");
    for (const match of source.content.matchAll(/\bpub\s+fn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) entries.add(match[1] ?? "instruction");
  }
  return [...entries].slice(0, 24);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function intentId(input: ProtocolInput): string {
  return stableId("intent", `${input.name}:${input.chain}:${input.sources.map((source) => source.path).join(",")}`);
}
