import type { IncomingMessage, ServerResponse } from "node:http";

import { loadOrCreateSetupManifest } from "@srp/config";

import { sendJson } from "../http-utils.js";
import { getSessionState, startSession, stopSession } from "../runtime/session-manager.js";

export async function handleGetRuntime(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url || "/", "http://localhost");
  const projectId = url.searchParams.get("projectId") ?? undefined;
  const state = getSessionState(projectId);
  sendJson(res, 200, state);
}

export async function handlePostRuntimeStart(
  req: IncomingMessage,
  res: ServerResponse,
  config: { rootDirectory: string }
): Promise<void> {
  const url = new URL(req.url || "/", "http://localhost");
  const projectId = url.searchParams.get("projectId") ?? undefined;

  await stopSession(projectId);

  const manifest = await loadOrCreateSetupManifest(config.rootDirectory);
  await startSession(config.rootDirectory, manifest.state.providers, {
    projectId,
    identity: manifest.state.identity,
    outputDirectory: manifest.state.workspace.outputDirectory
  });

  const state = getSessionState(projectId);
  sendJson(res, 200, state);
}
