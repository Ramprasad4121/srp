import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyConfig, exceedsThreshold, loadConfig, loadProject, runAudit } from "../src/index.ts";

const VULN = (comment: string) => `contract EtherStore {
    mapping(address => uint256) public balances;
${comment}    function withdraw() public {
        uint256 bal = balances[msg.sender];
        (bool sent, ) = msg.sender.call{value: bal}("");
        require(sent);
        balances[msg.sender] = 0;
    }
}`;

function scan(source: string, config?: Parameters<typeof applyConfig>[2]) {
  const dir = mkdtempSync(join(tmpdir(), "srp-config-"));
  try {
    writeFileSync(join(dir, "Store.sol"), source);
    const project = loadProject(dir);
    return applyConfig(runAudit(project.input), project.input.sources, config);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test("baseline: the vulnerable contract is flagged", () => {
  assert.ok(scan(VULN("")).findings.some((f) => f.detector === "evm-reentrancy-external-call"));
});

test("inline srp-ignore drops the finding and reports it as a residual unknown", () => {
  const base = scan(VULN(""));
  const finding = base.findings.find((f) => f.detector === "evm-reentrancy-external-call")!;
  const line = finding.evidence[0]!.startLine;
  // comment on the line above the finding
  const lines = VULN("").split("\n");
  lines.splice(line - 1, 0, "        // srp-ignore evm-reentrancy-external-call: guarded by the pause flag off-chain");
  const report = scan(lines.join("\n"));
  assert.ok(!report.findings.some((f) => f.detector === "evm-reentrancy-external-call"));
  const note = report.unknowns.find((u) => u.reason.includes("srp-ignore comment: guarded by the pause flag"));
  assert.ok(note, "suppression must be reported");
  assert.match(note!.question, /evm-reentrancy-external-call/);
});

test("srp-ignore for another detector does not suppress", () => {
  const lines = VULN("").split("\n");
  lines.splice(4, 0, "        // srp-ignore evm-weak-randomness");
  assert.ok(scan(lines.join("\n")).findings.some((f) => f.detector === "evm-reentrancy-external-call"));
});

test("disabledDetectors and ignorePaths drop findings and report them", () => {
  const disabled = scan(VULN(""), { disabledDetectors: ["evm-reentrancy-external-call"] });
  assert.ok(!disabled.findings.some((f) => f.detector === "evm-reentrancy-external-call"));
  assert.ok(disabled.unknowns.some((u) => u.reason.includes("detector disabled")));
  const ignored = scan(VULN(""), { ignorePaths: ["*.sol"] });
  assert.equal(ignored.findings.length, 0);
  assert.ok(ignored.unknowns.some((u) => u.reason.includes("ignorePaths")));
  assert.ok(scan(VULN(""), { ignorePaths: ["other/**"] }).findings.length > 0);
});

test("severityOverrides change the proposed severity and the --fail-on gate", () => {
  const before = scan(VULN(""));
  assert.equal(exceedsThreshold(before, "high"), true);
  const after = scan(VULN(""), { severityOverrides: { "evm-reentrancy-external-call": "low" } });
  const finding = after.findings.find((f) => f.detector === "evm-reentrancy-external-call")!;
  assert.equal(finding.proposedSeverity, "low");
  assert.equal(exceedsThreshold(after, "high"), false);
});

test("loadConfig validates the file", () => {
  const dir = mkdtempSync(join(tmpdir(), "srp-config-"));
  try {
    assert.equal(loadConfig(dir), undefined);
    writeFileSync(join(dir, "srp.config.json"), JSON.stringify({ disabledDetector: [] }));
    assert.throws(() => loadConfig(dir), /unknown key "disabledDetector"/);
    writeFileSync(join(dir, "srp.config.json"), JSON.stringify({ severityOverrides: { "evm-reentrancy-external-call": "huge" } }));
    assert.throws(() => loadConfig(dir), /must be one of/);
    writeFileSync(join(dir, "srp.config.json"), "{nope");
    assert.throws(() => loadConfig(dir), /Invalid JSON/);
    writeFileSync(join(dir, "srp.config.json"), JSON.stringify({ ignorePaths: ["a/**"], disabledDetectors: ["x"] }));
    assert.deepEqual(loadConfig(dir)?.ignorePaths, ["a/**"]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
