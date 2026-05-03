import type { Skill } from "@srp/shared-types";
import { buildBm25Index, queryBm25 } from "./bm25-index.js";

/**
 * Searches a set of skills using BM25 relevance ranking.
 * Builds a fresh index on each call — suitable for small-to-medium skill sets
 * (hundreds of entries). For larger corpora, cache the index externally.
 *
 * @param query   Free-text search query (e.g. audit phase name, vulnerability class)
 * @param topK    Maximum number of results to return
 * @param skills  The skill collection to search
 * @returns       Skills ordered by descending BM25 relevance score
 */
export function searchSkills(
  query: string,
  topK: number,
  skills: readonly Skill[]
): Skill[] {
  if (skills.length === 0 || !query.trim()) return [];
  const index = buildBm25Index(skills);
  const results = queryBm25(index, query, topK);
  const skillMap = new Map(skills.map((s) => [s.id, s]));
  return results
    .map((r) => skillMap.get(r.skillId))
    .filter((s): s is Skill => s !== undefined);
}

/**
 * Formats retrieved skills into a compact context block suitable for
 * injection into an LLM system prompt.  Truncates each skill's content
 * to `maxCharsPerSkill` characters so the total context stays manageable.
 *
 * @param skills          Skills to format
 * @param maxCharsPerSkill Max characters of raw content per skill (default 1500)
 * @returns               Multi-section markdown string
 */
export function formatSkillsForPrompt(
  skills: readonly Skill[],
  maxCharsPerSkill = 1500
): string {
  if (skills.length === 0) return "";
  const sections = skills.map((s) => {
    const excerpt =
      s.content.length > maxCharsPerSkill
        ? s.content.slice(0, maxCharsPerSkill) + "\n…[truncated]"
        : s.content;
    return `### Skill: ${s.name} [${s.id}]\n${s.description ? `_${s.description}_\n\n` : ""}${excerpt}`;
  });
  return (
    `## Retrieved Security Knowledge (${skills.length} skill${skills.length > 1 ? "s" : ""})\n\n` +
    sections.join("\n\n---\n\n")
  );
}
