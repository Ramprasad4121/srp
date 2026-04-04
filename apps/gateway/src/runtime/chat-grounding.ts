import type {
  ArtifactMetadata,
  ChatCitation,
  Conversation,
  RuntimeSessionState
} from "@srp/shared-types";
import { getPersistence } from "./session-manager.js";

export interface GroundedArtifactSnippet {
  readonly artifactId: string;
  readonly title: string;
  readonly kind: ArtifactMetadata["kind"];
  readonly phase: ArtifactMetadata["phase"];
  readonly preview: string;
  readonly score: number;
}

export interface ChatGroundingContext {
  readonly runId: string | null;
  readonly snippets: readonly GroundedArtifactSnippet[];
  readonly citations: readonly ChatCitation[];
}

const KEYWORD_KIND_HINTS: ReadonlyArray<{
  readonly terms: readonly string[];
  readonly kinds: readonly ArtifactMetadata["kind"][];
}> = [
  { terms: ["finding", "findings", "bug", "vulnerability"], kinds: ["finding", "report"] },
  { terms: ["invariant", "invariants", "property"], kinds: ["invariant", "test"] },
  { terms: ["architecture", "protocol", "contracts", "components"], kinds: ["diagram", "note", "report"] },
  { terms: ["remediation", "fix", "patch"], kinds: ["note", "report", "finding"] },
  { terms: ["verification", "fuzz", "proof", "poc"], kinds: ["test", "finding", "report"] }
];

function tokenize(content: string): string[] {
  return content
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);
}

function summarizePayload(payload: unknown): string {
  if (payload === null || payload === undefined) {
    return "No payload content available.";
  }
  if (typeof payload === "string") {
    return payload.slice(0, 320);
  }
  if (typeof payload !== "object") {
    return String(payload).slice(0, 320);
  }

  const record = payload as Record<string, unknown>;
  const interestingKeys = [
    "summary",
    "markdownSummary",
    "draftSummary",
    "title",
    "description",
    "markdownContent"
  ];

  for (const key of interestingKeys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.slice(0, 320);
    }
  }

  return JSON.stringify(payload).slice(0, 320);
}

function scoreArtifact(
  artifact: ArtifactMetadata,
  preview: string,
  queryTokens: readonly string[],
  preferredKinds: ReadonlySet<ArtifactMetadata["kind"]>
): number {
  const haystack = `${artifact.title} ${artifact.phase} ${artifact.kind} ${preview}`.toLowerCase();
  let score = preferredKinds.has(artifact.kind) ? 4 : 0;

  for (const token of queryTokens) {
    if (haystack.includes(token)) {
      score += 3;
    }
  }

  if (artifact.kind === "report") score += 1;
  if (artifact.kind === "finding") score += 1;
  return score;
}

function derivePreferredKinds(queryTokens: readonly string[]): ReadonlySet<ArtifactMetadata["kind"]> {
  const kinds = new Set<ArtifactMetadata["kind"]>();
  for (const hint of KEYWORD_KIND_HINTS) {
    if (hint.terms.some((term) => queryTokens.includes(term))) {
      for (const kind of hint.kinds) {
        kinds.add(kind);
      }
    }
  }
  return kinds;
}

export async function buildChatGroundingContext(
  conversation: Conversation,
  sessionState: RuntimeSessionState,
  userQuestion: string
): Promise<ChatGroundingContext> {
  const runId = conversation.runId ?? sessionState.runId ?? null;
  if (!runId) {
    return { runId: null, snippets: [], citations: [] };
  }

  const persistence = await getPersistence();
  const run = await persistence.getRun(runId);
  if (!run || run.artifacts.length === 0) {
    return { runId, snippets: [], citations: [] };
  }

  const queryTokens = tokenize(userQuestion);
  const preferredKinds = derivePreferredKinds(queryTokens);
  const snippetCandidates: GroundedArtifactSnippet[] = [];

  for (const artifact of run.artifacts) {
    const payload = await persistence.getArtifact(runId, artifact.artifactId);
    const preview = summarizePayload(payload);
    snippetCandidates.push({
      artifactId: artifact.artifactId,
      title: artifact.title,
      kind: artifact.kind,
      phase: artifact.phase,
      preview,
      score: scoreArtifact(artifact, preview, queryTokens, preferredKinds)
    });
  }

  const snippets = snippetCandidates
    .sort((a, b) => b.score - a.score || b.artifactId.localeCompare(a.artifactId))
    .slice(0, 4);

  const citations: ChatCitation[] = snippets.map((snippet) => ({
    artifactId: snippet.artifactId,
    artifactKind: snippet.kind,
    artifactTitle: snippet.title,
    relevance: `Grounded from ${snippet.phase}`
  }));

  return { runId, snippets, citations };
}
