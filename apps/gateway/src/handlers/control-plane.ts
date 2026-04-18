import type { IncomingMessage, ServerResponse } from "node:http";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { sendError, sendJson } from "../http-utils.js";
import { getPersistence } from "../runtime/session-manager.js";
import { PersistenceManager } from "../runtime/persistence-manager.js";
import { listSkills } from "../runtime/skills-catalog.js";
import { deriveControlPlaneProjection } from "../runtime/control-plane.js";

async function getPersistenceOrFallback(rootDirectory: string): Promise<PersistenceManager> {
  try {
    return await getPersistence();
  } catch {
    const pm = new PersistenceManager(rootDirectory, ".srp");
    await pm.init();
    return pm;
  }
}

async function hasWebDist(rootDirectory: string): Promise<boolean> {
  try {
    await access(join(rootDirectory, "apps/web/dist-web/index.html"));
    return true;
  } catch {
    return false;
  }
}

export async function handleGetControlPlane(
  _req: IncomingMessage,
  res: ServerResponse,
  config: { rootDirectory: string }
): Promise<void> {
  try {
    const pm = await getPersistenceOrFallback(config.rootDirectory);
    const runs = await pm.listRuns();
    const inspectedRuns = runs.slice(0, 5);
    const eventsByRun = new Map<string, readonly import("@srp/shared-types").RunEventLogEntry[]>();

    await Promise.all(
      inspectedRuns.map(async (run) => {
        eventsByRun.set(run.runId, await pm.listEvents(run.runId));
      })
    );

    const projection = deriveControlPlaneProjection({
      runs: inspectedRuns,
      skills: await listSkills(),
      eventsByRun,
      webDistReady: await hasWebDist(config.rootDirectory)
    });

    sendJson(res, 200, projection);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    sendError(res, 500, "control_plane_failed", detail);
  }
}
