import type { IncomingMessage, ServerResponse } from "node:http";
import { getPersistence } from "../runtime/session-manager.js";
import { sendJson, sendError } from "../http-utils.js";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { PersistenceManager } from "../runtime/persistence-manager.js";
import { rebuildAuditRoomProjection } from "../runtime/room-projection.js";
import { rebuildBuildRoomProjection } from "../runtime/build-room-projection.js";

export async function handleGetRuns(
  req: IncomingMessage,
  res: ServerResponse,
  config: { rootDirectory: string }
): Promise<void> {
  try {
    const pm = await getPersistenceOrFallback(config.rootDirectory);
    const runs = await pm.listRuns();
    sendJson(res, 200, runs);
  } catch (e: any) {
    sendError(res, 500, "internal_error", e.message);
  }
}

export async function handleGetRunDetail(
  req: IncomingMessage,
  res: ServerResponse,
  config: { rootDirectory: string }
): Promise<void> {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    const parts = url.pathname.split("/");
    const runId = parts[3];
    const sub = parts[4];

    if (!runId) {
      return sendError(res, 400, "bad_request", "Missing runId");
    }

    const pm = await getPersistenceOrFallback(config.rootDirectory);

    if (!sub) {
      const run = await pm.getRun(runId);
      if (!run) return sendError(res, 404, "not_found", "Run not found");
      sendJson(res, 200, run);
      return;
    }

    if (sub === "artifacts") {
      const artifactId = parts[5];
      if (!artifactId) {
        const run = await pm.getRun(runId);
        sendJson(res, 200, run?.artifacts || []);
        return;
      } else {
        const payload = await pm.getArtifact(runId, artifactId);
        if (!payload) return sendError(res, 404, "not_found", "Artifact not found");
        sendJson(res, 200, payload);
        return;
      }
    }

    if (sub === "events") {
      const events = await pm.listEvents(runId);
      sendJson(res, 200, events);
      return;
    }

    if (sub === "projection") {
      const run = await pm.getRun(runId);
      if (!run) return sendError(res, 404, "not_found", "Run not found");
      const events = await pm.listEvents(runId);
      const payloads: Record<string, unknown> = {};
      for (const artifact of run.artifacts) {
        payloads[artifact.artifactId] = await pm.getArtifact(runId, artifact.artifactId);
      }
      const projection = rebuildAuditRoomProjection({
        manifest: run,
        events,
        payloads
      });
      sendJson(res, 200, projection);
      return;
    }

    if (sub === "build-projection") {
      const run = await pm.getRun(runId);
      if (!run) return sendError(res, 404, "not_found", "Run not found");
      const events = await pm.listEvents(runId);
      const failureDetail = [...events]
        .reverse()
        .find((event) => event.type === "session.failed")?.detail;
      const projection = rebuildBuildRoomProjection({
        manifest: run,
        ...(failureDetail ? { failureDetail } : {})
      });
      sendJson(res, 200, projection);
      return;
    }

    sendError(res, 404, "not_found", "Unknown run sub-resource");
  } catch (e: any) {
    sendError(res, 500, "internal_error", e.message);
  }
}

async function getPersistenceOrFallback(rootDirectory: string): Promise<PersistenceManager> {
  try {
    return await getPersistence();
  } catch (e) {
    // try to read config to find output dir
    let outputDir = ".srp";
    try {
      const configContent = await readFile(join(rootDirectory, ".srp", "config.json"), "utf8");
      const config = JSON.parse(configContent);
      outputDir = config.state?.workspace?.outputDirectory || ".srp";
    } catch (e2) {}
    
    const pm = new PersistenceManager(rootDirectory, outputDir);
    await pm.init();
    return pm;
  }
}
