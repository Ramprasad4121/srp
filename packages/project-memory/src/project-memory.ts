import { mkdir } from "node:fs/promises";
import {
  migrateLegacyLayout,
  projectDir,
  projectRunsDir,
  srpRoot
} from "./migrate.js";
import { ProjectStore } from "./project-store.js";
import type { Project } from "./types.js";

/**
 * Per-project facade that resolves filesystem paths and exposes the
 * `(rootDirectory, projectId)` pair used by run-scoped persistence.
 *
 * `ProjectMemory` is intentionally thin: it does NOT own a `PersistenceManager`
 * (the gateway's runtime registry constructs that on demand with paths from
 * here). Holding the manager here would force `@srp/project-memory` to depend
 * on gateway-internal types, breaking layering.
 *
 * The factory `forActive(rootDirectory)` is the standard way to obtain an
 * instance from a handler that doesn't carry an explicit project id.
 */
export class ProjectMemory {
  readonly rootDirectory: string;
  readonly project: Project;

  private constructor(rootDirectory: string, project: Project) {
    this.rootDirectory = rootDirectory;
    this.project = project;
  }

  /**
   * Build a `ProjectMemory` for a specific project id. Throws if the id is
   * unknown so the caller can fail loudly instead of writing to a phantom
   * directory.
   */
  static async forProject(
    rootDirectory: string,
    projectId: string,
    store?: ProjectStore
  ): Promise<ProjectMemory> {
    await mkdir(srpRoot(rootDirectory), { recursive: true });
    await migrateLegacyLayout(rootDirectory);
    const s = store ?? new ProjectStore(rootDirectory);
    await s.init();
    const project = await s.get(projectId);
    if (!project) {
      throw new Error(
        `ProjectMemory.forProject: unknown project id "${projectId}".`
      );
    }
    return new ProjectMemory(rootDirectory, project);
  }

  /**
   * Build a `ProjectMemory` for whichever project the registry currently
   * marks as active. Throws if the registry has no projects (callers should
   * have created at least one via the migration or `ProjectStore.create`).
   */
  static async forActive(
    rootDirectory: string,
    store?: ProjectStore
  ): Promise<ProjectMemory> {
    await mkdir(srpRoot(rootDirectory), { recursive: true });
    await migrateLegacyLayout(rootDirectory);
    const s = store ?? new ProjectStore(rootDirectory);
    await s.init();
    const project = await s.getActive();
    if (!project) {
      throw new Error(
        "ProjectMemory.forActive: no active project. The registry is empty."
      );
    }
    return new ProjectMemory(rootDirectory, project);
  }

  /** Stable id of the underlying project. */
  get projectId(): string {
    return this.project.id;
  }

  /**
   * Absolute path to `<rootDirectory>/.srp/projects/<id>/`. Consumers that
   * need a more specific path should derive it from `runsDir` or compose
   * directly off this value, never re-deriving the project layout.
   */
  get projectDir(): string {
    return projectDir(this.rootDirectory, this.project.id);
  }

  /**
   * Absolute path to the runs directory for this project. This is the value
   * that callers pass into `PersistenceManager` (alongside the project id) so
   * runs land in the project-scoped layout.
   */
  get runsDir(): string {
    return projectRunsDir(this.rootDirectory, this.project.id);
  }

  /**
   * Output directory relative to `rootDirectory`, kept for compatibility with
   * `PersistenceManager`'s `outputDirectory` parameter (default `.srp`).
   */
  static defaultOutputDirectory(): string {
    return ".srp";
  }
}
