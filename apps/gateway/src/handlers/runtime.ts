import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson } from "../http-utils.js";
import { getSessionState, startSession, stopSession } from "../runtime/session-manager.js";

// ---------------------------------------------------------------------------
// GET /api/runtime
// ---------------------------------------------------------------------------

export async function handleGetRuntime(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url || "/", "http://localhost");
  const projectId = url.searchParams.get("projectId") ?? undefined;
  const state = getSessionState(projectId);
  sendJson(res, 200, state);
}

// ---------------------------------------------------------------------------
// POST /api/runtime/start
import { loadOrCreateSetupManifest } from "@srp/config";

export async function handlePostRuntimeStart(req: IncomingMessage, res: ServerResponse, config: { rootDirectory: string }): Promise<void> {
  const url = new URL(req.url || "/", "http://localhost");
  const projectId = url.searchParams.get("projectId") ?? undefined;

  await stopSession(projectId);
  const manifest = await loadOrCreateSetupManifest(config.rootDirectory);
  const providers = manifest.state.providers;

  await startSession(config.rootDirectory, providers, projectId);
  const state = getSessionState(projectId);
  sendJson(res, 200, state);
}
