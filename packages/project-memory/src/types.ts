/**
 * Persistent shape of a single project entry.
 *
 * A project is the top-level organizational unit in SRP: one project owns
 * one or more audit runs, plus its own metadata. On disk this lives under
 * `<rootDirectory>/.srp/projects/<id>/`.
 */
export interface Project {
  /** Stable, URL-safe identifier (e.g. "default-project"). */
  readonly id: string;
  /** Human-readable display name. */
  name: string;
  /** ISO timestamp of project creation. */
  readonly createdAt: string;
  /** ISO timestamp of the last metadata update. */
  updatedAt?: string;
}

/**
 * Persistent shape of `<rootDirectory>/.srp/projects.json`.
 *
 * This file is the single source of truth for which projects exist and which
 * one is currently active. Per-project metadata lives in
 * `<rootDirectory>/.srp/projects/<id>/project.json` and must agree with the
 * corresponding entry here.
 */
export interface ProjectsRegistryFile {
  /** Schema version; bump when the file format changes incompatibly. */
  readonly version: 1;
  /**
   * Id of the project that is treated as the default target when no explicit
   * project is supplied. May be `null` only when the registry has zero
   * projects.
   */
  activeProjectId: string | null;
  /** All known projects in stable order. */
  projects: Project[];
}

/**
 * Per-project metadata file: `<rootDirectory>/.srp/projects/<id>/project.json`.
 */
export interface ProjectMetadataFile {
  readonly version: 1;
  readonly id: string;
  name: string;
  readonly createdAt: string;
  updatedAt: string;
}

/**
 * The id used for the seed project and as the migration target for legacy
 * `.srp/runs/` data. This literal must NOT be used elsewhere as a default —
 * callers that need "the active project" should resolve it through
 * `ProjectStore.getActive()` so per-user choices survive.
 */
export const DEFAULT_PROJECT_ID = "default-project";

/** Display name paired with `DEFAULT_PROJECT_ID` when seeding. */
export const DEFAULT_PROJECT_NAME = "Default Project";
