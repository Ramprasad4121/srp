import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { runAudit, RuntimeSecurityLayer, renderAuditReport, type AuditReport, type Incident, type ProtocolInput, type RuntimeSignal } from "../../../packages/core/src/index.ts";
import { JsonStore } from "./storage.ts";

type Role = "admin" | "auditor" | "viewer";
type Session = { subject: string; role: Role };
type AuditLogEntry = { at: string; subject: string; action: string; path: string };
type PersistedState = { audits: AuditReport[]; incidents: Incident[]; auditLog: AuditLogEntry[] };

const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? "127.0.0.1";
const DEMO_TOKENS: Record<string, Session> = {
  srp_demo_admin_token: { subject: "demo-admin", role: "admin" },
  srp_demo_auditor_token: { subject: "demo-auditor", role: "auditor" },
  srp_demo_viewer_token: { subject: "demo-viewer", role: "viewer" }
};
const store = new JsonStore<PersistedState>(process.env.SRP_DATA_FILE ?? ".srp-data/state.json", { audits: [], incidents: [], auditLog: [] });
const monitoring = new RuntimeSecurityLayer();
const sseClients = new Set<ServerResponse>();
const rateCounters = new Map<string, { count: number; resetAt: number }>();
const webRoot = normalize(join(fileURLToPath(new URL(".", import.meta.url)), "../../web/public"));

const server = createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (error) {
    json(res, 500, { error: error instanceof Error ? error.message : "Internal server error" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`SRP API listening on http://${HOST}:${PORT}`);
});

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const session = authenticate(req);
  if (!applyRateLimit(req, res, session)) return;

  if (url.pathname === "/api/health") {
    const state = await store.read();
    return json(res, 200, { status: "ok", audits: state.audits.length, incidents: state.incidents.length });
  }
  if (url.pathname === "/api/openapi.json") return json(res, 200, openApiDocument());
  if (url.pathname === "/api/events") return requireRole(req, res, session, "viewer", () => subscribe(req, res, session));
  if (url.pathname === "/api/audits" && req.method === "GET") return requireRole(req, res, session, "viewer", () => listAudits(res));
  if (url.pathname === "/api/audits" && req.method === "POST") return requireRole(req, res, session, "auditor", async () => createAudit(req, res, session));
  if (url.pathname.startsWith("/api/audits/") && req.method === "GET") return requireRole(req, res, session, "viewer", () => getAudit(url.pathname, res));
  if (url.pathname.startsWith("/api/reports/") && req.method === "GET") return requireRole(req, res, session, "viewer", () => getReport(url.pathname, res));
  if (url.pathname === "/api/incidents" && req.method === "GET") return requireRole(req, res, session, "viewer", async () => json(res, 200, { incidents: (await store.read()).incidents }));
  if (url.pathname === "/api/signals" && req.method === "POST") return requireRole(req, res, session, "auditor", async () => ingestSignal(req, res, session));
  if (url.pathname === "/api/audit-log" && req.method === "GET") return requireRole(req, res, session, "admin", async () => json(res, 200, { auditLog: (await store.read()).auditLog }));
  if (req.method === "GET") return serveStatic(url.pathname, res);
  json(res, 404, { error: "Not found" });
}

function authenticate(req: IncomingMessage): Session | undefined {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  if (token && DEMO_TOKENS[token]) return DEMO_TOKENS[token];
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const queryToken = url.pathname === "/api/events" ? url.searchParams.get("token") : undefined;
  if (queryToken && DEMO_TOKENS[queryToken]) return DEMO_TOKENS[queryToken];
  return undefined;
}

function roleRank(role: Role): number {
  return { viewer: 1, auditor: 2, admin: 3 }[role];
}

async function requireRole(req: IncomingMessage, res: ServerResponse, session: Session | undefined, role: Role, handler: () => Promise<void> | void): Promise<void> {
  if (!session) return json(res, 401, { error: "Bearer token required" });
  if (roleRank(session.role) < roleRank(role)) return json(res, 403, { error: "Insufficient role" });
  await store.update((state) => {
    state.auditLog.push({ at: new Date().toISOString(), subject: session.subject, action: req.method ?? "GET", path: req.url ?? "/" });
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
  if (current.count > 240) {
    json(res, 429, { error: "Rate limit exceeded" });
    return false;
  }
  return true;
}

async function createAudit(req: IncomingMessage, res: ServerResponse, session: Session | undefined): Promise<void> {
  const input = await readJson<ProtocolInput>(req);
  const report = runAudit(input);
  await store.update((state) => {
    state.audits.push(report);
  });
  broadcast("audit.created", { id: report.id, protocol: report.protocol.name, findings: report.findings.length, subject: session?.subject });
  json(res, 201, report);
}

async function listAudits(res: ServerResponse): Promise<void> {
  const summaries = (await store.read()).audits.map((audit) => ({
    id: audit.id,
    protocol: audit.protocol.name,
    chain: audit.protocol.chain,
    generatedAt: audit.generatedAt,
    findings: audit.findings.length,
    verified: audit.findings.filter((finding) => finding.status === "proven").length
  }));
  json(res, 200, { audits: summaries });
}

async function getAudit(pathname: string, res: ServerResponse): Promise<void> {
  const id = pathname.split("/").at(-1) ?? "";
  const audit = (await store.read()).audits.find((item) => item.id === id);
  if (!audit) return json(res, 404, { error: "Audit not found" });
  json(res, 200, audit);
}

async function getReport(pathname: string, res: ServerResponse): Promise<void> {
  const id = pathname.split("/").at(-1)?.replace(/\.md$/, "") ?? "";
  const audit = (await store.read()).audits.find((item) => item.id === id);
  if (!audit) return json(res, 404, { error: "Report not found" });
  text(res, 200, renderAuditReport(audit), "text/markdown; charset=utf-8");
}

async function ingestSignal(req: IncomingMessage, res: ServerResponse, session: Session | undefined): Promise<void> {
  const signal = await readJson<RuntimeSignal>(req);
  const incident = monitoring.ingest(signal);
  if (incident) {
    await store.update((state) => {
      state.incidents.push(incident);
    });
  }
  if (incident) broadcast("incident.created", { incident, subject: session?.subject });
  json(res, 202, { incident, health: monitoring.health(signal.protocol) });
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
  const normalized = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(webRoot, normalized);
  if (!filePath.startsWith(webRoot)) return json(res, 403, { error: "Forbidden" });
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "content-type": contentType(filePath) });
    res.end(data);
  } catch {
    json(res, 404, { error: "Not found" });
  }
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" });
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
    info: { title: "Security Reasoning Protocol API", version: "0.1.0" },
    security: [{ bearerAuth: [] }],
    components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } } },
    paths: {
      "/api/health": { get: { summary: "Service health" } },
      "/api/audits": { get: { summary: "List audits" }, post: { summary: "Run an audit" } },
      "/api/audits/{id}": { get: { summary: "Fetch audit report JSON" } },
      "/api/reports/{id}.md": { get: { summary: "Fetch audit report markdown" } },
      "/api/events": { get: { summary: "Subscribe to SSE platform events" } },
      "/api/signals": { post: { summary: "Ingest runtime monitoring signal" } },
      "/api/incidents": { get: { summary: "List runtime incidents" } },
      "/api/audit-log": { get: { summary: "List API audit log entries" } }
    }
  };
}
