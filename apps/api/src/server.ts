import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AuditInputError,
  CHAINS,
  RuntimeSecurityLayer,
  capabilities,
  exportEvidenceBundle,
  inputErrors,
  renderAuditReport,
  runAudit,
  toSarif,
  verifyEvidenceBundle,
  type AuditReport,
  type Incident,
  type ProofRecord,
  type ProtocolInput,
  type RuntimeSignal
} from "../../../packages/core/src/index.ts";
import { JsonStore } from "./storage.ts";

type Role = "admin" | "auditor" | "viewer";
type Session = { subject: string; role: Role };
type AuditLogEntry = { at: string; subject: string; action: string; path: string };
type PersistedState = { audits: AuditReport[]; incidents: Incident[]; auditLog: AuditLogEntry[] };

export interface SrpServerOptions {
  dataFile?: string;
  /** token -> session. Defaults to SRP_TOKENS, plus demo tokens outside production. */
  tokens?: Record<string, Session>;
  maxBodyBytes?: number;
  rateLimitPerMinute?: number;
  heartbeatMs?: number;
  log?: (line: string) => void;
}

const DEMO_TOKENS: Record<string, Session> = {
  srp_demo_admin_token: { subject: "demo-admin", role: "admin" },
  srp_demo_auditor_token: { subject: "demo-auditor", role: "auditor" },
  srp_demo_viewer_token: { subject: "demo-viewer", role: "viewer" }
};
const AUDIT_LOG_LIMIT = 10_000;
const SIGNAL_SOURCES = ["mempool", "governance", "treasury", "liquidity", "bridge", "staking", "invariant"];

