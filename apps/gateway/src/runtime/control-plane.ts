import type {
  ArtifactMetadata,
  FactoryControlPlaneProjection,
  FirstAidIncidentProjection,
  RunEventLogEntry,
  RunManifest,
  SkillManifest,
  SkillSupplyProjection,
  UpdateControlProjection
} from "@srp/shared-types";

function latestArtifact(artifacts: readonly ArtifactMetadata[]): ArtifactMetadata | undefined {
  return [...artifacts].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  })[0];
}

export function deriveSkillSupply(skills: readonly SkillManifest[]): SkillSupplyProjection {
  const categoryCounts = new Map<string, number>();
  let audit = 0;
  let development = 0;

  for (const skill of skills) {
    const category = skill.category || "uncategorized";
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    const haystack = `${skill.category} ${skill.tags.join(" ")} ${skill.description}`.toLowerCase();
    if (/(audit|security|vuln|threat|exploit)/.test(haystack)) {
      audit += 1;
    }
    if (/(dev|build|frontend|backend|dapp|contract|ship|ci\/cd|deploy)/.test(haystack)) {
      development += 1;
    }
  }

  return {
    total: skills.length,
    audit,
    development,
    categories: [...categoryCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4)
      .map(([label, count]) => ({ label, count }))
  };
}

function deriveIncidentStatus(
  run: RunManifest,
  repairArtifacts: readonly ArtifactMetadata[]
): FirstAidIncidentProjection["status"] {
  if (run.status === "failed") {
    return "blocked";
  }
  if (repairArtifacts.some((artifact) => artifact.kind === "report")) {
    return "ready";
  }
  if (repairArtifacts.some((artifact) => artifact.kind === "test")) {
    return "active";
  }
  return "queued";
}

function deriveIncidentDetail(
  run: RunManifest,
  repairArtifacts: readonly ArtifactMetadata[],
  events: readonly RunEventLogEntry[]
): string {
  const failureDetail = [...events]
    .reverse()
    .find((event) => event.type === "session.failed")?.detail;
  if (failureDetail) {
    return failureDetail;
  }

  const latest = latestArtifact(repairArtifacts);
  if (latest) {
    return `${latest.kind} artifact captured during ${latest.phase}`;
  }

  return run.currentPhase
    ? `Repair lane waiting on evidence from ${run.currentPhase}`
    : "Repair lane waiting on first reproducible artifact";
}

export function deriveControlPlaneProjection(input: {
  readonly runs: readonly RunManifest[];
  readonly skills: readonly SkillManifest[];
  readonly eventsByRun: ReadonlyMap<string, readonly RunEventLogEntry[]>;
  readonly webDistReady: boolean;
}): FactoryControlPlaneProjection {
  const runs = [...input.runs].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const firstAidIncidents: FirstAidIncidentProjection[] = runs
    .filter((run) => run.status === "failed" || run.artifacts.some((artifact) => ["finding", "test", "report"].includes(artifact.kind)))
    .slice(0, 5)
    .map((run) => {
      const repairArtifacts = run.artifacts.filter((artifact) => ["finding", "test", "report"].includes(artifact.kind));
      const events = input.eventsByRun.get(run.runId) ?? [];
      const latest = latestArtifact(repairArtifacts);
      return {
        runId: run.runId,
        title:
          latest?.title ??
          (run.status === "failed" ? `Repair failed run ${run.runId.slice(-6)}` : `Repair queue ${run.runId.slice(-6)}`),
        detail: deriveIncidentDetail(run, repairArtifacts, events),
        source: latest?.phase ?? run.currentPhase ?? "runtime",
        status: deriveIncidentStatus(run, repairArtifacts),
        evidenceCount: repairArtifacts.length
      };
    });

  const latestRun = runs[0];
  const failedRuns = runs.filter((run) => run.status === "failed").length;
  const updateNotes = [
    input.webDistReady ? "web dist present" : "web dist missing",
    input.skills.length > 0 ? `${input.skills.length} curated skills loaded` : "skill registry empty",
    latestRun ? `latest run ${latestRun.status}` : "no persisted runs yet"
  ];

  const updateControl: UpdateControlProjection = {
    source: "repo-local",
    webDistReady: input.webDistReady,
    skillRegistryReady: input.skills.length > 0,
    totalRuns: runs.length,
    failedRuns,
    ...(latestRun
      ? {
          latestRunId: latestRun.runId,
          latestRunStatus: latestRun.status,
          latestRunAt: latestRun.completedAt ?? latestRun.createdAt
        }
      : {}),
    notes: updateNotes
  };

  return {
    skillSupply: deriveSkillSupply(input.skills),
    firstAid: {
      openIncidents: firstAidIncidents.length,
      readyForPromotion: firstAidIncidents.filter((incident) => incident.status === "ready").length,
      releaseBlocked: firstAidIncidents.some((incident) => incident.status === "blocked"),
      incidents: firstAidIncidents
    },
    updateControl
  };
}
