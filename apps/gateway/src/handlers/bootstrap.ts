import type { IncomingMessage, ServerResponse } from "node:http";
import { resolveAppBootstrap } from "../bootstrap.js";
import { sendError, sendJson } from "../http-utils.js";

export interface BootstrapHandlerConfig {
  readonly rootDirectory: string;
  readonly environment: NodeJS.ProcessEnv;
}

/**
 * GET /api/bootstrap
 *
 * Returns the full typed AppBootstrapResult: onboarding readiness,
 * provider health, routing decision, initial route.
 */
export async function handleGetBootstrap(
  _req: IncomingMessage,
  res: ServerResponse,
  config: BootstrapHandlerConfig
): Promise<void> {
  try {
    const result = await resolveAppBootstrap(config.rootDirectory, config.environment);
    sendJson(res, 200, result);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    sendError(res, 500, "bootstrap_failed", detail);
  }
}
