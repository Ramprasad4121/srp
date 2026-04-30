/**
 * @srp/project-memory
 *
 * Owns the on-disk project layout (registry + per-project metadata) and the
 * legacy `.srp/runs/` migration. This package is the source of truth for:
 *
 *   <rootDirectory>/.srp/projects.json                      <-- registry
 *   <rootDirectory>/.srp/projects/<id>/project.json         <-- per project
 *   <rootDirectory>/.srp/projects/<id>/runs/<runId>/...     <-- run data
 *
 * Consumers should never assemble these paths by hand; either call into
 * `ProjectStore` / `ProjectMemory` or use the path helpers re-exported below.
 */

export {
  DEFAULT_PROJECT_ID,
  DEFAULT_PROJECT_NAME,
  type Project,
  type ProjectMetadataFile,
  type ProjectsRegistryFile
} from "./types.js";

export {
  migrateLegacyLayout,
  legacyRunsDir,
  projectDir,
  projectMetadataPath,
  projectRunsDir,
  projectsBaseDir,
  registryPath,
  srpRoot,
  type MigrationResult
} from "./migrate.js";

export { ProjectStore, type CreateProjectInput } from "./project-store.js";

export { ProjectMemory } from "./project-memory.js";
