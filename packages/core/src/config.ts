import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { AuditReport, Finding, ResidualUnknown, Severity, SourceFile } from "./types.ts";
import { stableId } from "./utils.ts";

export interface SrpConfig {
  /** Findings in files matching these globs (`*` within a segment, `**` across) are dropped and reported. */
  ignorePaths?: string[];
  /** Detector ids to switch off. Findings are dropped and reported. */
  disabledDetectors?: string[];
  /** Detector id -> severity. Changes the finding's proposed severity, so it also changes --fail-on. */
  severityOverrides?: Record<string, Severity>;
}

const SEVERITIES = ["critical", "high", "medium", "low", "informational"];
const KEYS = ["ignorePaths", "disabledDetectors", "severityOverrides"];

/** Reads srp.config.json from a project directory (or an explicit file). Returns undefined when absent; throws on a bad file. */
export function loadConfig(dir: string, file?: string): SrpConfig | undefined {
  const path = file ? resolve(file) : join(resolve(dir), "srp.config.json");
  if (!existsSync(path)) {
    if (file) throw new Error(`Config not found: ${file}`);
    return undefined;
  }
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(path, "utf8")); } catch (error) { throw new Error(`Invalid JSON in ${path}: ${error instanceof Error ? error.message : String(error)}`); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`${path}: expected a JSON object`);
  const config = raw as Record<string, unknown>;
  for (const key of Object.keys(config)) if (!KEYS.includes(key)) throw new Error(`${path}: unknown key "${key}" (allowed: ${KEYS.join(", ")})`);
  for (const key of ["ignorePaths", "disabledDetectors"]) {
    const value = config[key];
    if (value !== undefined && (!Array.isArray(value) || value.some((item) => typeof item !== "string"))) throw new Error(`${path}: ${key} must be an array of strings`);
  }
  const overrides = config.severityOverrides;
  if (overrides !== undefined) {
    if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) throw new Error(`${path}: severityOverrides must be an object`);
    for (const [detector, severity] of Object.entries(overrides)) if (typeof severity !== "string" || !SEVERITIES.includes(severity)) throw new Error(`${path}: severityOverrides.${detector} must be one of ${SEVERITIES.join(", ")}`);
  }
  return config as SrpConfig;
}

function globToRegExp(glob: string): RegExp {
  const body = glob.replace(/\\/g, "/").replace(/[.+^${}()|[\]]/g, "\\$&").replace(/\*\*\/?/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]").replace(/\u0000/g, "(?:.*/)?");
  return new RegExp(`^${body}$`);
}

const IGNORE = /(?:\/\/|\/\*|#)\s*srp-ignore\s+([a-z0-9-]+(?:\s*,\s*[a-z0-9-]+)*)(?:\s*[:\-]\s*([^*\n]*?))?\s*(?:\*\/)?\s*$/;

/** `// srp-ignore <detector>[, <detector>] [: reason]` on the finding's line or the line above. Returns the reason ("" if none) or undefined. */
function inlineIgnore(source: SourceFile | undefined, line: number, detector: string): string | undefined {
  if (!source) return undefined;
  const lines = source.content.split(/\r?\n/);
  for (const index of [line - 1, line - 2]) {
    const match = lines[index]?.match(IGNORE);
    if (!match) continue;
    if (match[1]!.split(",").map((item) => item.trim()).includes(detector)) return (match[2] ?? "").trim();
  }
  return undefined;
}

/**
 * Applies the config and inline suppressions to a finished report. Nothing disappears silently:
 * every suppressed finding becomes a low residual unknown that names the detector, location and why.
 */
export function applyConfig(report: AuditReport, sources: SourceFile[], config: SrpConfig = {}): AuditReport {
  const ignore = (config.ignorePaths ?? []).map(globToRegExp);
  const disabled = new Set(config.disabledDetectors ?? []);
  const byPath = new Map(sources.map((source) => [source.path, source]));
  const kept: Finding[] = [];
  const unknowns: ResidualUnknown[] = [];
  for (const finding of report.findings) {
    const evidence = finding.evidence[0];
    const file = evidence?.file ?? "";
    const where = `${file}:${evidence?.startLine ?? 0}`;
    let why: string | undefined;
    if (disabled.has(finding.detector)) why = "detector disabled in srp.config.json";
    else if (ignore.some((pattern) => pattern.test(file))) why = "path matches ignorePaths in srp.config.json";
    else {
      const reason = inlineIgnore(byPath.get(file), evidence?.startLine ?? 0, finding.detector);
      if (reason !== undefined) why = reason ? `srp-ignore comment: ${reason}` : "srp-ignore comment (no reason given)";
    }
    if (why) {
      unknowns.push({ unknownId: stableId("unk", `suppressed:${finding.id}`), file, question: `Was ${finding.detector} at ${where} a real issue?`, reason: `Suppressed, not reviewed by SRP: ${why}.`, severity: "low" });
      continue;
    }
    const override = config.severityOverrides?.[finding.detector];
    kept.push(override ? { ...finding, severity: override, proposedSeverity: override } : finding);
  }
  return { ...report, findings: kept, unknowns: [...report.unknowns, ...unknowns] };
}
