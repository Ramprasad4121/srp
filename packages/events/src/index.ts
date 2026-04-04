import type { ArtifactKind, IdentifiedRecord, MethodologyPhase } from "@srp/shared-types";

// ---------------------------------------------------------------------------
// Core Event Types
// ---------------------------------------------------------------------------

export interface SessionStartedEvent extends IdentifiedRecord {
  readonly sessionId: string;
  readonly type: "session.started";
  readonly emittedAt: string;
}

export interface SessionCompletedEvent extends IdentifiedRecord {
  readonly sessionId: string;
  readonly type: "session.completed";
  readonly totalPhases: number;
  readonly totalArtifacts: number;
  readonly durationMs: number;
  readonly emittedAt: string;
}

export interface SessionFailedEvent extends IdentifiedRecord {
  readonly sessionId: string;
  readonly type: "session.failed";
  readonly errorMessage: string;
  readonly failedPhase?: MethodologyPhase;
  readonly emittedAt: string;
}

export interface PhaseStatusChangedEvent extends IdentifiedRecord {
  readonly phase: MethodologyPhase;
  readonly status: "pending" | "running" | "completed" | "failed";
  readonly type: "phase.status.changed";
  readonly emittedAt: string;
}

export interface SetupUpdatedEvent {
  readonly type: "setup.updated";
  readonly emittedAt: string;
}

export interface BootstrapUpdatedEvent {
  readonly type: "bootstrap.updated";
  readonly emittedAt: string;
}

export interface ArtifactCreatedEvent extends IdentifiedRecord {
  readonly type: "artifact.created";
  readonly phase: MethodologyPhase;
  readonly artifactId: string;
  readonly artifactKind: ArtifactKind;
  readonly artifactTitle: string;
  readonly emittedAt: string;
}

export interface FindingRegisteredEvent extends IdentifiedRecord {
  readonly type: "finding.registered";
  readonly findingId: string;
  readonly severity: string;
  readonly title: string;
  readonly emittedAt: string;
}

export interface ModelRequestEvent extends IdentifiedRecord {
  readonly type: "model.request";
  readonly task: string;
  readonly providerKind: string;
  readonly model: string;
  readonly success: boolean;
  readonly durationMs: number;
  readonly emittedAt: string;
}

export interface NoteCreatedEvent extends IdentifiedRecord {
  readonly type: "note.created";
  readonly noteId: string;
  readonly category: string;
  readonly phase: MethodologyPhase;
  readonly emittedAt: string;
}

export interface QuestionAskedEvent extends IdentifiedRecord {
  readonly type: "question.asked";
  readonly questionId: string;
  readonly phase: MethodologyPhase;
  readonly emittedAt: string;
}

export interface MemoryExtractedEvent extends IdentifiedRecord {
  readonly type: "memory.extracted";
  readonly memoryId: string;
  readonly kind: string;
  readonly confidence: number;
  readonly emittedAt: string;
}

// ---------------------------------------------------------------------------
// Union Type
// ---------------------------------------------------------------------------

export type SrpEvent =
  | SessionStartedEvent
  | SessionCompletedEvent
  | SessionFailedEvent
  | PhaseStatusChangedEvent
  | SetupUpdatedEvent
  | BootstrapUpdatedEvent
  | ArtifactCreatedEvent
  | FindingRegisteredEvent
  | ModelRequestEvent
  | NoteCreatedEvent
  | QuestionAskedEvent
  | MemoryExtractedEvent;

// ---------------------------------------------------------------------------
// Factory Functions
// ---------------------------------------------------------------------------

export function createSessionStartedEvent(
  input: IdentifiedRecord & { readonly sessionId: string }
): SessionStartedEvent {
  return {
    ...input,
    type: "session.started",
    emittedAt: new Date().toISOString()
  };
}

export function createSessionCompletedEvent(
  input: IdentifiedRecord & {
    readonly sessionId: string;
    readonly totalPhases: number;
    readonly totalArtifacts: number;
    readonly durationMs: number;
  }
): SessionCompletedEvent {
  return {
    ...input,
    type: "session.completed",
    emittedAt: new Date().toISOString()
  };
}

export function createSessionFailedEvent(
  input: IdentifiedRecord & {
    readonly sessionId: string;
    readonly errorMessage: string;
    readonly failedPhase?: MethodologyPhase;
  }
): SessionFailedEvent {
  return {
    ...input,
    type: "session.failed",
    emittedAt: new Date().toISOString()
  };
}

