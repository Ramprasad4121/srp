/**
 * Smoke tests: Phase-16 Open-Source Extension SDK
 *
 * Tests that the Extension SDK provides a clean API for third-party
 * extensions to register new skills and methodology components.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { ExtensionSDK, SkillRegistry } from "../../packages/skills/dist/index.js";

test("Phase-16 Extension SDK: Skill Registration", () => {
  const registry = new SkillRegistry();
  const manifest = {
    id: "ext-1",
    name: "Test Extension",
    description: "Adds custom skills",
    version: "1.0.0",
    type: "analysis",
    entryPoint: "index.js"
  };

  const sdk = new ExtensionSDK(manifest, registry);
  const api = sdk.getApi();

  const newSkill = {
    id: "custom-skill",
    name: "Custom Audit Skill",
    version: "1.0.0",
    description: "A skill added by an extension",
    category: "Audit",
    tags: ["custom"],
    requiredTools: [],
    requiredSkills: [],
    content: "Skill content"
  };

  api.registerSkill(newSkill);

  const registered = registry.get("custom-skill");
  assert.ok(registered);
  assert.equal(registered.name, "Custom Audit Skill");
});
