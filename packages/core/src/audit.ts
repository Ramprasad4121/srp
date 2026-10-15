import type { AuditReport, Chain, Coverage, ProtocolInput, ResidualUnknown, SourceFile } from "./types.ts";
import { buildProtocolIntent } from "./intent.ts";
import { discoverVulnerabilities, isRust, isSolidity } from "./discovery.ts";
import { runDynaDebate } from "./debate.ts";
import { validateFindings } from "./poc.ts";
import { indexSolidity, stripComments } from "./solidity.ts";
import { indexAnchor } from "./anchor.ts";
import { stableId } from "./utils.ts";

export const CHAINS: Chain[] = ["ethereum", "arbitrum", "optimism", "base", "polygon", "avalanche", "solana"];

export type AuditStage = "intent" | "discovery" | "debate" | "validation" | "coverage";

export function runAudit(input: ProtocolInput, onStage?: (stage: AuditStage, detail: Record<string, unknown>) => void): AuditReport {
  validateInput(input);
  const intent = buildProtocolIntent(input);
  onStage?.("intent", { invariants: intent.invariants.length, entrypoints: intent.threatModel.entrypoints.length });
  const candidates = discoverVulnerabilities(input);
  onStage?.("discovery", { candidates: candidates.length });
  const debated = runDynaDebate(candidates);
  onStage?.("debate", { rounds: debated.debates.reduce((sum, item) => sum + item.rounds.length, 0) });
  const validated = validateFindings(debated.findings, input.proofs ?? []);
  onStage?.("validation", { proven: validated.findings.filter((item) => item.status === "proven").length });
  const { unknowns, coverage } = assessCoverage(input);
  onStage?.("coverage", { ratio: coverage.ratio, unknowns: unknowns.length });
  return {
    schemaVersion: "srp.audit/v1",
    id: stableId("audit", `${input.name}:${input.chain}:${Date.now()}:${Math.random()}:${input.sources.length}`),
    protocol: input,
    intent,
    findings: validated.findings,
    debates: debated.debates,
    pocResults: validated.pocResults,
    unknowns,
    coverage,
    generatedAt: new Date().toISOString()
  };
}

/** What SRP could and could not analyze. Missing coverage is unknown, not absence of bugs. */
export function assessCoverage(input: ProtocolInput): { unknowns: ResidualUnknown[]; coverage: Coverage } {
  const unknowns: ResidualUnknown[] = [];
  const analyzers = new Set<string>(["srp-pattern"]);
  let analyzedFiles = 0;
  let functions = 0;
  const add = (file: string, question: string, reason: string, severity: ResidualUnknown["severity"]) =>
    unknowns.push({ unknownId: stableId("unk", `${file}:${question}`), file, question, reason, severity });
  const family = input.chain === "solana" ? "solana" : "evm";
  for (const source of input.sources) {
    if (family === "evm" && isSolidity(source)) {
      analyzers.add("srp-structural");
      const index = indexSolidity(source.content);
      functions += index.functions.length;
      analyzedFiles += 1;
      if (!index.functions.length && /\bfunction\b/.test(index.code)) add(source.path, "Which functions does this file define?", "Function headers were present but none could be indexed.", "high");
      if (/\bassembly\s*\{/.test(index.code)) add(source.path, "What does the inline assembly do to storage and control flow?", "Inline assembly is not analyzed; state writes and calls inside it are invisible to detectors.", "medium");
      if (/\binterface\s+\w+|\bI[A-Z]\w+\s*\(/.test(index.code) && /\.(call|delegatecall)\b|\bI[A-Z]\w+\(/.test(index.code)) add(source.path, "Can external contracts called from here call back or return hostile data?", "Cross-contract behavior is not modeled; only calls inside this file are reasoned about.", "low");
      if (/\bimport\b/.test(index.code)) add(source.path, "Do imported contracts add entrypoints, modifiers, or state this file relies on?", "Imports were not supplied or resolved; inherited code is not analyzed.", "medium");
      continue;
    }
    if (family === "solana" && isRust(source)) {
      const code = stripComments(source.content);
      if (/anchor_lang|#\[derive\([^)]*Accounts/.test(code)) {
        analyzers.add("srp-anchor");
        const index = indexAnchor(source.content);
        functions += index.instructions.length;
        analyzedFiles += 1;
        if (/\bunsafe\b/.test(code)) add(source.path, "What do the unsafe blocks touch?", "unsafe Rust is not analyzed.", "medium");
        if (/remaining_accounts/.test(code)) add(source.path, "Are ctx.remaining_accounts validated (owner, signer, key)?", "remaining_accounts bypass Anchor constraints and are not checked by SRP.", "high");
      } else {
        analyzedFiles += 1;
        add(source.path, "Are account owners, signers, and keys validated by hand?", "Native (non-Anchor) Solana program: only pattern rules ran; manual account checks are not modeled.", "high");
      }
      continue;
    }
    add(source.path, `Is ${source.path} security relevant?`, `No ${family.toUpperCase()} analyzer handles language "${source.language}" for chain ${input.chain}; the file was not analyzed.`, "medium");
  }
  const files = input.sources.length;
  return {
    unknowns,
    coverage: { files, analyzedFiles, functions, ratio: files ? Number((analyzedFiles / files).toFixed(2)) : 0, analyzers: [...analyzers] }
  };
}

function validateInput(input: ProtocolInput): void {
  const errors = inputErrors(input);
  if (errors.length) throw new AuditInputError(errors);
}

export class AuditInputError extends Error {
  readonly errors: string[];
  constructor(errors: string[]) {
    super(errors.join("; "));
    this.name = "AuditInputError";
    this.errors = errors;
  }
}

/** Returns every problem with an audit request, so the API can answer 400 with all of them at once. */
export function inputErrors(input: unknown): string[] {
  if (!input || typeof input !== "object") return ["Body must be a JSON object"];
  const value = input as Partial<ProtocolInput>;
  const errors: string[] = [];
  if (typeof value.name !== "string" || !value.name.trim()) errors.push("name is required");
  if (!CHAINS.includes(value.chain as Chain)) errors.push(`chain must be one of ${CHAINS.join(", ")}`);
  if (!Array.isArray(value.sources)) errors.push("sources must be an array");
  if (!Array.isArray(value.documents)) errors.push("documents must be an array");
  if (Array.isArray(value.sources) && Array.isArray(value.documents) && !value.sources.length && !value.documents.length) errors.push("At least one document or source file is required");
  for (const [index, source] of (Array.isArray(value.sources) ? value.sources : []).entries()) {
    const item = source as Partial<SourceFile>;
    if (typeof item?.path !== "string" || !item.path.trim()) errors.push(`sources[${index}].path is required`);
    if (typeof item?.content !== "string" || !item.content.trim()) errors.push(`sources[${index}].content is empty`);
  }
  for (const [index, doc] of (Array.isArray(value.documents) ? value.documents : []).entries()) {
    if (typeof (doc as { content?: unknown })?.content !== "string") errors.push(`documents[${index}].content must be a string`);
  }
  if (value.proofs !== undefined && !Array.isArray(value.proofs)) errors.push("proofs must be an array");
  return errors;
}
