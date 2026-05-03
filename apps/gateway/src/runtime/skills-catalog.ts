import { loadSkillsDir, searchSkills as bm25Search, formatSkillsForPrompt } from "@srp/skills";
import type { Skill, SkillManifest } from "@srp/shared-types";
import { join, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
let cachedSkills: Skill[] | null = null;

/**
 * Walks up the directory tree looking for the monorepo root.
 * Detects root by the presence of pnpm-workspace.yaml or a skills/ directory.
 * Falls back to process.cwd() if no marker is found within 20 levels.
 */
function findMonorepoRoot(startDir: string): string {
  let current = startDir;
  for (let i = 0; i < 20; i++) {
    if (
      existsSync(join(current, "pnpm-workspace.yaml")) ||
      existsSync(join(current, "skills"))
    ) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) break; // filesystem root
    current = parent;
  }
  // Legacy: also check for path segment named "srp"
  current = startDir;
  while (current !== sep) {
    if (current.endsWith("srp") || current.includes("srp" + sep)) {
      const parts = current.split(sep);
      const srpIndex = parts.lastIndexOf("srp");
      if (srpIndex !== -1) return parts.slice(0, srpIndex + 1).join(sep);
    }
    current = dirname(current);
  }
  return process.cwd();
}

async function fetchSkills(): Promise<Skill[]> {
  if (cachedSkills !== null) return cachedSkills;
  const root = findMonorepoRoot(__dirname);
  const rootSkillsDir = join(root, "skills");
  try {
    cachedSkills = await loadSkillsDir(rootSkillsDir);
    console.log(`[Skills] Loaded ${cachedSkills.length} skills from ${rootSkillsDir}`);
  } catch (err) {
    console.warn("[Skills] Could not load skills from", rootSkillsDir, err);
    cachedSkills = [];
  }
  return cachedSkills;
}

export async function listSkills(): Promise<readonly SkillManifest[]> {
  const skills = await fetchSkills();
  return skills.map((skill) => {
    const { content, eligibility, ...manifest } = skill;
    void content;
    void eligibility;
    return manifest;
  });
}

export async function getSkill(id: string): Promise<Skill | null> {
  const skills = await fetchSkills();
  const found = skills.find((skill) => skill.id === id);
  return found ?? null;
}

/**
 * BM25 full-text search over all loaded skills.
 * Returns up to `topK` skills ordered by relevance.
 */
export async function searchSkills(
  query: string,
  topK = 5
): Promise<Skill[]> {
  const skills = await fetchSkills();
  return bm25Search(query, topK, skills);
}

/**
 * Retrieve top-K relevant skills for a given query and format them as a
 * compact context block ready to inject into an LLM system prompt.
 *
 * @param query           Free-text query (phase name, vulnerability class, etc.)
 * @param topK            Max skills to retrieve (default 4)
 * @param maxCharsEach    Max content chars per skill before truncation (default 1500)
 */
export async function retrieveSkillContext(
  query: string,
  topK = 4,
  maxCharsEach = 1500
): Promise<string> {
  const skills = await searchSkills(query, topK);
  if (skills.length === 0) return "";
  return formatSkillsForPrompt(skills, maxCharsEach);
}

/** Invalidate the in-memory cache (useful in tests or after re-ingestion). */
export function invalidateSkillsCache(): void {
  cachedSkills = null;
}
