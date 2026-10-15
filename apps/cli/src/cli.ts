#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import {
  CHAINS,
  DETECTORS,
  SRP_VERSION,
  capabilities,
  exceedsThreshold,
  loadProject,
  renderAuditReport,
  runAudit,
  summarizeReport,
  toSarif,
  verifyEvidenceBundle,
  type AuditReport,
  type Chain
} from "../../../packages/core/src/index.ts";

const HELP = `srp ${SRP_VERSION}: Security Reasoning Protocol

Usage:
  srp scan [path]            Scan a Foundry, Hardhat, or Anchor project (default: .)
      --chain <chain>        ${CHAINS.join(" | ")} (default: detected)
      --format <fmt>         text | json | summary | sarif | md (default: text)
      --out <file>           write output to a file instead of stdout
      --fail-on <severity>   exit 1 if a finding is at or above: none | low | medium | high | critical (default: high)
      --include-tests        also scan test/, script/, mocks
  srp doctor [--json]        Analyzers, detectors, and local tools available
  srp explain <detector>     What a detector looks for
  srp verify-bundle <file>   Check an evidence bundle's schema and digest
  srp mcp                    Run the MCP server on stdio for AI agents

Exit codes: 0 clean, 1 findings at or above --fail-on, 2 usage or input error.`;

function parse(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[index + 1];
      if (["include-tests", "json", "help"].includes(key)) flags[key] = true;
      else if (next === undefined || next.startsWith("--")) throw new UsageError(`--${key} needs a value`);
      else { flags[key] = next; index += 1; }
    } else if (arg === "-h") flags.help = true;
    else positional.push(arg);
  }
  return { positional, flags };
}

class UsageError extends Error {}

function text(report: AuditReport): string {
  const summary = summarizeReport(report);
  const lines = [`SRP ${SRP_VERSION}  ${summary.protocol} (${summary.chain})`, `coverage: ${summary.coverage.analyzedFiles}/${summary.coverage.files} files, ${summary.coverage.functions} functions, analyzers ${summary.coverage.analyzers.join(", ")}`, ""];
  if (!summary.findings.length) lines.push("No findings. That is not proof of safety; see unknowns below.");
  for (const finding of summary.findings) {
    lines.push(`${finding.proposedSeverity.toUpperCase().padEnd(8)} ${finding.location}  ${finding.title}`);
    lines.push(`         ${finding.detector}  status=${finding.status} confidence=${finding.confidence}`);
    for (const evidence of finding.evidence) lines.push(`         L${evidence.line}: ${evidence.excerpt}`);
    lines.push(`         fix: ${finding.remediation}`, "");
  }
  if (summary.unknowns.length) {
    lines.push(`Not analyzed (${summary.unknowns.length}):`);
    for (const unknown of summary.unknowns) lines.push(`  [${unknown.severity}] ${unknown.file}: ${unknown.reason}`);
  }
  lines.push("", "Findings are static leads, not proofs. Run the generated harness (--format md) and attach results to prove them.");
  return lines.join("\n");
}

export async function main(argv: string[], io = { out: (value: string) => process.stdout.write(value), err: (value: string) => process.stderr.write(value) }): Promise<number> {
  try {
    const { positional, flags } = parse(argv);
    const [command = "help", ...rest] = positional;
    if (flags.help || command === "help") { io.out(`${HELP}\n`); return 0; }
    if (command === "version" || command === "--version") { io.out(`${SRP_VERSION}\n`); return 0; }
    if (command === "doctor" || command === "capabilities") {
      const caps = capabilities();
      if (flags.json) { io.out(`${JSON.stringify(caps, null, 2)}\n`); return 0; }
      io.out([`srp ${caps.version}  report schema ${caps.reportSchema}`, `chains: ${caps.chains.join(", ")}`, "analyzers:", ...caps.analyzers.map((a) => `  ${a.id}: ${a.description}`), `detectors: ${caps.detectors.length}`, "tools:", ...caps.tools.map((t) => `  ${t.available ? "ok " : "-- "} ${t.id}${t.version ? ` (${t.version})` : ""}: ${t.purpose}`), "not built yet:", ...caps.notBuilt.map((item) => `  - ${item}`)].join("\n") + "\n");
      return 0;
    }
    if (command === "explain") {
      const detector = DETECTORS.find((item) => item.id === rest[0]);
      if (!detector) throw new UsageError(`Unknown detector. Known: ${DETECTORS.map((item) => item.id).join(", ")}`);
      io.out(`${detector.id} (${detector.chain}, ${detector.analyzer}, ${detector.severity})\n${detector.summary}\nDetails: docs/detectors.md\n`);
      return 0;
    }
    if (command === "verify-bundle") {
      if (!rest[0]) throw new UsageError("verify-bundle needs a file");
      const bundle = verifyEvidenceBundle(JSON.parse(readFileSync(rest[0], "utf8")));
      io.out(`valid: ${bundle.findings.length} findings, ${bundle.unknowns.length} unknowns, digest ${bundle.digest}\n`);
      return 0;
    }
    if (command === "mcp") {
      const { runMcpStdio } = await import("../../mcp/src/server.ts");
      await runMcpStdio();
      return 0;
    }
    if (command === "scan") {
      const chain = flags.chain as Chain | undefined;
      if (chain && !CHAINS.includes(chain)) throw new UsageError(`--chain must be one of ${CHAINS.join(", ")}`);
      const format = String(flags.format ?? "text");
      if (!["text", "json", "summary", "sarif", "md"].includes(format)) throw new UsageError("--format must be text, json, summary, sarif, or md");
      const failOn = String(flags["fail-on"] ?? "high");
      const project = loadProject(rest[0] ?? ".", { chain, includeTests: Boolean(flags["include-tests"]) });
      const report = runAudit(project.input);
      report.unknowns.push(...project.skipped);
      const output = format === "json" ? JSON.stringify(report, null, 2)
        : format === "summary" ? JSON.stringify(summarizeReport(report), null, 2)
        : format === "sarif" ? JSON.stringify(toSarif(report), null, 2)
        : format === "md" ? renderAuditReport(report)
        : text(report);
      if (typeof flags.out === "string") writeFileSync(flags.out, `${output}\n`);
      else io.out(`${output}\n`);
      return exceedsThreshold(report, failOn) ? 1 : 0;
    }
    throw new UsageError(`Unknown command: ${command}\n\n${HELP}`);
  } catch (error) {
    io.err(`srp: ${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
}

const invokedDirectly = process.argv[1] !== undefined && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (invokedDirectly) main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
