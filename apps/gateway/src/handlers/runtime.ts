import type { IncomingMessage, ServerResponse } from "node:http";

import { loadOrCreateSetupManifest } from "@srp/config";

import { sendJson } from "../http-utils.js";
import { getSessionState, startSession, stopSession } from "../runtime/session-manager.js";

export async function handleGetRuntime(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const state = getSessionState();
  sendJson(res, 200, state);
}

export async function handlePostRuntimeStart(
  _req: IncomingMessage,
  res: ServerResponse,
  config: { rootDirectory: string }
): Promise<void> {
  await stopSession();

  const manifest = await loadOrCreateSetupManifest(config.rootDirectory);
  startSession(config.rootDirectory, manifest.state.providers, {
    identity: manifest.state.identity,
    outputDirectory: manifest.state.workspace.outputDirectory
  });

  const state = getSessionState();
  sendJson(res, 200, state);
}
