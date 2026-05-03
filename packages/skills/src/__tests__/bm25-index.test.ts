import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tokenize, buildBm25Index, queryBm25 } from "../bm25-index.js";
import { searchSkills, formatSkillsForPrompt } from "../skill-retriever.js";
import type { Skill } from "@srp/shared-types";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeSkill(overrides: Partial<Skill> & { id: string }): Skill {
  return {
    name: overrides.id,
    version: "1.0.0",
    description: "",
    category: "test",
    tags: [],
    requiredTools: [],
    requiredSkills: [],
    content: "",
    ...overrides,
  };
}

const AUDIT_SKILLS: Skill[] = [
  makeSkill({
    id: "av-approval-abuse",
    name: "Attack Vector: Approval Abuse",
    description: "ERC-20 unlimited approvals, race condition, token drain.",
    tags: ["erc20", "approval", "token", "attack-vector"],
    content: `# Approval Abuse\nTargets the ERC-20 approval mechanism. Unlimited approvals using type(uint256).max can be drained if the approved contract is compromised or upgraded.`,
  }),
  makeSkill({
    id: "av-callback-grief",
    name: "Attack Vector: Callback Grief",
    description: "Reentrancy and callback grief patterns.",
    tags: ["reentrancy", "callback", "erc777", "attack-vector"],
    content: `# Callback Grief\nERC-777 hook callbacks and reentrancy. Before-transfer hooks can be used to re-enter a vault before balance updates.`,
  }),
  makeSkill({
    id: "hunt-adversarial-deep",
    name: "Hunt: Adversarial Deep",
    description: "Deep adversarial hunt for smart contract vulnerabilities.",
    tags: ["hunt", "adversarial", "external-calls"],
    content: `# Adversarial Deep Hunt\nSystematically enumerate every external call site. Model adversarial inputs and stress-test invariants under worst-case conditions.`,
  }),
  makeSkill({
    id: "security-auditor",
    name: "Security Auditor Orchestrator",
    description: "Map-Hunt-Attack methodology orchestrator.",
    tags: ["orchestrator", "audit", "solidity"],
    content: `# Security Auditor\nMap-Hunt-Attack methodology. Phases: MAP, HUNT, ATTACK, VERIFY, REPORT.`,
  }),
  makeSkill({
    id: "av-rounding-entitlement",
    name: "Attack Vector: Rounding Entitlement",
    description: "Integer rounding, share inflation, ERC-4626 precision loss.",
    tags: ["rounding", "erc4626", "share-inflation", "math"],
    content: `# Rounding Entitlement\nDivision truncation in Solidity always rounds toward zero. ERC-4626 vaults must round shares in favor of the vault, not the depositor.`,
  }),
];

// ── tokenize ─────────────────────────────────────────────────────────────────

describe("tokenize", () => {
  it("lowercases and splits on whitespace", () => {
    const tokens = tokenize("Approval Abuse ERC20");
    assert.ok(tokens.includes("approval"));
    assert.ok(tokens.includes("abuse"));
    assert.ok(tokens.includes("erc20"));
  });

  it("strips punctuation", () => {
    const tokens = tokenize("type(uint256).max, drain!");
    assert.ok(!tokens.some((t) => t.includes("(")));
    assert.ok(!tokens.some((t) => t.includes(".")));
  });

  it("filters stop words", () => {
    const tokens = tokenize("the contract is a token");
    assert.ok(!tokens.includes("the"));
    assert.ok(!tokens.includes("is"));
    assert.ok(!tokens.includes("a"));
    assert.ok(tokens.includes("contract"));
    assert.ok(tokens.includes("token"));
  });

  it("filters short tokens", () => {
    const tokens = tokenize("a b c ok yes");
    assert.ok(!tokens.includes("b"));
    assert.ok(!tokens.includes("c"));
  });
});

// ── buildBm25Index ────────────────────────────────────────────────────────────

describe("buildBm25Index", () => {
  it("builds an index with one doc per skill", () => {
    const index = buildBm25Index(AUDIT_SKILLS);
    assert.equal(index.docs.length, AUDIT_SKILLS.length);
  });

  it("computes avgDocLen > 0", () => {
    const index = buildBm25Index(AUDIT_SKILLS);
    assert.ok(index.avgDocLen > 0);
  });

  it("builds IDF entries for terms present in docs", () => {
    const index = buildBm25Index(AUDIT_SKILLS);
    assert.ok(index.idf.size > 0);
    assert.ok(index.idf.has("approval") || index.idf.has("abuse"));
  });

  it("empty skill list produces zero avgDocLen", () => {
    const index = buildBm25Index([]);
    assert.equal(index.docs.length, 0);
    assert.equal(index.avgDocLen, 0);
  });
});