export function createPhaseStatusChangedEvent(
  input: IdentifiedRecord & {
    readonly phase: MethodologyPhase;
    readonly status: PhaseStatusChangedEvent["status"];
  }
): PhaseStatusChangedEvent {
  return {
    ...input,
    type: "phase.status.changed",
    emittedAt: new Date().toISOString()
  };
}

export function createSetupUpdatedEvent(): SetupUpdatedEvent {
  return {
    type: "setup.updated",
    emittedAt: new Date().toISOString()
  };
}

export function createBootstrapUpdatedEvent(): BootstrapUpdatedEvent {
  return {
    type: "bootstrap.updated",
    emittedAt: new Date().toISOString()
  };
}

export function createArtifactCreatedEvent(
  input: IdentifiedRecord & {
    readonly phase: MethodologyPhase;
    readonly artifactId: string;
    readonly artifactKind: ArtifactKind;
    readonly artifactTitle: string;
  }
): ArtifactCreatedEvent {
  return {
    ...input,
    type: "artifact.created",
    emittedAt: new Date().toISOString()
  };
}

export function createFindingRegisteredEvent(
  input: IdentifiedRecord & {
    readonly findingId: string;
    readonly severity: string;
    readonly title: string;
  }
): FindingRegisteredEvent {
  return {
    ...input,
    type: "finding.registered",
    emittedAt: new Date().toISOString()
  };
}

export function createModelRequestEvent(
  input: IdentifiedRecord & {
    readonly task: string;
    readonly providerKind: string;
    readonly model: string;
    readonly success: boolean;
    readonly durationMs: number;
  }
): ModelRequestEvent {
  return {
    ...input,
    type: "model.request",
    emittedAt: new Date().toISOString()
  };
}

export function createNoteCreatedEvent(
  input: IdentifiedRecord & {
    readonly noteId: string;
    readonly category: string;
    readonly phase: MethodologyPhase;
  }
): NoteCreatedEvent {
  return {
    ...input,
    type: "note.created",
    emittedAt: new Date().toISOString()
  };
}

export function createQuestionAskedEvent(
  input: IdentifiedRecord & {
    readonly questionId: string;
    readonly phase: MethodologyPhase;
  }
): QuestionAskedEvent {
  return {
    ...input,
    type: "question.asked",
    emittedAt: new Date().toISOString()
  };
}

export function createMemoryExtractedEvent(
  input: IdentifiedRecord & {
    readonly memoryId: string;
    readonly kind: string;
    readonly confidence: number;
  }
): MemoryExtractedEvent {
  return {
    ...input,
    type: "memory.extracted",
    emittedAt: new Date().toISOString()
  };
}

// ---------------------------------------------------------------------------
// Event Type Guards
// ---------------------------------------------------------------------------

export function isSessionEvent(event: SrpEvent): event is SessionStartedEvent | SessionCompletedEvent | SessionFailedEvent {
  return event.type === "session.started" || event.type === "session.completed" || event.type === "session.failed";
}

export function isPhaseEvent(event: SrpEvent): event is PhaseStatusChangedEvent {
  return event.type === "phase.status.changed";
}

export function isArtifactEvent(event: SrpEvent): event is ArtifactCreatedEvent {
  return event.type === "artifact.created";
}

// ---------------------------------------------------------------------------
// Typed Event Bus
// ---------------------------------------------------------------------------

export type SrpEventHandler = (event: SrpEvent) => void;

export class TypedEventBus {
  private readonly handlers: Map<SrpEvent["type"] | "*", SrpEventHandler[]> = new Map();

  on(eventType: SrpEvent["type"] | "*", handler: SrpEventHandler): void {
    const existing = this.handlers.get(eventType) ?? [];
    this.handlers.set(eventType, [...existing, handler]);
  }

  off(eventType: SrpEvent["type"] | "*", handler: SrpEventHandler): void {
    const existing = this.handlers.get(eventType) ?? [];
    this.handlers.set(eventType, existing.filter((h) => h !== handler));
  }

  emit(event: SrpEvent): void {
    const typeHandlers = this.handlers.get(event.type) ?? [];
    const wildcardHandlers = this.handlers.get("*") ?? [];
    for (const handler of [...typeHandlers, ...wildcardHandlers]) {
      handler(event);
    }
  }

  listenerCount(eventType: SrpEvent["type"] | "*"): number {
    return (this.handlers.get(eventType) ?? []).length;
  }
}
