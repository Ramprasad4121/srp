import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const read = (p: string) => readFileSync(root + p, "utf8");

// SRP has no LLM in its pipeline. The public description must not claim to be
// "AI-native" until model-backed triage ships (launch blocker 9).
test("README and package.json describe SRP as agent-native, not AI-native", () => {
  for (const file of ["README.md", "package.json"]) {
    const text = read(file);
    assert.doesNotMatch(text, /AI[- ]native/i, `${file} still says AI-native`);
    assert.match(text, /agent-native/i, `${file} should say agent-native`);
  }
});