// ── queryBm25 ────────────────────────────────────────────────────────────────

describe("queryBm25", () => {
  it("returns empty array for empty query", () => {
    const index = buildBm25Index(AUDIT_SKILLS);
    assert.deepEqual(queryBm25(index, "", 5), []);
  });

  it("returns at most topK results", () => {
    const index = buildBm25Index(AUDIT_SKILLS);
    const results = queryBm25(index, "approval erc20 token drain", 2);
    assert.ok(results.length <= 2);
  });

  it("ranks approval-abuse highest for 'approval erc20 drain'", () => {
    const index = buildBm25Index(AUDIT_SKILLS);
    const results = queryBm25(index, "approval erc20 drain token", 5);
    assert.ok(results.length > 0, "Should return at least one result");
    assert.equal(results[0]!.skillId, "av-approval-abuse");
  });

  it("ranks callback-grief highest for 'reentrancy callback erc777'", () => {
    const index = buildBm25Index(AUDIT_SKILLS);
    const results = queryBm25(index, "reentrancy callback erc777 hook", 5);
    assert.ok(results.length > 0);
    assert.equal(results[0]!.skillId, "av-callback-grief");
  });

  it("ranks rounding-entitlement highest for 'share inflation erc4626 rounding'", () => {
    const index = buildBm25Index(AUDIT_SKILLS);
    const results = queryBm25(index, "share inflation erc4626 rounding vault", 5);
    assert.ok(results.length > 0);
    assert.equal(results[0]!.skillId, "av-rounding-entitlement");
  });

  it("returns results with positive scores only", () => {
    const index = buildBm25Index(AUDIT_SKILLS);
    const results = queryBm25(index, "approval", 10);
    assert.ok(results.every((r) => r.score > 0));
  });

  it("returns empty for query with no matching tokens", () => {
    const index = buildBm25Index(AUDIT_SKILLS);
    const results = queryBm25(index, "zzzzzzunknownterm99999", 5);
    assert.deepEqual(results, []);
  });
});

// ── searchSkills ─────────────────────────────────────────────────────────────

describe("searchSkills", () => {
  it("returns empty array when skills list is empty", () => {
    const results = searchSkills("approval", 5, []);
    assert.deepEqual(results, []);
  });

  it("returns Skill objects (not just IDs)", () => {
    const results = searchSkills("approval drain erc20", 3, AUDIT_SKILLS);
    assert.ok(results.length > 0);
    assert.ok(results[0] !== undefined && "id" in results[0]!);
    assert.ok(results[0] !== undefined && "content" in results[0]!);
  });

  it("respects topK limit", () => {
    const results = searchSkills("smart contract audit solidity", 2, AUDIT_SKILLS);
    assert.ok(results.length <= 2);
  });

  it("returns empty for blank query", () => {
    const results = searchSkills("   ", 5, AUDIT_SKILLS);
    assert.deepEqual(results, []);
  });

  it("adversarial hunt skill is top result for 'adversarial external call hunt'", () => {
    const results = searchSkills("adversarial external calls hunt worst-case", 3, AUDIT_SKILLS);
    assert.ok(results.length > 0);
    assert.equal(results[0]!.id, "hunt-adversarial-deep");
  });
});

// ── formatSkillsForPrompt ─────────────────────────────────────────────────────

describe("formatSkillsForPrompt", () => {
  it("returns empty string for empty array", () => {
    assert.equal(formatSkillsForPrompt([]), "");
  });

  it("includes skill name and id", () => {
    const result = formatSkillsForPrompt([AUDIT_SKILLS[0]!]);
    assert.ok(result.includes("Approval Abuse"));
    assert.ok(result.includes("av-approval-abuse"));
  });

  it("truncates long content at maxCharsPerSkill", () => {
    const longSkill = makeSkill({
      id: "long-skill",
      content: "x".repeat(5000),
    });
    const result = formatSkillsForPrompt([longSkill], 200);
    assert.ok(result.includes("…[truncated]"));
    assert.ok(result.length < 5000);
  });

  it("does not truncate short content", () => {
    const shortSkill = makeSkill({
      id: "short-skill",
      content: "short content here",
    });
    const result = formatSkillsForPrompt([shortSkill], 1500);
    assert.ok(!result.includes("…[truncated]"));
    assert.ok(result.includes("short content here"));
  });

  it("includes section header with skill count", () => {
    const result = formatSkillsForPrompt(AUDIT_SKILLS.slice(0, 2));
    assert.ok(result.includes("2 skills"));
  });
});
