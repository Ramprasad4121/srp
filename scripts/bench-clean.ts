// Precision check on audited, widely used Solidity: every finding on these corpora is a candidate false positive.
// Usage: node scripts/bench-clean.ts [workdir]   (clones pinned commits with git; needs network the first time)
// `mocks/`, `test/`, `lib/`, `node_modules/` are skipped: OpenZeppelin's mocks are intentionally unsafe test doubles.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { runAudit } from "../packages/core/src/index.ts";

const work = process.argv[2] ?? "/tmp/srp-clean";
const corpora = [
  { name: "openzeppelin-contracts", url: "https://github.com/OpenZeppelin/openzeppelin-contracts", commit: "b04d141ba4fec9b0f970ce4c7746b0a02e50000b", dir: "contracts" },
  { name: "uniswap-v3-core", url: "https://github.com/Uniswap/v3-core", commit: "aab5aa019b5acb312acc01aff7f03a1b09755197", dir: "contracts" },
  { name: "solmate", url: "https://github.com/transmissions11/solmate", commit: "89365b880c4f3c786bdd453d4b8e8fe410344a69", dir: "src" },
];
const skip = new Set(["node_modules", "lib", "test", "tests", "mocks", ".git"]);
const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? (skip.has(n) ? [] : walk(p)) : p.endsWith(".sol") ? [p] : [];
});
mkdirSync(work, { recursive: true });
let total = 0;
console.log("| Corpus | Commit | Files | Findings | Parse errors |\n| --- | --- | --- | --- | --- |");
const detail: string[] = [];
for (const c of corpora) {
  const repo = join(work, c.name);
  if (!existsSync(repo)) {
    execFileSync("git", ["clone", "-q", c.url, repo], { stdio: "inherit" });
  }
  execFileSync("git", ["-C", repo, "checkout", "-q", c.commit], { stdio: "inherit" });
  const root = join(repo, c.dir);
  let files = 0, findings = 0, errors = 0;
  for (const f of walk(root)) {
    files++;
    try {
      const r = runAudit({ name: f, chain: "ethereum", documents: [], sources: [{ path: relative(root, f), language: "solidity", content: readFileSync(f, "utf8") }] });
      for (const x of r.findings) { findings++; detail.push(`${c.name}\t${x.detector}\t${x.evidence[0]?.file}:${x.evidence[0]?.startLine}`); }
    } catch { errors++; }
  }
  total += findings;
  console.log(`| ${c.name} | ${c.commit.slice(0, 7)} | ${files} | ${findings} | ${errors} |`);
}
if (detail.length) console.log("\nFindings (each is a candidate false positive, review by hand):\n" + detail.join("\n"));
process.exit(total === 0 ? 0 : 1);
