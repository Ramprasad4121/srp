import type {
  ArtifactMetadata,
  ArtifactKind,
  MethodologyPhase,
  PhaseStatus,
  RunEventLogEntry,
  SessionStatus
} from "@srp/shared-types";
import { createArtifactCreatedEvent, createPhaseStatusChangedEvent } from "@srp/events";
import { sharedEventBus } from "../events/event-bus.js";
import type { PersistenceManager } from "./persistence-manager.js";
import type { AuditRoomProjector } from "./room-projection.js";

function makeEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export class RuntimeArtifactWriter {
  constructor(
    private readonly persistence: PersistenceManager,
    private readonly projector: AuditRoomProjector
  ) {}

  async appendEvent(runId: string, event: RunEventLogEntry): Promise<void> {
    this.projector.applyRunEvent(event);
    await this.persistence.appendEvent(runId, event);
  }

  async recordSessionLifecycle(
    runId: string,
    projectId: string,
    type: "session.started" | "session.completed" | "session.failed",
    detail?: string
  ): Promise<void> {
    await this.appendEvent(runId, {
      eventId: makeEventId(),
      runId,
      projectId,
      type,
      emittedAt: new Date().toISOString(),
      title: type.replace(".", " "),
      ...(detail ? { detail } : {})
    });
  }

  async recordPhaseStatus(
    runId: string,
    projectId: string,
    phase: MethodologyPhase,
    status: PhaseStatus,
    sessionStatus: SessionStatus
  ): Promise<void> {
    const phaseEvent = createPhaseStatusChangedEvent({
      projectId,
      runId,
      phase,
      status
    });
    sharedEventBus.emit(phaseEvent);

    if (status === "running" || status === "completed" || status === "failed") {
      await this.persistence.updateRunStatus(runId, sessionStatus, phase);
    }

    await this.appendEvent(runId, {
      eventId: makeEventId(),
      runId,
      projectId,
      type: "phase.status.changed",
      emittedAt: phaseEvent.emittedAt,
      phase,
      status,
      title: `${phase} ${status}`
    });
  }

  async persistArtifact(
    runId: string,
    projectId: string,
    phase: MethodologyPhase,
    kind: ArtifactKind,
    title: string,
    payload: unknown
  ): Promise<ArtifactMetadata> {
    const metadata = await this.persistence.saveArtifact(runId, projectId, phase, kind, title, payload);
    this.projector.applyArtifact(metadata, payload);
    const artifactEvent = createArtifactCreatedEvent({
      projectId,
      runId,
      phase,
      artifactId: metadata.artifactId,
      artifactKind: metadata.kind,
      artifactTitle: metadata.title
    });
    sharedEventBus.emit(artifactEvent);

    await this.appendEvent(runId, {
      eventId: makeEventId(),
      runId,
      projectId,
      type: "artifact.created",
      emittedAt: artifactEvent.emittedAt,
      phase,
      artifactId: metadata.artifactId,
      artifactKind: metadata.kind,
      artifactTitle: metadata.title,
      title
    });
    return metadata;
  }
}
