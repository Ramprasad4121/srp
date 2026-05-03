import { appendFile, mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { 
  RunManifest, 
  ArtifactMetadata, 
  ArtifactKind, 
  MethodologyPhase,
  ProjectMemory,
  SessionStatus,
  RunEventLogEntry
} from "@srp/shared-types";
import { createDefaultProjectMemory } from "@srp/config";

/**
 * Project-scoped run persistence.
 *
 * On disk, all runs land under
 * `<rootDirectory>/<outputDirectory>/projects/<projectId>/runs/<runId>/...`.
 * The `projectId` is required so the gateway can keep multiple projects'
 * runs cleanly separated; it is wired through every constructor call.
 *
 * For the legacy `<outputDirectory>/runs/<runId>` shape, callers must run
 * `migrateLegacyLayout` (from `@srp/project-memory`) before instantiating
 * this class — `ProjectStore.init` does so automatically.
 */
export class PersistenceManager {
  private readonly runsDir: string;
  private readonly projectMemoryPath: string;
  private readonly projectId: string;

  constructor(rootDirectory: string, projectId: string, outputDirectory: string = ".srp") {
    this.projectId = projectId;
    const projectBase = join(rootDirectory, outputDirectory, "projects", projectId);
    this.runsDir = join(projectBase, "runs");
    this.projectMemoryPath = join(projectBase, "project.json");
  }

  async init(): Promise<void> {
    await mkdir(this.runsDir, { recursive: true });
  }

  async loadOrCreateProjectMemory(identity: ProjectMemory["identity"]): Promise<ProjectMemory> {
    const existing = await this.getProjectMemory();
    if (existing) {
      if (
        existing.identity.userProfile === identity.userProfile &&
        existing.identity.goal === identity.goal &&
        existing.identity.department === identity.department
      ) {
        return existing;
      }

      const updated: ProjectMemory = {
        ...existing,
        identity,
        updatedAt: new Date().toISOString()
      };
      await this.saveProjectMemory(updated);
      return updated;
    }

    const created = createDefaultProjectMemory(this.projectId, identity);
    await this.saveProjectMemory(created);
    return created;
  }

  async getProjectMemory(): Promise<ProjectMemory | null> {
    try {
      const content = await readFile(this.projectMemoryPath, "utf8");
      return JSON.parse(content) as ProjectMemory;
    } catch {
      return null;
    }
  }

  async saveProjectMemory(projectMemory: ProjectMemory): Promise<void> {
    const data = JSON.parse(JSON.stringify(projectMemory));
    await writeFile(this.projectMemoryPath, JSON.stringify(data, null, 2), "utf8");
  }

  async createRun(runId: string, projectId: string, sessionId: string): Promise<RunManifest> {
    const runDir = join(this.runsDir, runId);
    await mkdir(runDir, { recursive: true });
    await mkdir(join(runDir, "artifacts"), { recursive: true });

    const manifest: RunManifest = {
      runId,
      projectId,
      sessionId,
      status: "running",
      createdAt: new Date().toISOString(),
      artifacts: []
    };

    await this.saveManifest(manifest);
    const projectMemory = await this.getProjectMemory();
    if (projectMemory) {
      await this.saveProjectMemory({
        ...projectMemory,
        activeRunId: runId,
        latestRunId: runId,
        updatedAt: new Date().toISOString(),
        runIds: [...new Set([...projectMemory.runIds, runId])]
      });
    }
    return manifest;
  }

  async updateRunStatus(runId: string, status: SessionStatus, currentPhase?: MethodologyPhase): Promise<void> {
    const manifest = await this.getRun(runId);
    if (!manifest) return;

    const completedAt =
      status === "completed" || status === "failed"
        ? new Date().toISOString()
        : manifest.completedAt;
    const updated: RunManifest = {
      ...manifest,
      status
    };
    const phaseToPersist = currentPhase ?? manifest.currentPhase;
    if (phaseToPersist !== undefined) {
      (updated as { currentPhase?: MethodologyPhase }).currentPhase = phaseToPersist;
    }
    if (completedAt) {
      (updated as { completedAt?: string }).completedAt = completedAt;
    }

    await this.saveManifest(updated);
  }

  async saveArtifact(
    runId: string, 
    projectId: string,
    phase: MethodologyPhase,
    kind: ArtifactKind,
    title: string,
    payload: unknown
  ): Promise<ArtifactMetadata> {
    const artifactId = `art_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const runDir = join(this.runsDir, runId);
    const filePath = join(runDir, "artifacts", `${artifactId}.json`);

    await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");

    const metadata: ArtifactMetadata = {
      artifactId,
      kind,
      title,
      phase,
      runId,
      projectId,
      createdAt: new Date().toISOString()
    };

    const manifest = await this.getRun(runId);
    if (manifest) {
      const updated: RunManifest = {
        ...manifest,
        artifacts: [...manifest.artifacts, metadata]
      };
      await this.saveManifest(updated);
    }

    const projectMemory = await this.getProjectMemory();
    if (projectMemory) {
      await this.saveProjectMemory({
        ...projectMemory,
        latestRunId: runId,
        updatedAt: new Date().toISOString(),
        artifactIds: [...new Set([...projectMemory.artifactIds, artifactId])]
      });
    }

    return metadata;
  }

  async listRuns(): Promise<RunManifest[]> {
    try {
      const entries = await readdir(this.runsDir, { withFileTypes: true });
      const runs: RunManifest[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const run = await this.getRun(entry.name);
          if (run) runs.push(run);
        }
      }

      return runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (e) {
      return [];
    }
  }

  async getRun(runId: string): Promise<RunManifest | null> {
    try {
      const manifestPath = join(this.runsDir, runId, "manifest.json");
      const content = await readFile(manifestPath, "utf8");
      const data = JSON.parse(content) as RunManifest;
      return data;
    } catch (e) {
      return null;
    }
  }

  async getArtifact(runId: string, artifactId: string): Promise<unknown | null> {
    try {
      const filePath = join(this.runsDir, runId, "artifacts", `${artifactId}.json`);
      const content = await readFile(filePath, "utf8");
      return JSON.parse(content);
    } catch (e) {
      return null;
    }
  }

  async appendEvent(runId: string, event: RunEventLogEntry): Promise<void> {
    const runDir = join(this.runsDir, runId);
    await mkdir(runDir, { recursive: true });
    const eventsPath = join(runDir, "events.jsonl");
    await appendFile(eventsPath, `${JSON.stringify(event)}\n`, "utf8");
  }

  async listEvents(runId: string): Promise<RunEventLogEntry[]> {
    try {
      const eventsPath = join(this.runsDir, runId, "events.jsonl");
      const content = await readFile(eventsPath, "utf8");
      const lines = content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      return lines.map((line) => JSON.parse(line) as RunEventLogEntry);
    } catch (_error) {
      return [];
    }
  }

  private async saveManifest(manifest: RunManifest): Promise<void> {
    const manifestPath = join(this.runsDir, manifest.runId, "manifest.json");
    // strip undefined for cleaner JSON
    const data = JSON.parse(JSON.stringify(manifest));
    await writeFile(manifestPath, JSON.stringify(data, null, 2), "utf8");
  }
}
