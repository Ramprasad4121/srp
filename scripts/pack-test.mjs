// Builds, packs, installs the tarball in a temp dir and runs the real bin.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
run("npm", ["run", "build"], process.cwd());
const dir = mkdtempSync(join(tmpdir(), "srp-pack-"));
run("npm", ["pack", "--pack-destination", dir], process.cwd());
const tgz = readdirSync(dir).find((f) => f.endsWith(".tgz"));
const proj = join(dir, "proj");
mkdirSync(join(proj, "contracts"), { recursive: true });
writeFileSync(join(proj, "package.json"), "{}");
writeFileSync(join(proj, "foundry.toml"), "[profile.default]\n");
writeFileSync(join(proj, "contracts", "V.sol"), `pragma solidity ^0.8.20;
contract V { mapping(address=>uint) b; function w() external { (bool ok,) = msg.sender.call{value: b[msg.sender]}(""); require(ok); b[msg.sender]=0; } }
`);
run("npm", ["install", join(dir, tgz)], proj);
let out;
try { out = run("npx", ["srp", "scan", "."], proj); }
catch (error) { out = String(error.stdout ?? ""); } // scan exits non-zero when it has findings
if (!/reentr/i.test(out)) { console.error(out); throw new Error("packed srp scan did not report the reentrancy fixture"); }
console.log("pack test ok");
