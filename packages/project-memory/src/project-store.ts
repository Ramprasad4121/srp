import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  migrateLegacyLayout,
  projectDir,
  projectMetadataPath,
  registryPath,
  srpRoot
} from "./migrate.js";
import {
  DEFAULT_PROJECT_ID,
  DEFAULT_PROJECT_NAME,
  type Project,
  type ProjectMetadataFile,
  type ProjectsRegistryFile
} from "./types.js";

/** Inputs accepted by `ProjectStore.create`. */
export interface CreateProjectInput {
  /** Human-readable display name. Required, may not be empty. */
  name: string;
  /**
   * Optional explicit id. If omitted, the id is derived from `name` (lower-
   * cased, non-alphanumerics → `-`). Conflicts throw.
   */
  id?: string;
}

const ID_FALLBACK_PREFIX = "project";

function slugifyName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  if (slug.length > 0) return slug;
  // All-symbol names degrade to a timestamp-based id so we still get a stable
  // path on disk.
  return `${ID_FALLBACK_PREFIX}-${Date.now().toString(36)}`;
}

/**
 * Filesystem-backed registry of projects under a single workspace root.
 *
 * Responsibilities:
 *  - Owns reads/writes of `<root>/.srp/projects.json` and per-project
 *    `<root>/.srp/projects/<id>/project.json`.
 *  - Triggers `migrateLegacyLayout` on `init`, so callers never have to think
 *    about the legacy `.srp/runs/` shape.
 *  - Tracks which project is "active" — the implicit target for handlers and
 *    CLI commands that don't specify one.
 *
 * `ProjectStore` does **not** know about runs, artifacts, or persistence
 * managers — that lives in `ProjectMemory`, which composes a store with a
 * project id.
 */
export class ProjectStore {
  private readonly rootDirectory: string;
  private cache: ProjectsRegistryFile | null = null;
  private initialized = false;

  constructor(rootDirectory: string) {
    this.rootDirectory = rootDirectory;
  }

  /**
   * Lazy-init: ensures `.srp/` exists, runs the legacy-layout migration, and
   * loads the registry into memory. Safe to call repeatedly.
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    await mkdir(srpRoot(this.rootDirectory), { recursive: true });
    await migrateLegacyLayout(this.rootDirectory);
    this.cache = await this.readRegistry();
    // A workspace must always have at least one project so that handlers and
    // the CLI can resolve an "active project" without surprising the user.
    // The migration only creates the default entry when it actually had to
    // move legacy data, so on a brand-new workspace we seed it here.
    if (this.cache.projects.length === 0) {
      await this.seedDefaultProject();
    }
    this.initialized = true;
  }

  private async seedDefaultProject(): Promise<void> {
    const now = new Date().toISOString();
    const project: Project = {
      id: DEFAULT_PROJECT_ID,
      name: DEFAULT_PROJECT_NAME,
      createdAt: now
    };
    await mkdir(projectDir(this.rootDirectory, DEFAULT_PROJECT_ID), {
      recursive: true
    });
    const meta: ProjectMetadataFile = {
      version: 1,
      id: DEFAULT_PROJECT_ID,
      name: DEFAULT_PROJECT_NAME,
      createdAt: now,
      updatedAt: now
    };
    await writeFile(
      projectMetadataPath(this.rootDirectory, DEFAULT_PROJECT_ID),
      JSON.stringify(meta, null, 2),
      "utf8"
    );
    this.cache!.projects.push(project);
    if (!this.cache!.activeProjectId) {
      this.cache!.activeProjectId = DEFAULT_PROJECT_ID;
    }
    await this.writeRegistry(this.cache!);
  }

  /** Returns all known projects. Implicitly initializes. */
  async list(): Promise<Project[]> {
    await this.init();
    return this.cache!.projects.map((p) => ({ ...p }));
  }

  /** Returns a project by id, or `null` if no such project exists. */
  async get(projectId: string): Promise<Project | null> {
    await this.init();
    const found = this.cache!.projects.find((p) => p.id === projectId);
    return found ? { ...found } : null;
  }

  /**
   * Returns the currently active project, or `null` if the registry is empty.
   * In normal flows the registry is seeded with the default project on init,
   * so this returns a value; the `null` branch only happens when a caller has
   * explicitly removed all projects.
   */
  async getActive(): Promise<Project | null> {
    await this.init();
    const id = this.cache!.activeProjectId;
    if (!id) return null;
    return this.get(id);
  }

  /**
   * Sets which project id is treated as active. Throws if the id is unknown,
   * to prevent silently resolving to a missing project later.
   */
  async setActive(projectId: string): Promise<void> {
    await this.init();
    const exists = this.cache!.projects.some((p) => p.id === projectId);
    if (!exists) {
      throw new Error(`ProjectStore.setActive: unknown project id "${projectId}".`);
    }
    this.cache!.activeProjectId = projectId;
    await this.writeRegistry(this.cache!);
  }

  /**
   * Creates a new project. Writes both the registry entry and the per-project
   * metadata file. If no project was active before, the new one becomes
   * active.
   *
   * Throws if the resolved id collides with an existing project; callers
   * should pass an explicit `id` when retrying.
   */
  async create(input: CreateProjectInput): Promise<Project> {
    await this.init();
    const name = input.name.trim();
    if (name.length === 0) {
      throw new Error("ProjectStore.create: name must be non-empty.");
    }
    const id = input.id?.trim() || slugifyName(name);
    if (this.cache!.projects.some((p) => p.id === id)) {
      throw new Error(
        `ProjectStore.create: project id "${id}" already exists. ` +
          `Pass an explicit \`id\` to disambiguate.`
      );
    }

    const now = new Date().toISOString();
    const project: Project = { id, name, createdAt: now };

    await mkdir(projectDir(this.rootDirectory, id), { recursive: true });
    const meta: ProjectMetadataFile = {
      version: 1,
      id,
      name,
      createdAt: now,
      updatedAt: now
    };
    await writeFile(
      projectMetadataPath(this.rootDirectory, id),
      JSON.stringify(meta, null, 2),
      "utf8"
    );

    this.cache!.projects.push(project);
    if (!this.cache!.activeProjectId) {
      this.cache!.activeProjectId = id;
    }
    await this.writeRegistry(this.cache!);
    return { ...project };
  }

  // --- private --------------------------------------------------------------

  private async readRegistry(): Promise<ProjectsRegistryFile> {
    try {
      const raw = await readFile(registryPath(this.rootDirectory), "utf8");
      const parsed = JSON.parse(raw) as ProjectsRegistryFile;
      if (parsed?.version !== 1 || !Array.isArray(parsed.projects)) {
        throw new Error("registry has unexpected shape");
      }
      return parsed;
    } catch {
      // Migration always creates the registry; this branch is a safety net for
      // a registry file that was deleted or corrupted between init steps.
      const fallback: ProjectsRegistryFile = {
        version: 1,
        activeProjectId: DEFAULT_PROJECT_ID,
        projects: [
          {
            id: DEFAULT_PROJECT_ID,
            name: DEFAULT_PROJECT_NAME,
            createdAt: new Date().toISOString()
          }
        ]
      };
      await this.writeRegistry(fallback);
      return fallback;
    }
  }

  private async writeRegistry(file: ProjectsRegistryFile): Promise<void> {
    await mkdir(srpRoot(this.rootDirectory), { recursive: true });
    await writeFile(
      registryPath(this.rootDirectory),
      JSON.stringify(file, null, 2),
      "utf8"
    );
  }
}
