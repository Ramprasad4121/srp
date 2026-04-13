import type {
  ArtifactGraphEdge,
  ArtifactGraphNode,
  ArtifactKind,
  ArtifactMetadata,
  ArtifactGraphSnapshot,
  AuditFindingProjection,
  AuditRoomProjection,
  FindingRegistry,
  MethodologyPhase,
  PhaseState,
  RunManifest,
  RunEventLogEntry,
  RuntimeTimelineEntry,
  SessionStatus
} from "@srp/shared-types";

function makeNodeId(kind: string, sourceId: string): string {
  return `${kind}:${sourceId}`;
}

function pushUniqueEdge(edges: ArtifactGraphEdge[], edge: ArtifactGraphEdge): void {
  if (!edges.some((candidate) => candidate.id === edge.id)) {
    edges.push(edge);
  }
}

function createTimelineEntry(event: RunEventLogEntry): RuntimeTimelineEntry {
  const entry = {
    id: event.eventId,
    at: event.emittedAt,
    type: event.type,
    title:
      event.title ??
      (event.type === "artifact.created"
        ? event.artifactTitle ?? "Artifact created"
        : event.type === "phase.status.changed"
          ? `${event.phase ?? "phase"} ${event.status ?? "updated"}`
          : event.type.replace(".", " "))
  };
  return Object.assign(
    entry,
    event.detail ? { detail: event.detail } : {},
    event.phase ? { phase: event.phase } : {},
    event.status ? { status: event.status as RuntimeTimelineEntry["status"] } : {}
  ) as RuntimeTimelineEntry;
}

export class AuditRoomProjector {
  private notes: ArtifactMetadata[] = [];
  private diagrams: ArtifactMetadata[] = [];
  private evidence: ArtifactMetadata[] = [];
  private findings: AuditFindingProjection[] = [];
  private timeline: RuntimeTimelineEntry[] = [];
  private graphNodes: ArtifactGraphNode[] = [];
  private graphEdges: ArtifactGraphEdge[] = [];
  private runStatus: SessionStatus = "idle";
  private lastFailure: string | undefined;
  private runId: string | null = null;
  private sessionId: string | null = null;

  reset(runId: string | null, sessionId: string | null): void {
    this.notes = [];
    this.diagrams = [];
    this.evidence = [];
    this.findings = [];
    this.timeline = [];
    this.graphNodes = [];
    this.graphEdges = [];
    this.runStatus = "idle";
    this.lastFailure = undefined;
    this.runId = runId;
    this.sessionId = sessionId;
  }

  applyRunEvent(event: RunEventLogEntry): void {
    this.timeline = [createTimelineEntry(event), ...this.timeline].slice(0, 50);

    if (event.type === "session.started") this.runStatus = "running";
    if (event.type === "session.completed") this.runStatus = "completed";
    if (event.type === "session.failed") {
      this.runStatus = "failed";
      this.lastFailure = event.detail;
    }
  }

  applyArtifact(metadata: ArtifactMetadata, payload: unknown): void {
    const artifactNode: ArtifactGraphNode = {
      id: makeNodeId("artifact", metadata.artifactId),
      kind: this.mapArtifactKind(metadata.kind),
      title: metadata.title,
      phase: metadata.phase,
      artifactId: metadata.artifactId,
      createdAt: metadata.createdAt
    };
    this.graphNodes.push(artifactNode);

    if (metadata.kind === "diagram") {
      this.diagrams = [metadata, ...this.diagrams];
    } else if (metadata.kind === "finding") {
      this.evidence = [metadata, ...this.evidence];
    } else if (metadata.kind === "report" || metadata.kind === "test") {
      this.evidence = [metadata, ...this.evidence];
    } else {
      this.notes = [metadata, ...this.notes];
    }

    if (metadata.kind === "finding") {
      this.ingestFindingRegistry(metadata, payload);
    }

    if (metadata.kind === "invariant") {
      this.ingestArrayPayload(metadata, payload, "invariants", "invariant");
    }

    if (metadata.kind === "hypothesis") {
      this.ingestArrayPayload(metadata, payload, "hypotheses", "hypothesis");
    }
  }

