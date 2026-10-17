import test from "node:test";
import assert from "node:assert/strict";
import { discoverVulnerabilities } from "../src/discovery.ts";

const run = (sources: Array<{ path: string; content: string }>) =>
  discoverVulnerabilities({ chain: "evm", sources: sources.map((s) => ({ ...s, language: "solidity" })) } as never).filter((f) => f.detector === "evm-missing-access-control");

const modGuard = `contract Own { address owner; modifier onlyOwner() { require(msg.sender == owner, "no"); _; } }`;
const modNoop = `contract Own { address owner; modifier onlyOwner() { _; } }`;
const child = `import "./Own.sol"; contract V is Own { address public admin; function setAdmin(address a) external onlyOwner { admin = a; } }`;

test("modifier defined in another file that checks caller suppresses the finding", () => {
  assert.equal(run([{ path: "Own.sol", content: modGuard }, { path: "V.sol", content: child }]).length, 0);
});
test("modifier defined in another file with no check does not count as a guard", () => {
  assert.ok(run([{ path: "Own.sol", content: modNoop }, { path: "V.sol", content: child }]).length > 0);
});
const sup = (parent: string) => [{ path: "P.sol", content: parent }, { path: "V.sol", content: `import "./P.sol"; contract V is P { function setAdmin(address a) public override { super.setAdmin(a); } }` }];
test("super override with guarded parent is clean", () => {
  assert.equal(run(sup(`contract P { address admin; address owner; function setAdmin(address a) public virtual { require(msg.sender == owner); admin = a; } }`)).length, 0);
});
test("super override with unguarded parent is flagged", () => {
  assert.ok(run(sup(`contract P { address admin; function setAdmin(address a) public virtual { admin = a; } }`)).length > 0);
});
test("super override with parent not supplied stays skipped", () => {
  assert.equal(run([sup("")[1]!]).length, 0);
});
