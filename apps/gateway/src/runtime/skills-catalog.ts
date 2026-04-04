import { loadSkillsDir } from "@srp/skills";
import type { Skill, SkillManifest } from "@srp/shared-types";
import { join, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
let cachedSkills: Skill[] | null = null;

function findSrpRoot(startDir: string): string {
  let current = startDir;
  while (current !== sep) {
    if (current.endsWith("srp") || current.includes("srp" + sep)) {
      // Find the last occurrence of 'srp' in the path
      const parts = current.split(sep);
      const srpIndex = parts.lastIndexOf("srp");
      if (srpIndex !== -1) {
        return parts.slice(0, srpIndex + 1).join(sep);
      }
    }
    current = dirname(current);
  }
  return startDir; // Fallback
}

async function fetchSkills(): Promise<Skill[]> {
  const srpRoot = findSrpRoot(__dirname);
  const rootSkillsDir = join(srpRoot, "skills");
  try {
    cachedSkills = await loadSkillsDir(rootSkillsDir);
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
    // Discarding content/eligibility for the manifest endpoint
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
