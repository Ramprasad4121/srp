import type { IncomingMessage, ServerResponse } from "node:http";

import {
  buildOnboardingReadiness,
  loadOrCreateSetupManifest,
  persistSetupIdentity,
  persistProviderSelections,
  persistProviderSetupCompleted,
  persistSetupRole,
  persistWelcomeCompleted,
  persistWorkspaceSelection,
  persistWorkspaceSetupCompleted
} from "@srp/config";
import type {
  Department,
  InternetMode,
  ProviderSelection,
  RuntimeMode,
  SetupIdentity,
  SetupManifest
} from "@srp/shared-types";
import { createSetupUpdatedEvent } from "@srp/events";

import { readJsonBody, sendError, sendJson } from "../http-utils.js";
import { sharedEventBus } from "../events/event-bus.js";

// ---------------------------------------------------------------------------
// Shared config
// ---------------------------------------------------------------------------

export interface SetupHandlerConfig {
  readonly rootDirectory: string;
}

// ---------------------------------------------------------------------------
// Response envelope for setup endpoints
// ---------------------------------------------------------------------------

export interface SetupResponse {
  readonly ok: true;
  readonly manifest: SetupManifest;
  readonly onboarding: ReturnType<typeof buildOnboardingReadiness>;
}

function makeSetupResponse(manifest: SetupManifest): SetupResponse {
  return {
    ok: true,
    manifest,
    onboarding: buildOnboardingReadiness(manifest)
  };
}

// ---------------------------------------------------------------------------
// Request body shapes (validated at runtime)
// ---------------------------------------------------------------------------

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isRuntimeMode(v: unknown): v is RuntimeMode {
  return v === "auditor" || v === "developer" || v === "hybrid";
}

function isDepartment(v: unknown): v is Department {
  return v === "teaching" || v === "build" || v === "audit";
}

function isUserProfile(v: unknown): boolean {
  return v === "founder" || v === "builder" || v === "auditor" || v === "learner";
}

function isUserGoal(v: unknown): boolean {
  return v === "learn" || v === "build" || v === "audit";
}

function isSetupIdentity(v: unknown): v is SetupIdentity {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  return isUserProfile(obj["userProfile"]) && isUserGoal(obj["goal"]) && isDepartment(obj["department"]);
}

function isInternetMode(v: unknown): v is InternetMode {
  return (
    v === "local-only" ||
    v === "local-plus-docs" ||
    v === "local-plus-approved-web" ||
    v === "open-web"
  );
}

function isProviderKind(v: unknown): boolean {
  const validKinds = [
    "anthropic",
    "hugging-face",
    "nvidia",
    "ollama",
    "openai",
    "openrouter",
    "openai-compatible"
  ] as const;
  return isString(v) && (validKinds as readonly string[]).includes(v);
}

function isValidProviderSelection(v: unknown): v is ProviderSelection {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  return (
    isProviderKind(obj["kind"]) &&
    isString(obj["label"]) &&
    isString(obj["model"]) &&
    typeof obj["enabled"] === "boolean"
  );
}

// ---------------------------------------------------------------------------
// GET /api/setup
// ---------------------------------------------------------------------------

/**
 * Returns the current setup manifest plus onboarding readiness derived from it.
 */
export async function handleGetSetup(
  _req: IncomingMessage,
  res: ServerResponse,
  config: SetupHandlerConfig
): Promise<void> {
  try {
    const manifest = await loadOrCreateSetupManifest(config.rootDirectory);
    sendJson(res, 200, makeSetupResponse(manifest));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    sendError(res, 500, "setup_load_failed", detail);
  }
}

// ---------------------------------------------------------------------------
// POST /api/setup/role
// ---------------------------------------------------------------------------

interface SetRoleBody {
  readonly role: RuntimeMode;
}

interface SetIdentityBody {
  readonly identity: SetupIdentity;
}

export async function handlePostSetupIdentity(
  req: IncomingMessage,
  res: ServerResponse,
  config: SetupHandlerConfig
): Promise<void> {
  const body = await readJsonBody<SetIdentityBody>(req);

  if (body === null || !isSetupIdentity(body.identity)) {
    sendError(
      res,
      400,
      "invalid_body",
      "Expected { identity: { userProfile, goal, department } }"
    );
    return;
  }

  try {
    const manifest = await persistSetupIdentity(config.rootDirectory, body.identity);
    sharedEventBus.emit(createSetupUpdatedEvent());
    sendJson(res, 200, makeSetupResponse(manifest));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    sendError(res, 500, "setup_identity_failed", detail);
  }
}

