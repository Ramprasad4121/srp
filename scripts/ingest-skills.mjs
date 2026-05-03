#!/usr/bin/env node
/**
 * Ingest security skills from the pashov/ai-web3-security hub into the local
 * skills/ directory.  Idempotent — re-running overwrites existing files.
 *
 * Usage:
 *   node scripts/ingest-skills.mjs
 *   node scripts/ingest-skills.mjs --dry-run   (print paths, don't write)
 *
 * Sources:
 *   - Archethect/sc-auditor  (Map-Hunt-Attack orchestrator + prompt assets)
 *   - pashov/skills          (solidity-auditor)
 *   - Archethect/sc-auditor  (attack-vector docs → individual skills)
 *   - Archethect/sc-auditor  (hunt-pattern prompts → individual skills)
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = join(__dirname, "..");
const SKILLS_ROOT = join(WORKSPACE_ROOT, "skills");
const DRY_RUN = process.argv.includes("--dry-run");

const GITHUB_RAW = "https://raw.githubusercontent.com";
const SC_AUDITOR_BASE = `${GITHUB_RAW}/Archethect/sc-auditor/main/skills/security-auditor`;
const PASHOV_BASE = `${GITHUB_RAW}/pashov/skills/master/solidity-auditor`;

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "srp-ingest/1.0" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

function stripFrontmatter(content) {
  const match = content.match(/^---[\r\n][\s\S]*?[\r\n]---[\r\n]?/);
  return match ? content.slice(match[0].length) : content;
}

function buildFrontmatter(fields) {
  const lines = Object.entries(fields).map(([k, v]) => {
    if (Array.isArray(v))
      return `${k}: [${v.map((s) => JSON.stringify(s)).join(", ")}]`;
    return `${k}: ${JSON.stringify(String(v))}`;
  });
  return `---\n${lines.join("\n")}\n---\n\n`;
}

function writeSkill(skillId, frontmatterFields, body) {
  const dir = join(SKILLS_ROOT, skillId);
  const filePath = join(dir, "SKILL.md");
  const content = buildFrontmatter(frontmatterFields) + body.trim() + "\n";
  if (DRY_RUN) {
    console.log(`[dry-run] Would write ${filePath} (${content.length} bytes)`);
    return;
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, content, "utf-8");
  console.log(`  ✓  ${filePath}`);
}

function writeAsset(relPath, content) {
  const filePath = join(SKILLS_ROOT, relPath);
  if (DRY_RUN) {
    console.log(`[dry-run] Would write ${filePath} (${content.length} bytes)`);
    return;
  }
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf-8");
  console.log(`  ✓  ${filePath}`);
}

async function main() {
  console.log(`\nSRP Skills Ingestor\n${"=".repeat(40)}`);
  if (DRY_RUN) console.log("DRY RUN — no files will be written\n");

  // ── 1. security-auditor (main orchestrator SKILL.md) ─────────────────────
  console.log("\n[1/4] Fetching Archethect/sc-auditor orchestrator…");
  const scAuditorRaw = await fetchText(`${SC_AUDITOR_BASE}/SKILL.md`);
  writeSkill(
    "security-auditor",
    {
      name: "security-auditor",
      version: "1.0.0",
      description:
        "Interactive smart contract security audit using Map-Hunt-Attack methodology with static analysis, parallel hunt lanes, skeptic-judge verification, and structured reporting.",
      category: "security-audit",
      tags: [
        "solidity","smart-contracts","evm","audit","map-hunt-attack",
        "defi","orchestrator","slither","aderyn",
      ],
    },
    stripFrontmatter(scAuditorRaw)
  );

  // Also write the raw prompt assets so executeAuditPhase can read them
  console.log("\n[1b] Fetching sc-auditor prompt assets…");
  const PROMPTS = ["map","attack","hunt-adversarial-deep","hunt-accounting-entitlement",
    "hunt-callback-liveness","hunt-semantic-consistency","hunt-token-oracle-statefulness",
    "hunt-economic-differential","setup","judge","da-protocol","skeptic"];
  for (const p of PROMPTS) {
    try {
      const txt = await fetchText(`${SC_AUDITOR_BASE}/assets/prompts/${p}.md`);
      writeAsset(`security-auditor/assets/prompts/${p}.md`, txt);
    } catch (e) {
      console.warn(`  ⚠  Could not fetch prompt ${p}: ${e.message}`);
    }
  }

  // ── 2. solidity-auditor (pashov/skills) ──────────────────────────────────
  console.log("\n[2/4] Fetching pashov/skills solidity-auditor…");
  const pashovRaw = await fetchText(`${PASHOV_BASE}/SKILL.md`);
  writeSkill(
    "solidity-auditor",
    {
      name: "solidity-auditor",
      version: "1.0.0",
      description:
        "Security audit of Solidity code while you develop. Parallel 8-agent approach: vector-scan, math-precision, access-control, economic-security, execution-trace, invariant, periphery, first-principles.",
      category: "security-audit",
      tags: [
        "solidity","smart-contracts","evm","audit","parallel-agents",
        "math-precision","access-control","economic-security","invariant",
      ],
    },
    stripFrontmatter(pashovRaw)
  );

  // ── 3. Attack vector skills ───────────────────────────────────────────────
  console.log("\n[3/4] Fetching attack vector docs…");
  const ATTACK_VECTORS = [
    {
      file: "approval-abuse",
      id: "av-approval-abuse",
      name: "Attack Vector: Approval Abuse",
      description:
        "ERC-20 token approval abuse — unlimited approvals, race conditions, upgradeable proxy drains, and permit/permit2 misuse.",
      tags: ["erc20","approval","race-condition","attack-vector","token","drain"],
    },
    {
      file: "callback-grief",
      id: "av-callback-grief",
      name: "Attack Vector: Callback Grief",
      description:
        "Callback and reentrancy grief patterns — ERC-777 hooks, before/after transfer callbacks, cross-function reentrancy, and read-only reentrancy.",
      tags: ["reentrancy","callback","erc777","grief","attack-vector","hook"],
    },
    {
      file: "rounding-entitlement",
      id: "av-rounding-entitlement",
      name: "Attack Vector: Rounding Entitlement",
      description:
        "Integer rounding and precision loss exploits — division truncation, share inflation, fee accumulation errors, and ERC-4626 vault rounding.",
      tags: ["rounding","precision","integer","erc4626","share-inflation","attack-vector","math"],
    },
    {
      file: "semantic-drift",
      id: "av-semantic-drift",
      name: "Attack Vector: Semantic Drift",
      description:
        "Semantic drift between spec and implementation — invariant violations, state machine deviations, and assumption mismatches across upgrades.",
      tags: ["semantic","invariant","state-machine","drift","attack-vector","specification"],
    },
    {
      file: "entitlement-drift",
      id: "av-entitlement-drift",
      name: "Attack Vector: Entitlement Drift",
      description:
        "Entitlement drift — access control decay, role propagation bugs, privilege escalation, and permissioned function misuse over time.",
      tags: ["access-control","entitlement","privilege","role","drift","attack-vector"],
    },
  ];

  for (const av of ATTACK_VECTORS) {
    try {
      const raw = await fetchText(
        `${SC_AUDITOR_BASE}/assets/attack-vectors/${av.file}.md`
      );
      writeSkill(av.id, {
        name: av.name,
        version: "1.0.0",
        description: av.description,
        category: "attack-vector",
        tags: av.tags,
      }, raw);
    } catch (e) {
      console.warn(`  ⚠  Could not fetch attack vector ${av.file}: ${e.message}`);
    }
  }

  // ── 4. Hunt-pattern skills ────────────────────────────────────────────────
  console.log("\n[4/4] Fetching hunt-pattern prompts as skills…");
  const HUNT_PATTERNS = [
    {
      file: "hunt-adversarial-deep",
      id: "hunt-adversarial-deep",
      name: "Hunt: Adversarial Deep",
      description:
        "Deep adversarial hunt — systematically enumerates every external call site, models adversarial inputs, and stress-tests invariants under worst-case conditions.",
      tags: ["hunt","adversarial","deep","external-calls","stress-test","invariant"],
    },
    {
      file: "hunt-accounting-entitlement",
      id: "hunt-accounting-entitlement",
      name: "Hunt: Accounting & Entitlement",
      description:
        "Accounting and entitlement hunt — tracks balance deltas, fee distributions, share calculations, and detects entitlement overflows or underflows.",
      tags: ["hunt","accounting","entitlement","balance","fee","share","erc4626"],
    },
    {
      file: "hunt-callback-liveness",
      id: "hunt-callback-liveness",
      name: "Hunt: Callback Liveness",
      description:
        "Callback liveness hunt — detects reentrancy paths, callback grief, liveness failures caused by reverting hooks, and DoS via external call dependency.",
      tags: ["hunt","callback","liveness","reentrancy","dos","hook","erc777"],
    },
    {
      file: "hunt-semantic-consistency",
      id: "hunt-semantic-consistency",
      name: "Hunt: Semantic Consistency",
      description:
        "Semantic consistency hunt — verifies that protocol invariants hold across all code paths, detects state machine violations and cross-contract semantic drift.",
      tags: ["hunt","semantic","consistency","invariant","state-machine","cross-contract"],
    },
    {
      file: "hunt-token-oracle-statefulness",
      id: "hunt-token-oracle-statefulness",
      name: "Hunt: Token & Oracle Statefulness",
      description:
        "Token and oracle statefulness hunt — detects oracle staleness, price manipulation, flash-loan attack vectors, and token transfer statefulness issues.",
      tags: ["hunt","oracle","token","statefulness","flash-loan","price-manipulation","twap"],
    },
    {
      file: "hunt-economic-differential",
      id: "hunt-economic-differential",
      name: "Hunt: Economic Differential",
      description:
        "Economic differential hunt — models economic incentives, identifies arbitrage paths, assesses MEV exposure, and finds profit-extraction vectors.",
      tags: ["hunt","economic","differential","mev","arbitrage","incentive","profit"],
    },
  ];

  for (const hp of HUNT_PATTERNS) {
    try {
      const raw = await fetchText(
        `${SC_AUDITOR_BASE}/assets/prompts/${hp.file}.md`
      );
      writeSkill(hp.id, {
        name: hp.name,
        version: "1.0.0",
        description: hp.description,
        category: "hunt-pattern",
        tags: hp.tags,
      }, raw);
    } catch (e) {
      console.warn(`  ⚠  Could not fetch hunt pattern ${hp.file}: ${e.message}`);
    }
  }

  console.log("\n✓ Ingest complete.\n");
}

main().catch((err) => {
  console.error("Ingest failed:", err);
  process.exit(1);
});
