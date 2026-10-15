import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";
import type { AuditReport, Chain, ProtocolInput, ResidualUnknown, SourceFile } from "./types.ts";
import { stableId } from "./utils.ts";

export interface LoadOptions {
  chain?: Chain;
  includeTests?: boolean;
  maxFiles?: number;
  maxFileBytes?: number;
}

export interface LoadedProject {
  input: ProtocolInput;
  /** Files skipped for size or count limits; added to the report's unknowns. */
  skipped: ResidualUnknown[];
  framework: "foundry" | "hardhat" | "anchor" | "solana" | "plain";
}

const ALWAYS_SKIP = new Set(["node_modules", ".git", "out", "cache", "artifacts", "target", "typechain", "typechain-types", "coverage", ".anchor", "dist", "build"]);
const TEST_DIRS = new Set(["test", "tests", "script", "scripts", "mocks", "mock", "echidna", "certora", "audits", "fuzz", "invariant", "invariants"]);

/** Zero-config: detect the framework and chain, collect contracts, and use the README as a protocol document. */
export function loadProject(path: string, options: LoadOptions = {}): LoadedProject {
  const root = resolve(path);
  if (!existsSync(root)) throw new Error(`Path not found: ${path}`);
  const isFile = statSync(root).isFile();
  const dir = isFile ? resolve(root, "..") : root;
  const framework: LoadedProject["framework"] = existsSync(join(dir, "Anchor.toml")) ? "anchor"
    : existsSync(join(dir, "foundry.toml")) ? "foundry"
    : ["hardhat.config.ts", "hardhat.config.js", "hardhat.config.cjs"].some((name) => existsSync(join(dir, name))) ? "hardhat"
    : existsSync(join(dir, "Cargo.toml")) && /solana-program|anchor-lang/.test(readFileSync(join(dir, "Cargo.toml"), "utf8")) ? "solana"
    : "plain";
  const maxFiles = options.maxFiles ?? 2000;
  const maxBytes = options.maxFileBytes ?? 1024 * 1024;
  const files = isFile ? [root] : walk(root, options.includeTests ?? false);
  const solidity = files.filter((file) => file.endsWith(".sol"));
  const rust = files.filter((file) => file.endsWith(".rs"));
  const chain: Chain = options.chain ?? (framework === "anchor" || framework === "solana" || (rust.length && !solidity.length) ? "solana" : "ethereum");
  const wanted = chain === "solana" ? rust : solidity;
  const skipped: ResidualUnknown[] = [];
  const sources: SourceFile[] = [];
  for (const file of wanted) {
    const rel = isFile ? basename(file) : relative(root, file);
    const size = statSync(file).size;
    if (sources.length >= maxFiles) {
      skipped.push({ unknownId: stableId("unk", `limit:${rel}`), file: rel, question: `Is ${rel} vulnerable?`, reason: `Skipped: over the ${maxFiles}-file limit.`, severity: "medium" });
      continue;
    }
    if (size > maxBytes) {
      skipped.push({ unknownId: stableId("unk", `size:${rel}`), file: rel, question: `Is ${rel} vulnerable?`, reason: `Skipped: ${size} bytes is over the ${maxBytes}-byte limit.`, severity: "medium" });
      continue;
    }
    const content = readFileSync(file, "utf8");
    if (!content.trim()) continue;
    sources.push({ path: rel, language: extname(file) === ".rs" ? "rust" : "solidity", content });
  }
  const readme = ["README.md", "readme.md", "README"].map((name) => join(dir, name)).find((file) => existsSync(file));
  const documents = readme ? [{ path: basename(readme), kind: "README" as const, content: readFileSync(readme, "utf8").slice(0, 200_000) }] : [];
  if (!sources.length && !documents.length) throw new Error(`No ${chain === "solana" ? ".rs" : ".sol"} files found under ${path}`);
  return { input: { name: basename(dir), chain, documents, sources }, skipped, framework };
}

function walk(dir: string, includeTests: boolean): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith(".") && name !== ".") continue;
    const path = join(dir, name);
    let stat;
    try { stat = statSync(path); } catch { continue; }
    if (stat.isDirectory()) {
      if (ALWAYS_SKIP.has(name) || name === "lib" || (!includeTests && TEST_DIRS.has(name))) continue;
      out.push(...walk(path, includeTests));
    } else if (/\.(sol|rs)$/.test(name) && (includeTests || !/\.t\.sol$|\.s\.sol$/.test(name))) {
      out.push(path);
    }
  }
  return out;
}

const RANK: Record<string, number> = { informational: 0, low: 1, medium: 2, high: 3, critical: 4 };

/** Compact, stable view for agents and CI: one line of truth per finding. Schema srp.summary/v1. */
export function summarizeReport(report: AuditReport) {
  const bySeverity: Record<string, number> = {};
  for (const finding of report.findings) {
    const severity = finding.proposedSeverity ?? finding.severity;
    bySeverity[severity] = (bySeverity[severity] ?? 0) + 1;
  }
  return {
    schemaVersion: "srp.summary/v1" as const,
    auditId: report.id,
    protocol: report.protocol.name,
    chain: report.protocol.chain,
    coverage: report.coverage,
    counts: { findings: report.findings.length, proven: report.findings.filter((finding) => finding.status === "proven").length, unknowns: report.unknowns.length, bySeverity },
    findings: [...report.findings]
      .sort((a, b) => (RANK[b.proposedSeverity ?? b.severity] ?? 0) - (RANK[a.proposedSeverity ?? a.severity] ?? 0) || b.confidence - a.confidence)
      .map((finding) => ({
        id: finding.id,
        detector: finding.detector,
        title: finding.title,
        severity: finding.severity,
        proposedSeverity: finding.proposedSeverity ?? finding.severity,
        status: finding.status,
        confidence: finding.confidence,
        location: `${finding.evidence[0]?.file}:${finding.evidence[0]?.startLine}`,
        evidence: finding.evidence.map((evidence) => ({ evidenceId: evidence.evidenceId, file: evidence.file, line: evidence.startLine, excerpt: evidence.excerpt, kind: evidence.kind, rationale: evidence.rationale })),
        facts: finding.context?.facts ?? [],
        remediation: finding.remediation
      })),
    unknowns: report.unknowns
  };
}

/** True when any finding's proposed severity is at or above the threshold. */
export function exceedsThreshold(report: AuditReport, threshold: string): boolean {
  if (threshold === "none") return false;
  const limit = RANK[threshold];
  if (limit === undefined) throw new Error(`--fail-on must be one of none, low, medium, high, critical`);
  return report.findings.some((finding) => (RANK[finding.proposedSeverity ?? finding.severity] ?? 0) >= limit);
}
