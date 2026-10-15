import { createHash } from "node:crypto";
import type { ConfidenceBand, Evidence, EvidenceKind } from "./types.ts";

export function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash("sha256").update(value).digest("hex").slice(0, 12)}`;
}

export function confidenceBand(score: number): ConfidenceBand {
  if (score >= 0.9) return "verified";
  if (score >= 0.72) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

export function clampConfidence(score: number): number {
  return Math.max(0, Math.min(0.99, Number(score.toFixed(2))));
}

/**
 * First line whose (comment-stripped) text matches needle. `searchIn` must have the same line layout as content;
 * the excerpt is always taken from the raw content.
 */
export function lineEvidence(file: string, content: string, needle: RegExp, rationale: string, searchIn: string = content, operation = "pattern"): Evidence | undefined {
  const lines = searchIn.split(/\r?\n/);
  const index = lines.findIndex((line) => needle.test(line));
  if (index < 0) return undefined;
  return evidenceAt(file, content, index + 1, rationale, "srp-pattern", operation, "observed");
}

export function evidenceAt(file: string, content: string, line: number, rationale: string, provider: string, operation: string, kind: EvidenceKind, endLine = line): Evidence {
  const lines = content.split(/\r?\n/);
  const excerpt = lines.slice(line - 1, endLine).map((item) => item.trim()).join(" ").slice(0, 240);
  return {
    evidenceId: stableId("ev", `${file}:${line}:${endLine}:${excerpt}:${provider}:${operation}`),
    file,
    startLine: line,
    endLine,
    excerpt,
    rationale,
    provider,
    operation,
    kind
  };
}

export function keywordSentences(content: string, keywords: string[], limit = 4): string[] {
  const sentences = content
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  return sentences
    .filter((sentence) => keywords.some((keyword) => sentence.toLowerCase().includes(keyword)))
    .slice(0, limit);
}
