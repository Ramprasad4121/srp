import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson } from "../http-utils.js";
import { getSessionState, startSession, stopSession } from "../runtime/session-manager.js";

// ---------------------------------------------------------------------------
// GET /api/runtime
// ---------------------------------------------------------------------------

export async function handleGetRuntime(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const state = getSessionState();
  sendJson(res, 200, state);
}

// ---------------------------------------------------------------------------
// POST /api/runtime/start
import { loadOrCreateSetupManifest } from "@srp/config";

export async function handlePostRuntimeStart(req: IncomingMessage, res: ServerResponse, config: { rootDirectory: string }): Promise<void> {
  await stopSession();
  const manifest = await loadOrCreateSetupManifest(config.rootDirectory);
  const providers = manifest.state.providers;

  startSession(config.rootDirectory, providers);
  const state = getSessionState();
  sendJson(res, 200, state);
}
