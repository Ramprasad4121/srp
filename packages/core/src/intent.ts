import type { ProtocolInput, ProtocolIntent } from "./types.ts";
import { keywordSentences, stableId } from "./utils.ts";

const ACTOR_WORDS = ["owner", "admin", "governor", "guardian", "keeper", "validator", "authority", "multisig", "timelock", "relayer", "operator", "liquidator", "minter", "burner"];
const ASSET_WORDS = ["treasury", "vault", "pool", "bridge", "oracle", "collateral", "liquidity", "stake", "reward", "lending", "borrowing", "swap", "fee", "reserve", "insurance", "debt", "token"];
const GUARANTEE_WORDS = ["must", "only", "guarantee", "invariant", "ensure", "prevent", "permission", "shall", "never", "always", "require", "restrict", "validate", "enforce", "protect"];

export function buildProtocolIntent(input: ProtocolInput): ProtocolIntent {
  const corpus = [...input.documents.map((doc) => doc.content), ...input.sources.map((source) => source.content)].join("\n");
  const lower = corpus.toLowerCase();
  const assumptions = extractAssumptions(corpus, lower);
  const securityGuarantees = keywordSentences(corpus, GUARANTEE_WORDS, 8);
  const trustBoundaries = extractTrustBoundaries(lower);
  const attackSurfaces = extractAttackSurfaces(lower);
  const invariants = extractInvariants(corpus, lower);
  const defiPrimitives = extractDeFiPrimitives(lower);
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
    ...assets.map((asset) => ({ from: "protocol", to: `asset:${asset}`, relation: "manages" })),
    ...actors.map((actor) => ({ from: `actor:${actor}`, to: "protocol", relation: "interacts" })),
    ...entrypoints.map((entrypoint) => ({ from: "protocol", to: `entrypoint:${entrypoint}`, relation: "exposes" }))
  ];
  const abuseCases = [
    ...attackSurfaces.map((surface) => `Abuse via ${surface}`),
    ...(lower.includes("flash") ? ["Flash loan amplified attack on price-sensitive logic"] : []),
    ...(lower.includes("delegate") ? ["Malicious delegate escalation"] : []),
    ...(lower.includes("upgrade") ? ["Unauthorized implementation upgrade"] : [])
  ];
  return {
    assumptions,
    securityGuarantees,
    trustBoundaries,
    attackSurfaces,
    invariants,
    defiPrimitives,
    knowledgeGraph: { nodes, edges },
    threatModel: { assets, actors, entrypoints, abuseCases }
  };
}

function extractAssumptions(corpus: string, lower: string): string[] {
  const assumptions = keywordSentences(corpus, ["assum", "expect", "trust", "rely", "depend"], 6);
  if (lower.includes("solana")) assumptions.push("Solana runtime enforces single-writer account locking.");
  if (lower.includes("evm") || lower.includes("solidity") || lower.includes("contract")) assumptions.push("EVM execution follows sequential transaction ordering within blocks.");
  if (lower.includes("oracle")) assumptions.push("Oracle feeds are assumed to be accurate and timely.");
  return unique(assumptions);
}

function extractTrustBoundaries(lower: string): string[] {
  const boundaries = [];
  if (lower.includes("external") || lower.includes("untrusted")) boundaries.push("external callers and untrusted inputs");
  if (lower.includes("admin") || lower.includes("owner") || lower.includes("governor")) boundaries.push("administrative and governance operations");
  if (lower.includes("oracle") || lower.includes("price")) boundaries.push("oracle data feeds and price sources");
  if (lower.includes("bridge") || lower.includes("cross")) boundaries.push("cross-chain and bridge message boundaries");
  if (lower.includes("upgrade") || lower.includes("proxy")) boundaries.push("contract upgrade and proxy administration");
  if (lower.includes("timelock") || lower.includes("delay")) boundaries.push("timelocked operations and delay enforcement");
  if (lower.includes("multisig")) boundaries.push("multi-signature authorization boundaries");
  return boundaries.length ? boundaries : ["public transaction entrypoints"];
}

function extractAttackSurfaces(lower: string): string[] {
  const surfaces = [];
  if (lower.includes("deposit") || lower.includes("withdraw") || lower.includes("transfer")) surfaces.push("deposit, withdrawal, and transfer flow");
  if (lower.includes("liquidat")) surfaces.push("liquidation flow");
  if (lower.includes("reward") || lower.includes("stake")) surfaces.push("staking and reward accounting");
  if (lower.includes("upgrade")) surfaces.push("upgrade administration");
  if (lower.includes("govern")) surfaces.push("governance execution");
  if (lower.includes("oracle")) surfaces.push("oracle price consumption");
  if (lower.includes("invoke") || lower.includes("cpi")) surfaces.push("cross-program invocation");
  if (lower.includes("flash")) surfaces.push("flash loan interaction surface");
  if (lower.includes("swap") || lower.includes("amm")) surfaces.push("token swap and AMM operations");
  if (lower.includes("lend") || lower.includes("borrow")) surfaces.push("lending and borrowing operations");
  if (lower.includes("mint") || lower.includes("burn")) surfaces.push("token minting and burning operations");
  return surfaces.length ? surfaces : ["public transaction entrypoints"];
}

function extractInvariants(corpus: string, lower: string): string[] {
  const invariants = keywordSentences(corpus, ["invariant", "must never", "total", "solvent", "conservation"], 8);
  if (lower.includes("vault") || lower.includes("pool")) invariants.push("Protocol accounting must remain solvent after deposits, withdrawals, and liquidations.");
  if (lower.includes("reward")) invariants.push("Rewards distributed must not exceed rewards accrued.");
  if (lower.includes("collateral")) invariants.push("Collateral ratio must remain above minimum threshold at all times.");
  if (lower.includes("token") && lower.includes("supply")) invariants.push("Token supply must equal sum of all holder balances.");
  return unique(invariants);
}

function extractDeFiPrimitives(lower: string): string[] {
  const primitives: string[] = [];
  if (lower.includes("swap") || lower.includes("amm") || lower.includes("dex") || lower.includes("liquidity pool")) primitives.push("AMM/DEX");
  if (lower.includes("lend") || lower.includes("borrow") || lower.includes("collateral") || lower.includes("liquidat")) primitives.push("Lending/Borrowing");
  if (lower.includes("yield") || lower.includes("farm") || lower.includes("harvest") || lower.includes("compound")) primitives.push("Yield Farming");
  if (lower.includes("stake") || lower.includes("unstake") || lower.includes("validator") || lower.includes("delegation")) primitives.push("Staking");
  if (lower.includes("govern") || lower.includes("proposal") || lower.includes("vote") || lower.includes("quorum")) primitives.push("Governance");
  if (lower.includes("bridge") || lower.includes("cross-chain") || lower.includes("relay")) primitives.push("Bridge");
  if (lower.includes("oracle") || lower.includes("price feed") || lower.includes("chainlink")) primitives.push("Oracle");
  if (lower.includes("insurance") || lower.includes("coverage") || lower.includes("underwrite")) primitives.push("Insurance");
  if (lower.includes("derivative") || lower.includes("perpetual") || lower.includes("option") || lower.includes("future")) primitives.push("Derivatives");
  if (lower.includes("nft") || lower.includes("erc721") || lower.includes("erc1155") || lower.includes("collectible")) primitives.push("NFT");
  if (lower.includes("vault") || lower.includes("strategy") || lower.includes("aggregat")) primitives.push("Vault/Aggregator");
  return primitives;
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
