/**
 * SRP MCP server: JSON-RPC 2.0 over stdio (newline-delimited), no dependencies.
 * Tools let an agent scan a project or inline source, read coverage and unknowns, explain a detector,
 * attach a locally executed PoC result as proof, and export an evidence bundle.
 *
 * Path access is confined to SRP_MCP_ROOT (default: the working directory the client started us in).
 */
import { createInterface } from "node:readline";
import { relative, resolve, isAbsolute } from "node:path";
import {
  CHAINS,
  DETECTORS,
  SRP_VERSION,
  capabilities,
  exportEvidenceBundle,
  inputErrors,
  loadProject,
  runAudit,
  summarizeReport,
  type AuditReport,
  type Chain,
  type ProofRecord,
  type ProtocolInput
} from "../../../packages/core/src/index.ts";

type Json = Record<string, unknown>;
interface Tool { name: string; description: string; inputSchema: Json; outputSchema?: Json; run(args: Json): Json }

const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const MAX_SESSION_AUDITS = 50;

export class SrpMcp {
  private readonly audits = new Map<string, AuditReport>();
  private readonly root: string;
  readonly tools: Tool[];

  constructor(root = process.env.SRP_MCP_ROOT ?? process.cwd()) {
    this.root = resolve(root);
    this.tools = [
      {
        name: "srp_scan_path",
        description: "Scan a Foundry, Hardhat, or Anchor project (or one file) under the server root. Returns an srp.summary/v1 object: findings with cited lines, coverage, and residual unknowns. Findings are static leads, not proofs.",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Path relative to the server root (default '.')" },
            chain: { type: "string", enum: CHAINS },
            includeTests: { type: "boolean" }
          },
          additionalProperties: false
        },
        run: (args) => {
          const target = this.confine(typeof args.path === "string" ? args.path : ".");
          const project = loadProject(target, { chain: args.chain as Chain | undefined, includeTests: args.includeTests === true });
          const report = runAudit(project.input);
          report.unknowns.push(...project.skipped);
          return this.remember(report);
        }
      },
      {
        name: "srp_scan_source",
        description: "Scan source code passed inline (for code an agent just wrote). Returns srp.summary/v1.",
        inputSchema: {
          type: "object",
          required: ["chain", "sources"],
          properties: {
            name: { type: "string" },
            chain: { type: "string", enum: CHAINS },
            sources: {
              type: "array",
              minItems: 1,
              items: { type: "object", required: ["path", "content"], properties: { path: { type: "string" }, content: { type: "string" }, language: { type: "string", enum: ["solidity", "rust"] } } }
            }
          },
          additionalProperties: false
        },
        run: (args) => {
          const sources = Array.isArray(args.sources) ? args.sources as Array<{ path: string; content: string; language?: string }> : [];
          const input = {
            name: typeof args.name === "string" && args.name.trim() ? args.name : "inline",
            chain: args.chain,
            documents: [],
            sources: sources.map((source) => ({ path: source?.path, content: source?.content, language: source?.language ?? (String(source?.path).endsWith(".rs") ? "rust" : "solidity") }))
          } as unknown as ProtocolInput;
          const errors = inputErrors(input);
          if (errors.length) throw new Error(errors.join("; "));
          return this.remember(runAudit(input));
        }
      },
      {
        name: "srp_get_finding",
        description: "Full detail for one finding from an earlier scan in this session: evidence, facts, debate, validation status, and a generated PoC harness when available.",
        inputSchema: { type: "object", required: ["auditId", "findingId"], properties: { auditId: { type: "string" }, findingId: { type: "string" } }, additionalProperties: false },
        run: (args) => {
          const report = this.audit(args.auditId);
          const finding = report.findings.find((item) => item.id === args.findingId);
          if (!finding) throw new Error(`No finding ${String(args.findingId)} in audit ${report.id}`);
          return {
            finding,
            debate: report.debates.find((item) => item.findingId === finding.id) ?? null,
            validation: report.pocResults.find((item) => item.findingId === finding.id) ?? null
          };
        }
      },
      {
        name: "srp_attach_proof",
        description: "Attach the result of a PoC or test you actually ran (e.g. forge test). A passing result marks the finding proven and restores its proposed severity. Never report a finding as proven without this.",
        inputSchema: {
          type: "object",
          required: ["auditId", "findingId", "command", "passed", "assertion"],
          properties: {
            auditId: { type: "string" },
            findingId: { type: "string" },
            command: { type: "string", description: "The exact command you ran" },
            passed: { type: "boolean" },
            assertion: { type: "string", description: "What the test asserted, e.g. 'attacker balance grows by 10 ETH'" },
            output: { type: "string" }
          },
          additionalProperties: false
        },
        run: (args) => {
          const report = this.audit(args.auditId);
          if (!report.findings.some((finding) => finding.id === args.findingId)) throw new Error(`No finding ${String(args.findingId)} in audit ${report.id}`);
          if (typeof args.command !== "string" || !args.command.trim() || typeof args.passed !== "boolean" || typeof args.assertion !== "string" || !args.assertion.trim()) throw new Error("command, passed, and assertion are required");
          const proof: ProofRecord = { findingId: String(args.findingId), command: args.command, passed: args.passed, assertion: args.assertion, output: typeof args.output === "string" ? args.output.slice(0, 20_000) : undefined, recordedAt: new Date().toISOString() };
          const rerun = runAudit({ ...report.protocol, proofs: [...(report.protocol.proofs ?? []), proof] });
          const updated = { ...rerun, id: report.id };
          this.audits.set(report.id, updated);
          return summarizeReport(updated);
        }
      },
      {
        name: "srp_coverage",
        description: "What an earlier scan could and could not analyze: coverage figures and residual unknowns. Read this before saying code is safe.",
        inputSchema: { type: "object", required: ["auditId"], properties: { auditId: { type: "string" } }, additionalProperties: false },
        run: (args) => {
          const report = this.audit(args.auditId);
          return { coverage: report.coverage, unknowns: report.unknowns };
        }
      },
      {
        name: "srp_export_evidence",
        description: "Export an srp.evidence-bundle/v1 (findings, evidence, unknowns, sha256 digest) for a report or another tool.",
        inputSchema: { type: "object", required: ["auditId"], properties: { auditId: { type: "string" } }, additionalProperties: false },
        outputSchema: { type: "object", required: ["schemaVersion", "auditId", "findings", "unknowns", "coverage", "digest"], properties: { schemaVersion: { const: "srp.evidence-bundle/v1" }, digest: { type: "string" } } },
        run: (args) => exportEvidenceBundle(this.audit(args.auditId)) as unknown as Json
      },
      {
        name: "srp_explain_detector",
        description: "What a detector looks for and its default severity.",
        inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string", enum: DETECTORS.map((detector) => detector.id) } }, additionalProperties: false },
        run: (args) => {
          const detector = DETECTORS.find((item) => item.id === args.id);
          if (!detector) throw new Error(`Unknown detector ${String(args.id)}`);
          return detector as unknown as Json;
        }
      },
      {
        name: "srp_capabilities",
        description: "Analyzers, detectors, chains, local tools (forge, anchor), and what SRP does not do yet.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        outputSchema: { type: "object", required: ["schemaVersion", "version", "detectors", "analyzers", "notBuilt"], properties: { schemaVersion: { const: "srp.capabilities/v1" }, version: { type: "string" } } },
        run: () => capabilities() as unknown as Json
      }
    ];
  }

  private confine(path: string): string {
    const target = resolve(this.root, path);
    const rel = relative(this.root, target);
    if (rel.startsWith("..") || isAbsolute(rel)) throw new Error(`Path is outside the server root (${this.root}). Set SRP_MCP_ROOT to allow it.`);
    return target;
  }

  private remember(report: AuditReport): Json {
    this.audits.set(report.id, report);
    while (this.audits.size > MAX_SESSION_AUDITS) this.audits.delete(this.audits.keys().next().value as string);
    return summarizeReport(report) as unknown as Json;
  }

  private audit(id: unknown): AuditReport {
    const report = this.audits.get(String(id));
    if (!report) throw new Error(`Unknown auditId ${String(id)}. Run srp_scan_path or srp_scan_source first in this session.`);
    return report;
  }

  /** Handle one JSON-RPC message. Returns the response, or undefined for notifications. */
  handle(message: unknown): Json | undefined {
    const request = message as { jsonrpc?: string; id?: string | number | null; method?: unknown; params?: Json };
    const isNotification = !request || typeof request !== "object" || !("id" in request) || request.id === undefined;
    const reply = (result: unknown): Json => ({ jsonrpc: "2.0", id: request.id ?? null, result });
    const fail = (code: number, text: string): Json => ({ jsonrpc: "2.0", id: request?.id ?? null, error: { code, message: text } });
    if (!request || typeof request !== "object" || request.jsonrpc !== "2.0" || typeof request.method !== "string") return isNotification ? undefined : fail(-32600, "Invalid Request");
    switch (request.method) {
      case "initialize": {
        const asked = String(request.params?.protocolVersion ?? "");
        return reply({
          protocolVersion: SUPPORTED_PROTOCOLS.includes(asked) ? asked : SUPPORTED_PROTOCOLS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "srp", version: SRP_VERSION },
          instructions: "SRP findings are static leads with cited lines. Check srp_coverage before calling code safe, and only call a finding proven after srp_attach_proof with a passing run."
        });
      }
      case "ping":
        return reply({});
      case "tools/list":
        return reply({ tools: this.tools.map(({ name, description, inputSchema, outputSchema }) => ({ name, description, inputSchema, ...(outputSchema ? { outputSchema } : {}) })) });
      case "tools/call": {
        const tool = this.tools.find((item) => item.name === request.params?.name);
        if (!tool) return fail(-32602, `Unknown tool: ${String(request.params?.name)}`);
        try {
          const result = tool.run((request.params?.arguments as Json | undefined) ?? {});
          return reply({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result, isError: false });
        } catch (error) {
          return reply({ content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }], isError: true });
        }
      }
      default:
        if (request.method.startsWith("notifications/")) return undefined;
        return isNotification ? undefined : fail(-32601, `Method not found: ${request.method}`);
    }
  }
}

export async function runMcpStdio(input: NodeJS.ReadableStream = process.stdin, output: NodeJS.WritableStream = process.stdout): Promise<void> {
  const server = new SrpMcp();
  const lines = createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      output.write(`${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } })}\n`);
      continue;
    }
    const batch = Array.isArray(message) ? message : [message];
    const responses = batch.map((item) => server.handle(item)).filter((item): item is Json => item !== undefined);
    if (!responses.length) continue;
    output.write(`${JSON.stringify(Array.isArray(message) ? responses : responses[0])}\n`);
  }
}

import { realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
function isEntry(argv1: string | undefined, metaUrl: string): boolean {
  if (!argv1) return false;
  try { return pathToFileURL(realpathSync(argv1)).href === metaUrl; } catch { return false; }
}
const invokedDirectly = process.argv[1] !== undefined && isEntry(process.argv[1], import.meta.url);
if (invokedDirectly) runMcpStdio();