class HttpError extends Error {
  readonly status: number;
  readonly details?: string[];
  constructor(status: number, message: string, details?: string[]) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/**
 * SRP_TOKENS format: "token:role:subject,token2:role2:subject2". Demo tokens are only accepted when
 * NODE_ENV is not "production" or SRP_ALLOW_DEMO_TOKENS=1, so a container never ships with public admin tokens.
 */
export function tokensFromEnv(env: NodeJS.ProcessEnv = process.env): Record<string, Session> {
  const tokens: Record<string, Session> = {};
  for (const entry of (env.SRP_TOKENS ?? "").split(",").map((item) => item.trim()).filter(Boolean)) {
    const [token, role, subject] = entry.split(":");
    if (!token || token.length < 16 || !["admin", "auditor", "viewer"].includes(role ?? "")) throw new Error(`Invalid SRP_TOKENS entry (need token>=16 chars:role:subject): ${token?.slice(0, 4)}...`);
    tokens[token] = { role: role as Role, subject: subject || `${role}-token` };
  }
  const demoAllowed = env.NODE_ENV !== "production" || env.SRP_ALLOW_DEMO_TOKENS === "1";
  return demoAllowed ? { ...DEMO_TOKENS, ...tokens } : tokens;
}

export function createSrpServer(options: SrpServerOptions = {}): Server {
  const tokens = options.tokens ?? tokensFromEnv();
  const maxBody = options.maxBodyBytes ?? 5 * 1024 * 1024;
  const rateLimit = options.rateLimitPerMinute ?? 240;
  const log = options.log ?? ((line: string) => console.log(line));
  const store = new JsonStore<PersistedState>(options.dataFile ?? process.env.SRP_DATA_FILE ?? ".srp-data/state.json", { audits: [], incidents: [], auditLog: [] });
  const monitoring = new RuntimeSecurityLayer();
  const sseClients = new Set<ServerResponse>();
  const rateCounters = new Map<string, { count: number; resetAt: number }>();
  const webRoot = normalize(join(fileURLToPath(new URL(".", import.meta.url)), "../../web/public"));

  const heartbeat = setInterval(() => {
    for (const client of sseClients) client.write(`: heartbeat ${Date.now()}\n\n`);
    const now = Date.now();
    for (const [key, counter] of rateCounters) if (counter.resetAt < now) rateCounters.delete(key);
  }, options.heartbeatMs ?? 15_000);
  heartbeat.unref();

  const server = createServer(async (req, res) => {
    try {
      await route(req, res);
    } catch (error) {
      if (error instanceof HttpError) return json(res, error.status, { error: error.message, ...(error.details ? { details: error.details } : {}) });
      if (error instanceof AuditInputError) return json(res, 400, { error: "Invalid audit request", details: error.errors });
      log(`srp: unhandled error ${error instanceof Error ? error.stack : String(error)}`);
      json(res, 500, { error: "Internal server error" });
    }
  });
  server.on("close", () => {
    clearInterval(heartbeat);
    for (const client of sseClients) client.end();
  });

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://localhost");
    const session = authenticate(req, url);
    if (!applyRateLimit(req, res, session)) return;
    const path = url.pathname;
    const method = req.method ?? "GET";

    if (method === "OPTIONS") return cors(res);
    if (path === "/api/health" && method === "GET") {
      const state = await store.read();
      return json(res, 200, { status: "ok", audits: state.audits.length, incidents: state.incidents.length });
    }
    if (path === "/api/openapi.json" && method === "GET") return json(res, 200, openApiDocument());
    if (path === "/api/capabilities" && method === "GET") return json(res, 200, capabilities());
    if (path === "/api/events" && method === "GET") return requireRole(req, res, session, "viewer", () => subscribe(req, res, session));
    if (path === "/api/audits" && method === "GET") return requireRole(req, res, session, "viewer", () => listAudits(res));
    if (path === "/api/audits" && method === "POST") return requireRole(req, res, session, "auditor", () => createAudit(req, res, session));
    if (path === "/api/evidence-bundles/verify" && method === "POST") return requireRole(req, res, session, "viewer", () => verifyBundle(req, res));
    const proofs = path.match(/^\/api\/audits\/([\w-]+)\/proofs$/);
    if (proofs && method === "POST") return requireRole(req, res, session, "auditor", () => attachProofs(req, res, proofs[1] ?? "", session));
    const evidence = path.match(/^\/api\/audits\/([\w-]+)\/evidence$/);
    if (evidence && method === "GET") return requireRole(req, res, session, "viewer", async () => json(res, 200, exportEvidenceBundle(await findAudit(evidence[1] ?? ""))));
    const audit = path.match(/^\/api\/audits\/([\w-]+)$/);
    if (audit && method === "GET") return requireRole(req, res, session, "viewer", async () => json(res, 200, await findAudit(audit[1] ?? "")));
    const report = path.match(/^\/api\/reports\/([\w-]+)\.(md|sarif)$/);
    if (report && method === "GET") {
      return requireRole(req, res, session, "viewer", async () => {
        const found = await findAudit(report[1] ?? "");
        if (report[2] === "sarif") return json(res, 200, toSarif(found), "application/sarif+json; charset=utf-8");
        text(res, 200, renderAuditReport(found), "text/markdown; charset=utf-8");
      });
    }
    if (path === "/api/incidents" && method === "GET") return requireRole(req, res, session, "viewer", async () => json(res, 200, { incidents: (await store.read()).incidents }));
    const incident = path.match(/^\/api\/incidents\/([\w-]+)$/);
    if (incident && method === "POST") return requireRole(req, res, session, "auditor", () => updateIncident(req, res, incident[1] ?? "", session));
    if (path === "/api/signals" && method === "POST") return requireRole(req, res, session, "auditor", () => ingestSignal(req, res, session));
    if (path === "/api/audit-log" && method === "GET") return requireRole(req, res, session, "admin", async () => json(res, 200, { auditLog: (await store.read()).auditLog }));
    if (path.startsWith("/api/")) return json(res, 404, { error: "Not found" });
    if (method === "GET") return serveStatic(path, res);
    json(res, 405, { error: "Method not allowed" });
  }

  function authenticate(req: IncomingMessage, url: URL): Session | undefined {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : undefined;
    if (token && Object.hasOwn(tokens, token)) return tokens[token];
    // EventSource cannot set headers, so the SSE endpoint alone accepts ?token=.
    const queryToken = url.pathname === "/api/events" ? url.searchParams.get("token") : undefined;
    if (queryToken && Object.hasOwn(tokens, queryToken)) return tokens[queryToken];
    return undefined;
  }

