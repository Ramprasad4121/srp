import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DETECTORS } from "../src/index.ts";

test("every detector id emitted in source is listed in the catalog and in docs/detectors.md", () => {
  const source = ["discovery.ts", "anchor.ts"].map((file) => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8")).join("\n");
  const emitted = new Set([...source.matchAll(/(?:detector|id): "((?:evm|solana)-[a-z0-9-]+)"/g)].map((match) => match[1]));
  const catalog = new Set(DETECTORS.map((detector) => detector.id));
  const docs = readFileSync(new URL("../../../docs/detectors.md", import.meta.url), "utf8");
  for (const id of emitted) {
    assert.ok(catalog.has(id!), `${id} missing from catalog.ts`);
    assert.ok(docs.includes(`\`${id}\``), `${id} missing from docs/detectors.md`);
  }
  assert.equal(emitted.size, catalog.size, "catalog lists a detector the code never emits");
});
