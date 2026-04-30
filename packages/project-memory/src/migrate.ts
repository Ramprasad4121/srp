import { mkdir, readdir, rename, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  DEFAULT_PROJECT_ID,
  DEFAULT_PROJECT_NAME,
  type ProjectMetadataFile,
  type ProjectsRegistryFile
} from "./types.js";

/**
 * Layout produced by `migrateLegacyLayout` and consumed by `ProjectStore` and
 * `ProjectMemory`. Centralised here so any code that needs to derive paths
 * from a `(rootDirectory, projectId)` pair stays in agreement.
 */
export const SRP_DIR = ".srp";
export const PROJECTS_DIR = "projects";
export const REGISTRY_FILE = "projects.json";
export const PROJECT_METADATA_FILE = "project.json";
export const RUNS_DIR = "runs";

export function srpRoot(rootDirectory: string): string {
  return join(rootDirectory, SRP_DIR);
}

export function projectsBaseDir(rootDirectory: string): string {
  return join(srpRoot(rootDirectory), PROJECTS_DIR);
}

export function projectDir(rootDirectory: string, projectId: string): string {
  return join(projectsBaseDir(rootDirectory), projectId);
}

export function projectRunsDir(rootDirectory: string, projectId: string): string {
  return join(projectDir(rootDirectory, projectId), RUNS_DIR);
}

export function registryPath(rootDirectory: string): string {
  return join(srpRoot(rootDirectory), REGISTRY_FILE);
}

export function projectMetadataPath(rootDirectory: string, projectId: string): string {
  return join(projectDir(rootDirectory, projectId), PROJECT_METADATA_FILE);
}

export function legacyRunsDir(rootDirectory: string): string {
  return join(srpRoot(rootDirectory), RUNS_DIR);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function isNonEmptyDirectory(path: string): Promise<boolean> {
  try {
    const entries = await readdir(path);
    return entries.length > 0;
  } catch {
    return false;
  }
}

/**
 * Result of a migration attempt. Inspectable so callers (CLI, tests) can
 * report what happened without re-deriving it from the filesystem.
 */
export interface MigrationResult {
  /** Whether anything on disk was changed by this call. */
  readonly performed: boolean;
  /** Number of legacy run directories moved. Zero on a no-op. */
  readonly movedRunCount: number;
  /** True when the registry had to be created (vs already present). */
  readonly registryCreated: boolean;
  /** True when the seeded default project metadata had to be written. */
  readonly defaultProjectCreated: boolean;
}

/**
 * Migrate any legacy `.srp/runs/` data into the project-scoped layout
 * `.srp/projects/<DEFAULT_PROJECT_ID>/runs/`, and seed the
 * `.srp/projects.json` registry if it is missing.
 *
 * This function is **idempotent**: calling it on an already-migrated
 * workspace, or on a brand-new workspace, performs no destructive action and
 * returns a `MigrationResult` describing what (if anything) it did.
 *
 * Trigger sites: `ProjectStore.init` and `ProjectMemory.init` both invoke
 * this before reading any project state, so the rest of the codebase can
 * assume the modern layout always exists.
 */
export async function migrateLegacyLayout(rootDirectory: string): Promise<MigrationResult> {
  const result = {
    performed: false,
    movedRunCount: 0,
    registryCreated: false,
    defaultProjectCreated: false
  };

  // Ensure the .srp root exists; on a brand-new workspace this is the only
  // side-effect and we still report `performed: false` because no data move
  // and no registry seeding occurred.
  await mkdir(srpRoot(rootDirectory), { recursive: true });

  const legacy = legacyRunsDir(rootDirectory);
  const targetRunsDir = projectRunsDir(rootDirectory, DEFAULT_PROJECT_ID);
  const hasLegacy = await isNonEmptyDirectory(legacy);
  const hasTargetWithData = await isNonEmptyDirectory(targetRunsDir);

  if (hasLegacy && !hasTargetWithData) {
    await mkdir(projectDir(rootDirectory, DEFAULT_PROJECT_ID), { recursive: true });
    await mkdir(targetRunsDir, { recursive: true });

    const entries = await readdir(legacy, { withFileTypes: true });
    for (const entry of entries) {
      const src = join(legacy, entry.name);
      const dst = join(targetRunsDir, entry.name);
      if (await pathExists(dst)) {
        // Conservative: never overwrite an existing target run.
        continue;
      }
      await rename(src, dst);
      result.movedRunCount += 1;
      (result as { performed: boolean }).performed = true;
    }
  }

  // Make sure the registry exists. If we just moved data, or if a default
  // project directory exists from any prior step, seed the default project
  // entry so later reads can resolve it.
  const registry = registryPath(rootDirectory);
  if (!(await pathExists(registry))) {
    const haveDefaultDir = await pathExists(projectDir(rootDirectory, DEFAULT_PROJECT_ID));
    const seedProjects = haveDefaultDir
      ? [
          {
            id: DEFAULT_PROJECT_ID,
            name: DEFAULT_PROJECT_NAME,
            createdAt: new Date().toISOString()
          }
        ]
      : [];
    const file: ProjectsRegistryFile = {
      version: 1,
      activeProjectId: haveDefaultDir ? DEFAULT_PROJECT_ID : null,
      projects: seedProjects
    };
    await writeFile(registry, JSON.stringify(file, null, 2), "utf8");
    (result as { registryCreated: boolean }).registryCreated = true;
    (result as { performed: boolean }).performed = true;
  }

  // If the default project directory exists but its metadata file does not
  // (older partial states), write it. This keeps `<id>/project.json` and the
  // registry entry in sync.
  const defaultDir = projectDir(rootDirectory, DEFAULT_PROJECT_ID);
  if (await pathExists(defaultDir)) {
    const metaPath = projectMetadataPath(rootDirectory, DEFAULT_PROJECT_ID);
    if (!(await pathExists(metaPath))) {
      const now = new Date().toISOString();
      const meta: ProjectMetadataFile = {
        version: 1,
        id: DEFAULT_PROJECT_ID,
        name: DEFAULT_PROJECT_NAME,
        createdAt: now,
        updatedAt: now
      };
      await writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");
      (result as { defaultProjectCreated: boolean }).defaultProjectCreated = true;
      (result as { performed: boolean }).performed = true;
    }
  }

  return result;
}
