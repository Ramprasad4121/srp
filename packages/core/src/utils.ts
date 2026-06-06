import { createHash } from "node:crypto";
import type { ConfidenceBand, Evidence } from "./types.ts";

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

export function lineEvidence(file: string, content: string, needle: RegExp, rationale: string): Evidence | undefined {
  const lines = content.split(/\r?\n/);
  const index = lines.findIndex((line) => needle.test(line));
  if (index < 0) return undefined;
  return {
    file,
    startLine: index + 1,
    endLine: index + 1,
    excerpt: lines[index]?.trim().slice(0, 240) ?? "",
    rationale
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