  snapshot(phases: readonly PhaseState[], currentPhase: MethodologyPhase | null): AuditRoomProjection {
    const completedPhases = phases.filter((phase) => phase.status === "completed").length;
    return {
      missionControl: {
        runId: this.runId,
        sessionId: this.sessionId,
        runStatus: this.runStatus,
        currentPhase,
        completedPhases,
        totalPhases: phases.length,
        ...(this.lastFailure ? { lastFailure: this.lastFailure } : {})
      },
      timeline: this.timeline,
      notes: this.notes,
      diagrams: this.diagrams,
      findings: this.findings,
      evidence: this.evidence,
      graph: {
        nodes: this.graphNodes,
        edges: this.graphEdges
      }
    };
  }

  private mapArtifactKind(kind: ArtifactKind): ArtifactGraphNode["kind"] {
    if (kind === "diagram") return "diagram";
    if (kind === "finding") return "finding";
    if (kind === "hypothesis") return "hypothesis";
    if (kind === "invariant") return "invariant";
    if (kind === "report") return "report";
    if (kind === "test") return "evidence";
    return "note";
  }

  private ingestFindingRegistry(metadata: ArtifactMetadata, payload: unknown): void {
    const registry = payload as FindingRegistry | undefined;
    const findings = registry?.findings ?? [];
    for (const finding of findings) {
      const findingNode: ArtifactGraphNode = {
        id: makeNodeId("finding", finding.id),
        kind: "finding",
        title: finding.title,
        phase: metadata.phase,
        status: finding.status,
        severity: finding.severity,
        artifactId: metadata.artifactId,
        createdAt: metadata.createdAt
      };
      this.graphNodes.push(findingNode);
      pushUniqueEdge(this.graphEdges, {
        id: `${findingNode.id}->${makeNodeId("artifact", metadata.artifactId)}:belongs_to`,
        from: findingNode.id,
        to: makeNodeId("artifact", metadata.artifactId),
        type: "belongs_to"
      });
      this.findings = [
        ...this.findings.filter((candidate) => candidate.id !== finding.id),
        {
          id: finding.id,
          title: finding.title,
          severity: finding.severity,
          status: finding.status,
          evidenceCount: (finding.proof ? 1 : 0) + finding.impactedInvariantIds.length,
          phase: metadata.phase
        }
      ].sort((left, right) => left.title.localeCompare(right.title));
    }
  }

  private ingestArrayPayload(
    metadata: ArtifactMetadata,
    payload: unknown,
    key: string,
    nodeKind: ArtifactGraphNode["kind"]
  ): void {
    const items = Array.isArray((payload as Record<string, unknown> | undefined)?.[key])
      ? ((payload as Record<string, unknown>)[key] as readonly Record<string, unknown>[])
      : [];
    for (const item of items) {
      const itemId = typeof item.id === "string" ? item.id : `${metadata.artifactId}:${key}:${this.graphNodes.length}`;
      const title = typeof item.title === "string" ? item.title : metadata.title;
      const nodeId = makeNodeId(nodeKind, itemId);
      this.graphNodes.push({
        id: nodeId,
        kind: nodeKind,
        title,
        phase: metadata.phase,
        artifactId: metadata.artifactId,
        createdAt: metadata.createdAt
      });
      pushUniqueEdge(this.graphEdges, {
        id: `${nodeId}->${makeNodeId("artifact", metadata.artifactId)}:belongs_to`,
        from: nodeId,
        to: makeNodeId("artifact", metadata.artifactId),
        type: "belongs_to"
      });
    }
  }
}

export function rebuildAuditRoomProjection(input: {
  readonly manifest: RunManifest;
  readonly events: readonly RunEventLogEntry[];
  readonly payloads: Readonly<Record<string, unknown>>;
}): AuditRoomProjection {
  const projector = new AuditRoomProjector();
  projector.reset(input.manifest.runId, input.manifest.sessionId);
  for (const event of input.events) {
    projector.applyRunEvent(event);
  }
  for (const metadata of input.manifest.artifacts) {
    projector.applyArtifact(metadata, input.payloads[metadata.artifactId]);
  }
  const phases: PhaseState[] = [];
  const lastPhaseEvents = input.events.filter((event) => event.type === "phase.status.changed" && event.phase);
  for (const event of lastPhaseEvents) {
    const existingIndex = phases.findIndex((phase) => phase.phase === event.phase);
    const state: PhaseState = {
      phase: event.phase!,
      status: (event.status as PhaseState["status"]) ?? "pending"
    };
    if (existingIndex === -1) phases.push(state);
    else phases[existingIndex] = state;
  }
  return projector.snapshot(phases, input.manifest.currentPhase ?? null);
}
