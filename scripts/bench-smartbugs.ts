// Run SRP on smartbugs-curated (every file there contains >=1 labelled vuln). Usage: node scripts/bench-smartbugs.ts <smartbugs-curated dir>
// Recall per category = files whose category-mapped detector fired / files in category.
// Precision is NOT measurable here (no clean files, only one label per file), so we report where each detector fired.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { runAudit } from "../packages/core/src/index.ts";

const root = process.argv[2];
if (!root) { console.error("usage: node scripts/bench-smartbugs.ts <dir>"); process.exit(2); }
const map: Record<string, string[]> = {
  reentrancy: ["evm-reentrancy-external-call"],
  access_control: ["evm-missing-access-control", "evm-tx-origin-auth", "evm-arbitrary-delegatecall", "evm-unprotected-upgrade"],
  arithmetic: ["evm-unchecked-arithmetic"], bad_randomness: ["evm-weak-randomness"], denial_of_service: ["evm-dos-unbounded-payout-loop"], front_running: [], short_addresses: [], time_manipulation: [], unchecked_low_level_calls: ["evm-unchecked-low-level-call"], other: [],
};
const fired: Record<string, Record<string, number>> = {};
const rows: string[] = [];
for (const cat of Object.keys(map)) {
  const dir = join(root, "dataset", cat);
  const files = readdirSync(dir).filter((f) => f.endsWith(".sol"));
  let hit = 0, errs = 0;
  fired[cat] = {};
  for (const f of files) {
    try {
      const r = runAudit({ name: f, chain: "ethereum", documents: [], sources: [{ path: f, language: "solidity", content: readFileSync(join(dir, f), "utf8") }] });
      const ds = new Set(r.findings.map((x) => x.detector));
      for (const d of ds) fired[cat][d] = (fired[cat][d] ?? 0) + 1;
      if (map[cat].some((d) => ds.has(d))) hit++;
    } catch { errs++; }
  }
  rows.push(`| ${cat} | ${files.length} | ${map[cat].length ? map[cat].join(", ") : "no detector"} | ${map[cat].length ? `${hit}/${files.length}` : "n/a"} | ${errs} |`);
}
console.log("| Category | Files | Mapped detectors | Recall (files) | Parse errors |\n| --- | --- | --- | --- | --- |\n" + rows.join("\n"));
console.log("\nFiles each detector fired on, by labelled category:");
for (const [c, m] of Object.entries(fired)) console.log(`- ${c}: ${JSON.stringify(m)}`);
