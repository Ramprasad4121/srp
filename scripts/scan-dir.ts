// Scan every .sol or .rs file under a directory, one audit per file, and print findings per detector.
// Usage: node scripts/scan-dir.ts <dir> <chain> [--verbose]
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { runAudit, type Chain } from "../packages/core/src/index.ts";

const [root, chain = "ethereum", flag] = process.argv.slice(2);
if (!root) {
  console.error("usage: node scripts/scan-dir.ts <dir> <chain> [--verbose]");
  process.exit(2);
}
const ext = chain === "solana" ? ".rs" : ".sol";
const skip = new Set(["node_modules", "lib", "test", "tests", ".git", "target"]);
const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? (skip.has(name) ? [] : walk(path)) : path.endsWith(ext) ? [path] : [];
});
const counts: Record<string, number> = {};
let errors = 0;
for (const file of walk(root)) {
  try {
    const report = runAudit({ name: file, chain: chain as Chain, documents: [], sources: [{ path: relative(root, file), language: ext === ".rs" ? "rust" : "solidity", content: readFileSync(file, "utf8") }] });
    for (const finding of report.findings) {
      counts[finding.detector] = (counts[finding.detector] ?? 0) + 1;
      if (flag === "--verbose") console.log(`${finding.detector}\t${finding.evidence[0]?.file}:${finding.evidence[0]?.startLine}\t${finding.evidence[0]?.excerpt.slice(0, 100)}`);
    }
  } catch (error) {
    errors += 1;
    console.error(`error\t${file}\t${error instanceof Error ? error.message : String(error)}`);
  }
}
console.log(JSON.stringify({ counts, errors }, null, 2));
