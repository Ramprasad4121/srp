import type { Skill, SkillManifest } from "@srp/shared-types";

export class SkillRegistry {
  private readonly skills: Map<string, Skill> = new Map();

  register(skill: Skill): void {
    this.skills.set(skill.id, skill);
  }

  get(id: string): Skill | undefined {
    return this.skills.get(id);
  }

  list(): readonly SkillManifest[] {
    return Array.from(this.skills.values()).map(({ content, ...manifest }) => manifest);
  }

  filterByCategory(category: string): readonly Skill[] {
    return Array.from(this.skills.values()).filter((s) => s.category === category);
  }

  filterByTags(tags: readonly string[]): readonly Skill[] {
    return Array.from(this.skills.values()).filter((s) =>
      tags.some((tag) => s.tags.includes(tag))
    );
  }
}