export async function handlePostSetupRole(
  req: IncomingMessage,
  res: ServerResponse,
  config: SetupHandlerConfig
): Promise<void> {
  const body = await readJsonBody<SetRoleBody>(req);

  if (body === null || !isRuntimeMode(body.role)) {
    sendError(res, 400, "invalid_body", "Expected { role: 'auditor' | 'developer' | 'hybrid' }");
    return;
  }

  try {
    const manifest = await persistSetupRole(config.rootDirectory, body.role);
    sharedEventBus.emit(createSetupUpdatedEvent());
    sendJson(res, 200, makeSetupResponse(manifest));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    sendError(res, 500, "setup_role_failed", detail);
  }
}

// ---------------------------------------------------------------------------
// POST /api/setup/providers
// ---------------------------------------------------------------------------

interface SetProvidersBody {
  readonly providers: unknown[];
}

export async function handlePostSetupProviders(
  req: IncomingMessage,
  res: ServerResponse,
  config: SetupHandlerConfig
): Promise<void> {
  const body = await readJsonBody<SetProvidersBody>(req);

  if (
    body === null ||
    !Array.isArray(body.providers) ||
    !body.providers.every(isValidProviderSelection)
  ) {
    sendError(res, 400, "invalid_body", "Expected { providers: ProviderSelection[] }");
    return;
  }

  const providers = body.providers as ProviderSelection[];

  try {
    const manifest = await persistProviderSelections(config.rootDirectory, providers);
    sharedEventBus.emit(createSetupUpdatedEvent());
    sendJson(res, 200, makeSetupResponse(manifest));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    sendError(res, 500, "setup_providers_failed", detail);
  }
}

// ---------------------------------------------------------------------------
// POST /api/setup/workspace
// ---------------------------------------------------------------------------

interface SetWorkspaceBody {
  readonly rootDirectory?: string;
  readonly outputDirectory?: string;
  readonly useDockerToolchains?: boolean;
  readonly internetMode?: InternetMode;
}

export async function handlePostSetupWorkspace(
  req: IncomingMessage,
  res: ServerResponse,
  config: SetupHandlerConfig
): Promise<void> {
  const body = await readJsonBody<SetWorkspaceBody>(req);

  if (body === null || typeof body !== "object") {
    sendError(res, 400, "invalid_body", "Expected a workspace patch object");
    return;
  }

  // Validate individual fields that are present
  if (
    ("rootDirectory" in body && !isString(body.rootDirectory)) ||
    ("outputDirectory" in body && !isString(body.outputDirectory)) ||
    ("useDockerToolchains" in body && typeof body.useDockerToolchains !== "boolean") ||
    ("internetMode" in body && !isInternetMode(body.internetMode))
  ) {
    sendError(res, 400, "invalid_body", "One or more workspace fields are invalid");
    return;
  }

  try {
    const patch: Partial<{
      rootDirectory: string;
      outputDirectory: string;
      useDockerToolchains: boolean;
      internetMode: InternetMode;
    }> = {};

    if (isString(body.rootDirectory)) patch.rootDirectory = body.rootDirectory;
    if (isString(body.outputDirectory)) patch.outputDirectory = body.outputDirectory;
    if (typeof body.useDockerToolchains === "boolean")
      patch.useDockerToolchains = body.useDockerToolchains;
    if (isInternetMode(body.internetMode)) patch.internetMode = body.internetMode;

    const manifest = await persistWorkspaceSelection(config.rootDirectory, patch);
    sharedEventBus.emit(createSetupUpdatedEvent());
    sendJson(res, 200, makeSetupResponse(manifest));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    sendError(res, 500, "setup_workspace_failed", detail);
  }
}

// ---------------------------------------------------------------------------
// POST /api/setup/complete/welcome
// POST /api/setup/complete/providers
// POST /api/setup/complete/workspace
// ---------------------------------------------------------------------------

export async function handlePostCompleteWelcome(
  _req: IncomingMessage,
  res: ServerResponse,
  config: SetupHandlerConfig
): Promise<void> {
  try {
    const manifest = await persistWelcomeCompleted(config.rootDirectory);
    sharedEventBus.emit(createSetupUpdatedEvent());
    sendJson(res, 200, makeSetupResponse(manifest));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    sendError(res, 500, "complete_welcome_failed", detail);
  }
}

export async function handlePostCompleteProviders(
  _req: IncomingMessage,
  res: ServerResponse,
  config: SetupHandlerConfig
): Promise<void> {
  try {
    const manifest = await persistProviderSetupCompleted(config.rootDirectory);
    sharedEventBus.emit(createSetupUpdatedEvent());
    sendJson(res, 200, makeSetupResponse(manifest));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    sendError(res, 500, "complete_providers_failed", detail);
  }
}

export async function handlePostCompleteWorkspace(
  _req: IncomingMessage,
  res: ServerResponse,
  config: SetupHandlerConfig
): Promise<void> {
  try {
    const manifest = await persistWorkspaceSetupCompleted(config.rootDirectory);
    sharedEventBus.emit(createSetupUpdatedEvent());
    sendJson(res, 200, makeSetupResponse(manifest));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    sendError(res, 500, "complete_workspace_failed", detail);
  }
}
