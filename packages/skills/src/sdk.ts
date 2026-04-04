import type { ExtensionManifest, MethodologyPhase, Skill } from "@srp/shared-types";
import { SkillRegistry } from "./skill-registry.js";

export interface ExtensionApi {
  readonly registerPhase: (name: string, definition: any) => void;
  readonly registerAgent: (agent: any) => void;
  readonly registerSkill: (skill: Skill) => void;
}

export class ExtensionSDK {
  constructor(
    private readonly manifest: ExtensionManifest,
    private readonly registry: SkillRegistry
  ) {}

  getApi(): ExtensionApi {
    return {
      registerPhase: (name, definition) => {
        console.log(`[Extension: ${this.manifest.name}] Registering phase: ${name}`);
        // Integration with methodology package would go here
      },
      registerAgent: (agent) => {
        console.log(`[Extension: ${this.manifest.name}] Registering agent: ${agent.name}`);
        // Integration with agents package would go here
      },
      registerSkill: (skill) => {
        this.registry.register(skill);
      }
    };
  }
}
