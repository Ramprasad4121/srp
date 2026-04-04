import { loadSkillsDir } from "@srp/skills";
import type { Skill, SkillManifest } from "@srp/shared-types";
import { join } from "node:path";

let cachedSkills: Skill[] | null = null;

async function fetchSkills(): Promise<Skill[]> {
  const rootSkillsDir = join(process.cwd(), "../../skills");
  try {
    cachedSkills = await loadSkillsDir(rootSkillsDir);
  } catch (err) {
    console.warn("Could not load skills from", rootSkillsDir, err);
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
