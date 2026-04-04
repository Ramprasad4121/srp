/**
 * Smoke tests: Phase-4 Web Research & Internet Policy
 *
 * Tests that the web research service correctly enforces the security policy
 * and provides appropriate mock results based on the mode.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { WebResearchService } from "../../packages/providers/dist/index.js";
import { createInternetPolicy } from "../../packages/security/dist/index.js";

test("Phase-4: Web Research (local-only mode)", async () => {
  const policy = createInternetPolicy("local-only", []);
  const service = new WebResearchService(policy);
  
  const results = await service.search({ query: "reentrancy" });
  assert.equal(results.length, 0, "Should return 0 results in local-only mode");
});

test("Phase-4: Web Research (local-plus-docs mode)", async () => {
  const policy = createInternetPolicy("local-plus-docs", [
    { hostname: "docs.soliditylang.org", reason: "Official docs" }
  ]);
  const service = new WebResearchService(policy);
  
  const results = await service.search({ query: "reentrancy" });
  assert.ok(results.length > 0);
  assert.ok(results.every(r => r.hostname === "docs.soliditylang.org"));
});

test("Phase-4: Web Research (open-web mode)", async () => {
  const policy = createInternetPolicy("open-web", []);
  const service = new WebResearchService(policy);
  
  const results = await service.search({ query: "reentrancy" });
  assert.ok(results.length > 0);
  // Should include github.com which is not a docs domain but allowed in open-web
  assert.ok(results.some(r => r.hostname === "github.com"));
});

test("Phase-4: Web Research (attribution & citations)", async () => {
  const policy = createInternetPolicy("open-web", []);
  const service = new WebResearchService(policy);
  
  const results = await service.search({ query: "reentrancy" });
  const result = results[0];
  
  assert.ok(result.url.startsWith("https://"));
  assert.ok(result.title.length > 0);
  assert.ok(result.snippet.length > 0);
  assert.ok(["search-engine", "documentation", "approved-domain"].includes(result.source));
});
