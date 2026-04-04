import type { IdentifiedRecord, MethodologyPhase, SessionStatus } from "@srp/shared-types";

export interface SessionRecord extends IdentifiedRecord {
  readonly sessionId: string;
  readonly status: SessionStatus;
  readonly createdAt: string;
  readonly currentPhase: MethodologyPhase;
}

export function createSessionRecord(
  input: IdentifiedRecord & {
    readonly sessionId: string;
    readonly status?: SessionStatus;
    readonly currentPhase?: MethodologyPhase;
  }
): SessionRecord {
  return {
    ...input,
    status: input.status ?? "idle",
    currentPhase: input.currentPhase ?? "discovery-docs",
    createdAt: new Date().toISOString()
  };
}

// ---------------------------------------------------------------------------
// Session Store — manages lifecycle of sessions
// ---------------------------------------------------------------------------

export interface SessionTransition {
  readonly from: SessionStatus;
  readonly to: SessionStatus;
  readonly phase?: MethodologyPhase;
  readonly timestamp: string;
}

export class SessionStore {
  private readonly sessions: Map<string, SessionRecord> = new Map();
  private readonly history: Map<string, SessionTransition[]> = new Map();

  create(input: IdentifiedRecord & {
    readonly sessionId: string;
    readonly status?: SessionStatus;
    readonly currentPhase?: MethodologyPhase;
  }): SessionRecord {
    const record = createSessionRecord(input);
    this.sessions.set(record.sessionId, record);
    this.history.set(record.sessionId, []);
    return record;
  }

  get(sessionId: string): SessionRecord | undefined {
    return this.sessions.get(sessionId);
  }

  transition(
    sessionId: string,
    status: SessionStatus,
    phase?: MethodologyPhase
  ): SessionRecord | undefined {
    const existing = this.sessions.get(sessionId);
    if (!existing) return undefined;

    const transition: SessionTransition = {
      from: existing.status,
      to: status,
      ...(phase ? { phase } : {}),
      timestamp: new Date().toISOString()
    };

    const updated: SessionRecord = {
      ...existing,
      status,
      ...(phase ? { currentPhase: phase } : {})
    };

    this.sessions.set(sessionId, updated);
    const hist = this.history.get(sessionId) ?? [];
    hist.push(transition);
    this.history.set(sessionId, hist);

    return updated;
  }

  getHistory(sessionId: string): readonly SessionTransition[] {
    return this.history.get(sessionId) ?? [];
  }

  listActive(): readonly SessionRecord[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.status === "running" || s.status === "idle"
    );
  }

  all(): readonly SessionRecord[] {
    return Array.from(this.sessions.values());
  }

  count(): number {
    return this.sessions.size;
  }
}