  function roleRank(role: Role): number {
    return { viewer: 1, auditor: 2, admin: 3 }[role];
  }

  async function requireRole(req: IncomingMessage, res: ServerResponse, session: Session | undefined, role: Role, handler: () => Promise<void> | void): Promise<void> {
    if (!session) return json(res, 401, { error: "Bearer token required" });
    if (roleRank(session.role) < roleRank(role)) return json(res, 403, { error: "Insufficient role" });
    await store.update((state) => {
      state.auditLog.push({ at: new Date().toISOString(), subject: session.subject, action: req.method ?? "GET", path: (req.url ?? "/").replace(/token=[^&]+/, "token=***") });
      if (state.auditLog.length > AUDIT_LOG_LIMIT) state.auditLog.splice(0, state.auditLog.length - AUDIT_LOG_LIMIT);
    });
    await handler();
  }

  function applyRateLimit(req: IncomingMessage, res: ServerResponse, session: Session | undefined): boolean {
    const key = session?.subject ?? req.socket.remoteAddress ?? "anonymous";
    const now = Date.now();
    const current = rateCounters.get(key);
    if (!current || current.resetAt < now) {
      rateCounters.set(key, { count: 1, resetAt: now + 60_000 });
      return true;
    }
    current.count += 1;
    if (current.count > rateLimit) {
      res.setHeader("retry-after", Math.ceil((current.resetAt - now) / 1000));
      json(res, 429, { error: "Rate limit exceeded" });
      return false;
    }
    return true;
  }

