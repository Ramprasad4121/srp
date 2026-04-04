import type { ArtifactKind, IdentifiedRecord, MethodologyPhase } from "@srp/shared-types";

export interface ArtifactRecord extends IdentifiedRecord {
  readonly artifactId: string;
  readonly kind: ArtifactKind;
  readonly title: string;
  readonly phase: MethodologyPhase;
  readonly createdAt: string;
}

export function createArtifactRecord(
  input: IdentifiedRecord & {
    readonly artifactId: string;
    readonly kind: ArtifactKind;
    readonly title: string;
    readonly phase?: MethodologyPhase;
  }
): ArtifactRecord {
  return {
    ...input,
    phase: input.phase ?? "synthesis-intent",
    createdAt: new Date().toISOString()
  };
}

// ---------------------------------------------------------------------------
// Note Store — typed notes per phase
// ---------------------------------------------------------------------------

export type NoteCategory = "observation" | "question" | "insight" | "concern" | "decision";

export interface AuditNote {
  readonly id: string;
  readonly phase: MethodologyPhase;
  readonly category: NoteCategory;
  readonly title: string;
  readonly content: string;
  readonly relatedIds: readonly string[];
  readonly createdAt: string;
}

export class NoteStore {
  private readonly notes: Map<string, AuditNote> = new Map();

  add(note: Omit<AuditNote, "id" | "createdAt">): AuditNote {
    const id = `note_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    const full: AuditNote = {
      ...note,
      id,
      createdAt: new Date().toISOString()
    };
    this.notes.set(id, full);
    return full;
  }

  get(id: string): AuditNote | undefined {
    return this.notes.get(id);
  }

  listByPhase(phase: MethodologyPhase): readonly AuditNote[] {
    return Array.from(this.notes.values()).filter((n) => n.phase === phase);
  }

  listByCategory(category: NoteCategory): readonly AuditNote[] {
    return Array.from(this.notes.values()).filter((n) => n.category === category);
  }

  all(): readonly AuditNote[] {
    return Array.from(this.notes.values());
  }

  count(): number {
    return this.notes.size;
  }
}

// ---------------------------------------------------------------------------
// Question Log — tracks audit questions and their resolutions
// ---------------------------------------------------------------------------

export type QuestionStatus = "open" | "investigating" | "resolved" | "wont-fix";

export interface AuditQuestion {
  readonly id: string;
  readonly question: string;
  readonly phase: MethodologyPhase;
  readonly status: QuestionStatus;
  readonly relatedIds: readonly string[];
  readonly answer?: string;
  readonly createdAt: string;
  readonly resolvedAt?: string;
}

export class QuestionLog {
  private readonly questions: Map<string, AuditQuestion> = new Map();

  ask(input: {
    readonly question: string;
    readonly phase: MethodologyPhase;
    readonly relatedIds?: readonly string[];
  }): AuditQuestion {
    const id = `q_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    const entry: AuditQuestion = {
      id,
      question: input.question,
      phase: input.phase,
      status: "open",
      relatedIds: input.relatedIds ?? [],
      createdAt: new Date().toISOString()
    };
    this.questions.set(id, entry);
    return entry;
  }

  resolve(id: string, answer: string): AuditQuestion | undefined {
    const q = this.questions.get(id);
    if (!q) return undefined;
    const resolved: AuditQuestion = {
      ...q,
      status: "resolved",
      answer,
      resolvedAt: new Date().toISOString()
    };
    this.questions.set(id, resolved);
    return resolved;
  }

  updateStatus(id: string, status: QuestionStatus): AuditQuestion | undefined {
    const q = this.questions.get(id);
    if (!q) return undefined;
    const updated: AuditQuestion = { ...q, status };
    this.questions.set(id, updated);
    return updated;
  }

  listOpen(): readonly AuditQuestion[] {
    return Array.from(this.questions.values()).filter((q) => q.status === "open" || q.status === "investigating");
  }

  listByPhase(phase: MethodologyPhase): readonly AuditQuestion[] {
    return Array.from(this.questions.values()).filter((q) => q.phase === phase);
  }

  all(): readonly AuditQuestion[] {
    return Array.from(this.questions.values());
  }

  count(): number {
    return this.questions.size;
  }

  openCount(): number {
    return this.listOpen().length;
  }
}

// ---------------------------------------------------------------------------
// Memory Extraction — structured knowledge extracted from run artifacts
// ---------------------------------------------------------------------------

export type MemoryKind = "pattern" | "vulnerability-class" | "contract-behavior" | "trust-assumption" | "protocol-invariant";

export interface MemoryEntry {
  readonly id: string;
  readonly kind: MemoryKind;
  readonly title: string;
  readonly summary: string;
  readonly sourceArtifactIds: readonly string[];
  readonly sourcePhase: MethodologyPhase;
  readonly confidence: number;  // 0.0 - 1.0
  readonly createdAt: string;
}

export class MemoryStore {
  private readonly memories: Map<string, MemoryEntry> = new Map();

  extract(input: Omit<MemoryEntry, "id" | "createdAt">): MemoryEntry {
    const id = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    const entry: MemoryEntry = {
      ...input,
      id,
      createdAt: new Date().toISOString()
    };
    this.memories.set(id, entry);
    return entry;
  }

  get(id: string): MemoryEntry | undefined {
    return this.memories.get(id);
  }

  listByKind(kind: MemoryKind): readonly MemoryEntry[] {
    return Array.from(this.memories.values()).filter((m) => m.kind === kind);
  }

  listByPhase(phase: MethodologyPhase): readonly MemoryEntry[] {
    return Array.from(this.memories.values()).filter((m) => m.sourcePhase === phase);
  }

  highConfidence(threshold: number = 0.8): readonly MemoryEntry[] {
    return Array.from(this.memories.values()).filter((m) => m.confidence >= threshold);
  }

  all(): readonly MemoryEntry[] {
    return Array.from(this.memories.values());
  }

  count(): number {
    return this.memories.size;
  }
}
