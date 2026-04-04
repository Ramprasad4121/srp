export type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

export type SessionId = Brand<string, "SessionId">;
export type RunId = Brand<string, "RunId">;
export type ProjectId = Brand<string, "ProjectId">;
export type ArtifactId = Brand<string, "ArtifactId">;
export type EventId = Brand<string, "EventId">;
export type ConversationId = Brand<string, "ConversationId">;
export type SkillId = Brand<string, "SkillId">;
export type DiagramId = Brand<string, "DiagramId">;
export type ReportId = Brand<string, "ReportId">;

export function asSessionId(value: string): SessionId {
  return value as SessionId;
}

export function asRunId(value: string): RunId {
  return value as RunId;
}

export function asProjectId(value: string): ProjectId {
  return value as ProjectId;
}

export function asArtifactId(value: string): ArtifactId {
  return value as ArtifactId;
}

export function asEventId(value: string): EventId {
  return value as EventId;
}

export function asConversationId(value: string): ConversationId {
  return value as ConversationId;
}

export function asSkillId(value: string): SkillId {
  return value as SkillId;
}

export function asDiagramId(value: string): DiagramId {
  return value as DiagramId;
}

export function asReportId(value: string): ReportId {
  return value as ReportId;
}