  async function readJson<T>(req: IncomingMessage): Promise<T> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > maxBody) throw new HttpError(413, `Body exceeds ${maxBody} bytes`);
      chunks.push(buffer);
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    if (!raw.trim()) throw new HttpError(400, "Request body is empty");
    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      throw new HttpError(400, `Invalid JSON: ${error instanceof Error ? error.message : "parse error"}`);
    }
  }

  async function createAudit(req: IncomingMessage, res: ServerResponse, session: Session | undefined): Promise<void> {
    const input = await readJson<ProtocolInput>(req);
    const errors = inputErrors(input);
    if (errors.length) throw new HttpError(400, "Invalid audit request", errors);
    broadcast("audit.started", { protocol: input.name, chain: input.chain, sources: input.sources.length, subject: session?.subject });
    const report = runAudit(input, (stage, detail) => broadcast("audit.stage", { protocol: input.name, stage, ...detail }));
    await store.update((state) => {
      state.audits.push(report);
    });
    broadcast("audit.completed", { id: report.id, protocol: report.protocol.name, findings: report.findings.length, coverage: report.coverage.ratio, unknowns: report.unknowns.length, subject: session?.subject });
    json(res, 201, report);
  }

  async function attachProofs(req: IncomingMessage, res: ServerResponse, id: string, session: Session | undefined): Promise<void> {
    const existing = await findAudit(id);
    const body = await readJson<{ proofs?: ProofRecord[] }>(req);
    const proofs = body?.proofs;
    if (!Array.isArray(proofs) || !proofs.length) throw new HttpError(400, "proofs must be a non-empty array");
    const known = new Set(existing.findings.map((finding) => finding.id));
    const errors: string[] = [];
    proofs.forEach((proof, index) => {
      if (!proof || typeof proof !== "object") return errors.push(`proofs[${index}] must be an object`);
      if (!known.has(proof.findingId)) errors.push(`proofs[${index}].findingId is not a finding of audit ${id}`);
      if (typeof proof.command !== "string" || !proof.command.trim()) errors.push(`proofs[${index}].command is required`);
      if (typeof proof.passed !== "boolean") errors.push(`proofs[${index}].passed must be true or false`);
      if (typeof proof.assertion !== "string" || !proof.assertion.trim()) errors.push(`proofs[${index}].assertion is required`);
    });
    if (errors.length) throw new HttpError(400, "Invalid proofs", errors);
    const recorded = proofs.map((proof) => ({ ...proof, recordedAt: new Date().toISOString(), output: proof.output?.slice(0, 20_000) }));
    const merged = [...(existing.protocol.proofs ?? []), ...recorded];
    const rerun = runAudit({ ...existing.protocol, proofs: merged });
    const updated: AuditReport = { ...rerun, id: existing.id };
    await store.update((state) => {
      const index = state.audits.findIndex((item) => item.id === id);
      if (index >= 0) state.audits[index] = updated;
    });
    broadcast("audit.proved", { id, proven: updated.findings.filter((finding) => finding.status === "proven").length, subject: session?.subject });
    json(res, 200, updated);
  }

  async function verifyBundle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const bundle = await readJson<unknown>(req);
    try {
      const verified = verifyEvidenceBundle(bundle);
      json(res, 200, { valid: true, auditId: verified.auditId, findings: verified.findings.length, unknowns: verified.unknowns.length, digest: verified.digest });
    } catch (error) {
      json(res, 422, { valid: false, error: error instanceof Error ? error.message : "invalid bundle" });
    }
  }

  async function findAudit(id: string): Promise<AuditReport> {
    const audit = (await store.read()).audits.find((item) => item.id === id);
    if (!audit) throw new HttpError(404, "Audit not found");
    return audit;
  }

  async function listAudits(res: ServerResponse): Promise<void> {
    const summaries = (await store.read()).audits.map((audit) => ({
      id: audit.id,
      protocol: audit.protocol.name,
      chain: audit.protocol.chain,
      generatedAt: audit.generatedAt,
      findings: audit.findings.length,
      proven: audit.findings.filter((finding) => finding.status === "proven").length,
      coverage: audit.coverage?.ratio ?? null
    }));
    json(res, 200, { audits: summaries });
  }

  async function ingestSignal(req: IncomingMessage, res: ServerResponse, session: Session | undefined): Promise<void> {
    const signal = await readJson<RuntimeSignal>(req);
    const errors: string[] = [];
    if (typeof signal?.protocol !== "string" || !signal.protocol.trim()) errors.push("protocol is required");
    if (!CHAINS.includes(signal?.chain)) errors.push(`chain must be one of ${CHAINS.join(", ")}`);
    if (!SIGNAL_SOURCES.includes(signal?.source)) errors.push(`source must be one of ${SIGNAL_SOURCES.join(", ")}`);
    if (typeof signal?.metric !== "string" || !signal.metric.trim()) errors.push("metric is required");
    if (typeof signal?.value !== "number" || !Number.isFinite(signal.value)) errors.push("value must be a finite number");
    if (typeof signal?.threshold !== "number" || !Number.isFinite(signal.threshold) || signal.threshold < 0) errors.push("threshold must be a finite number >= 0");
    if (errors.length) throw new HttpError(400, "Invalid signal", errors);
    const incident = monitoring.ingest(signal);
    const state = await store.update((value) => {
      if (incident) value.incidents.push(incident);
    });
    if (incident) broadcast("incident.created", { incident, subject: session?.subject });
    // Health comes from stored incidents so it survives restarts.
    const open = state.incidents.filter((item) => item.protocol === signal.protocol && item.status === "open");
    const health = { protocol: signal.protocol, openIncidents: open.length, status: open.some((item) => item.severity === "critical" || item.severity === "high") ? "critical" : open.length ? "degraded" : "healthy" };
    json(res, 202, { incident: incident ?? null, health });
  }

  async function updateIncident(req: IncomingMessage, res: ServerResponse, id: string, session: Session | undefined): Promise<void> {
    const body = await readJson<{ status?: string }>(req);
    if (!["open", "acknowledged", "resolved"].includes(body?.status ?? "")) throw new HttpError(400, "status must be open, acknowledged, or resolved");
    let updated: Incident | undefined;
    await store.update((state) => {
      const found = state.incidents.find((item) => item.id === id);
      if (found) { found.status = body.status as Incident["status"]; updated = found; }
    });
    if (!updated) throw new HttpError(404, "Incident not found");
    broadcast("incident.updated", { incident: updated, subject: session?.subject });
    json(res, 200, updated);
  }

  function subscribe(req: IncomingMessage, res: ServerResponse, session: Session | undefined): void {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "access-control-allow-origin": "*"
    });
    res.write(`event: ready\ndata: ${JSON.stringify({ subject: session?.subject, at: new Date().toISOString() })}\n\n`);
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
  }

  function broadcast(event: string, data: unknown): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) client.write(payload);
  }

  async function serveStatic(pathname: string, res: ServerResponse): Promise<void> {
    const requested = pathname === "/" ? "/index.html" : pathname;
    const filePath = normalize(join(webRoot, decodeURIComponent(requested)));
    if (filePath !== webRoot && !filePath.startsWith(webRoot + sep)) return json(res, 403, { error: "Forbidden" });
    try {
      const data = await readFile(filePath);
      res.writeHead(200, { "content-type": contentType(filePath), "x-content-type-options": "nosniff" });
      res.end(data);
    } catch {
      json(res, 404, { error: "Not found" });
    }
  }

  return server;
}

