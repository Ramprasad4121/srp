import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { SetupManifest, ProviderSelection, WorkspaceSelection, RuntimeMode } from "@srp/shared-types";
import { 
  createSetupManifest, 
  updateSetupRole, 
  replaceProviderSelections, 
  updateWorkspaceSelection, 
  completeWelcomeStep, 
  completeProviderSetup, 
  completeWorkspaceSetup 
} from "./index.js";

export const defaultSetupConfigRelativePath = "config/setup.json";

export function getSetupConfigPath(rootDirectory: string): string {
  return join(rootDirectory, ".srp", defaultSetupConfigRelativePath);
}

export async function loadSetupManifest(rootDirectory: string): Promise<SetupManifest | null> {
  const path = getSetupConfigPath(rootDirectory);

  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as SetupManifest;
  } catch (error) {
    const maybeNodeError = error as NodeJS.ErrnoException;
    if (maybeNodeError.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function saveSetupManifest(
  rootDirectory: string,
  manifest: SetupManifest
): Promise<string> {
  const path = getSetupConfigPath(rootDirectory);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return path;
}

export async function loadOrCreateSetupManifest(rootDirectory: string): Promise<SetupManifest> {
  const existing = await loadSetupManifest(rootDirectory);
  if (existing) {
    return existing;
  }

  const manifest = createSetupManifest();
  await saveSetupManifest(rootDirectory, manifest);
  return manifest;
}

export async function updateSetupManifest(
  rootDirectory: string,
  updater: (manifest: SetupManifest) => SetupManifest
): Promise<SetupManifest> {
  const current = await loadOrCreateSetupManifest(rootDirectory);
  const updated = {
    ...updater(current),
    updatedAt: new Date().toISOString()
  };
  await saveSetupManifest(rootDirectory, updated);
  return updated;
}

export async function persistSetupRole(
  rootDirectory: string,
  role: RuntimeMode
): Promise<SetupManifest> {
  return updateSetupManifest(rootDirectory, (manifest) => ({
    ...manifest,
    state: updateSetupRole(manifest.state, role)
  }));
}

export async function persistProviderSelections(
  rootDirectory: string,
  providers: readonly ProviderSelection[]
): Promise<SetupManifest> {
  return updateSetupManifest(rootDirectory, (manifest) => ({
    ...manifest,
    state: replaceProviderSelections(manifest.state, providers)
  }));
}

export async function persistWorkspaceSelection(
  rootDirectory: string,
  workspace: Partial<WorkspaceSelection>
): Promise<SetupManifest> {
  return updateSetupManifest(rootDirectory, (manifest) => ({
    ...manifest,
    state: updateWorkspaceSelection(manifest.state, workspace)
  }));
}

export async function persistWelcomeCompleted(rootDirectory: string): Promise<SetupManifest> {
  return updateSetupManifest(rootDirectory, (manifest) => ({
    ...manifest,
    state: completeWelcomeStep(manifest.state)
  }));
}

export async function persistProviderSetupCompleted(rootDirectory: string): Promise<SetupManifest> {
  return updateSetupManifest(rootDirectory, (manifest) => ({
    ...manifest,
    state: completeProviderSetup(manifest.state)
  }));
}

export async function persistWorkspaceSetupCompleted(rootDirectory: string): Promise<SetupManifest> {
  return updateSetupManifest(rootDirectory, (manifest) => ({
    ...manifest,
    state: completeWorkspaceSetup(manifest.state)
  }));
}
