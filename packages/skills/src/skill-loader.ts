import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Skill } from "@srp/shared-types";
import { parseFrontmatter } from "./frontmatter-parser.js";

/**
 * Loads skills from a specified directory (e.g., project-root/skills).
 * Scans immediate subdirectories for SKILL.md files.
 * @param basePath The absolute path to the skills directory.
 */
export async function loadSkillsDir(basePath: string): Promise<Skill[]> {
  const loadedSkills: Skill[] = [];

  try {
    const entries = await readdir(basePath);

    for (const entry of entries) {
      const entryPath = join(basePath, entry);
      const entryStat = await stat(entryPath);

      if (entryStat.isDirectory()) {
        const skillFilePath = join(entryPath, "SKILL.md");

        try {
          const fileStat = await stat(skillFilePath);
          if (fileStat.isFile()) {
            const content = await readFile(skillFilePath, "utf-8");
            const parsed = parseFrontmatter(content);

            const manifest = parsed.frontmatter;
            const skillId = entry; // Directory name as the skill ID

            const skill: Skill = {
              id: skillId,
              name: typeof manifest.name === "string" ? manifest.name : skillId,
              version: typeof manifest.version === "string" ? manifest.version : "unversioned",
              description: typeof manifest.description === "string" ? manifest.description : "",
              category: typeof manifest.category === "string" ? manifest.category : "uncategorized",
              tags: Array.isArray(manifest.tags) ? manifest.tags : [],
              requiredTools: Array.isArray(manifest.requiredTools) ? manifest.requiredTools : [],
              requiredSkills: Array.isArray(manifest.requiredSkills) ? manifest.requiredSkills : [],
              content: parsed.content.trim(),
            };

            if (typeof manifest.eligibility === "string") {
              // We use Object.assign or mutate slightly because Skill interface expects it optional 
              // but exactOptionalPropertyTypes prevents assigning undefined.
              (skill as any).eligibility = manifest.eligibility;
            }

            loadedSkills.push(skill);
          }
        } catch {
          // No SKILL.md or unable to read, skip safely.
        }
      }
    }
  } catch (error) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      console.warn(`[Skills] Directory not found: ${basePath}`);
    } else {
      console.error(`[Skills] Error reading skills directory ${basePath}:`, error);
    }
  }

  return loadedSkills;
}