function cors(res: ServerResponse): void {
  res.writeHead(204, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-max-age": "600"
  });
  res.end();
}

function json(res: ServerResponse, status: number, body: unknown, type = "application/json; charset=utf-8"): void {
  if (res.headersSent) return;
  res.writeHead(status, { "content-type": type, "access-control-allow-origin": "*" });
  res.end(JSON.stringify(body, null, 2));
}

function text(res: ServerResponse, status: number, body: string, contentTypeHeader: string): void {
  res.writeHead(status, { "content-type": contentTypeHeader, "access-control-allow-origin": "*" });
  res.end(body);
}

function contentType(path: string): string {
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml"
  }[extname(path)] ?? "application/octet-stream";
}

function openApiDocument(): object {
  return {
    openapi: "3.1.0",
    info: { title: "Security Reasoning Protocol API", version: "0.2.0" },
    security: [{ bearerAuth: [] }],
    components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } } },
    paths: {
      "/api/health": { get: { summary: "Service health", security: [] } },
      "/api/capabilities": { get: { summary: "Analyzers, detectors, chains, and local tools (doctor)", security: [] } },
      "/api/audits": { get: { summary: "List audits" }, post: { summary: "Run an audit (400 with details on invalid input)" } },
      "/api/audits/{id}": { get: { summary: "Fetch audit report JSON (schema srp.audit/v1)" } },
      "/api/audits/{id}/proofs": { post: { summary: "Attach locally executed PoC/test results; a passing proof marks the finding proven" } },
      "/api/audits/{id}/evidence": { get: { summary: "Export an evidence bundle (srp.evidence-bundle/v1) with a sha256 digest" } },
      "/api/evidence-bundles/verify": { post: { summary: "Verify an evidence bundle's schema and digest" } },
      "/api/reports/{id}.md": { get: { summary: "Fetch audit report markdown" } },
      "/api/reports/{id}.sarif": { get: { summary: "Fetch SARIF 2.1.0 for GitHub code scanning" } },
      "/api/events": { get: { summary: "SSE: ready, audit.started, audit.stage, audit.completed, audit.proved, incident.created, heartbeat comments" } },
      "/api/signals": { post: { summary: "Ingest a runtime monitoring signal" } },
      "/api/incidents": { get: { summary: "List runtime incidents" } },
      "/api/incidents/{id}": { post: { summary: "Set incident status: open, acknowledged, resolved" } },
      "/api/audit-log": { get: { summary: "List API audit log entries (admin)" } }
    }
  };
}

const isMain = process.argv[1] !== undefined && normalize(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const PORT = Number(process.env.PORT ?? 8080);
  const HOST = process.env.HOST ?? "127.0.0.1";
  const tokens = tokensFromEnv();
  if (Object.keys(tokens).some((token) => token.startsWith("srp_demo_"))) console.warn("srp: demo tokens are enabled. Set NODE_ENV=production and SRP_TOKENS before exposing this server.");
  if (!Object.keys(tokens).length) console.warn("srp: no API tokens configured (SRP_TOKENS); every protected endpoint will return 401.");
  createSrpServer({ tokens }).listen(PORT, HOST, () => console.log(`SRP API listening on http://${HOST}:${PORT}`));
}
