import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { SrpMcp, runMcpStdio } from "../src/server.ts";

const ETHER_STORE = `contract EtherStore {
    mapping(address => uint256) public balances;
    function withdraw() public {
        uint256 bal = balances[msg.sender];
        (bool sent, ) = msg.sender.call{value: bal}("");
        require(sent);
        balances[msg.sender] = 0;
    }
}`;

function call(server: SrpMcp, name: string, args: Record<string, unknown>, id = 1) {
  return server.handle({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } }) as { result: { isError: boolean; structuredContent: any; content: Array<{ text: string }> } };
}

test("initialize negotiates a protocol version and lists tools with schemas", () => {
  const server = new SrpMcp(tmpdir());
  const init = server.handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "1" } } }) as any;
  assert.equal(init.result.protocolVersion, "2025-03-26");
  assert.equal(init.result.serverInfo.name, "srp");
  assert.equal(server.handle({ jsonrpc: "2.0", method: "notifications/initialized" }), undefined);
  const list = server.handle({ jsonrpc: "2.0", id: 2, method: "tools/list" }) as any;
  const names = list.result.tools.map((tool: { name: string }) => tool.name);
  for (const name of ["srp_scan_path", "srp_scan_source", "srp_attach_proof", "srp_coverage", "srp_export_evidence", "srp_capabilities"]) assert.ok(names.includes(name), name);
  assert.ok(list.result.tools.every((tool: { inputSchema: { type: string } }) => tool.inputSchema.type === "object"));
});

test("scan inline source, read a finding, attach a passing proof", () => {
  const server = new SrpMcp(tmpdir());
  const scan = call(server, "srp_scan_source", { chain: "ethereum", sources: [{ path: "EtherStore.sol", content: ETHER_STORE }] });
  assert.equal(scan.result.isError, false);
  const summary = scan.result.structuredContent;
  assert.equal(summary.schemaVersion, "srp.summary/v1");
  const finding = summary.findings[0];
  assert.equal(finding.detector, "evm-reentrancy-external-call");
  assert.equal(finding.status, "partial");
  const detail = call(server, "srp_get_finding", { auditId: summary.auditId, findingId: finding.id });
  assert.match(detail.result.structuredContent.validation.harness, /forge-std/);
  const proved = call(server, "srp_attach_proof", { auditId: summary.auditId, findingId: finding.id, command: "forge test", passed: true, assertion: "attacker drained the pool" });
  assert.equal(proved.result.structuredContent.findings[0].status, "proven");
  const coverage = call(server, "srp_coverage", { auditId: summary.auditId });
  assert.equal(coverage.result.structuredContent.coverage.analyzedFiles, 1);
  const bundle = call(server, "srp_export_evidence", { auditId: summary.auditId });
  assert.equal(bundle.result.structuredContent.schemaVersion, "srp.evidence-bundle/v1");
});

test("tool errors come back as isError results, not crashes", () => {
  const server = new SrpMcp(tmpdir());
  assert.equal(call(server, "srp_scan_source", { chain: "bogus", sources: [] }).result.isError, true);
  assert.equal(call(server, "srp_coverage", { auditId: "audit_nope" }).result.isError, true);
  assert.equal(call(server, "srp_attach_proof", { auditId: "x", findingId: "y", command: "z", passed: true, assertion: "a" }).result.isError, true);
  const unknownTool = server.handle({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "nope" } }) as any;
  assert.equal(unknownTool.error.code, -32602);
  const unknownMethod = server.handle({ jsonrpc: "2.0", id: 10, method: "resources/list" }) as any;
  assert.equal(unknownMethod.error.code, -32601);
  assert.equal((server.handle({ id: 11, method: "x" }) as any).error.code, -32600);
});

test("srp_scan_path is confined to the server root", () => {
  const root = mkdtempSync(join(tmpdir(), "srp-mcp-"));
  writeFileSync(join(root, "EtherStore.sol"), ETHER_STORE);
  const server = new SrpMcp(root);
  const ok = call(server, "srp_scan_path", { path: "." });
  assert.equal(ok.result.isError, false);
  assert.equal(ok.result.structuredContent.findings[0].location, "EtherStore.sol:5");
  const escape = call(server, "srp_scan_path", { path: "../../etc" });
  assert.equal(escape.result.isError, true);
  assert.match(escape.result.content[0]!.text, /outside the server root/);
});

test("stdio transport: one JSON response per request line, parse errors reported, notifications silent", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  let received = "";
  output.on("data", (chunk) => { received += chunk.toString(); });
  const done = runMcpStdio(input, output);
  input.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } })}\n`);
  input.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
  input.write("not json\n");
  input.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "ping" })}\n`);
  input.end();
  await done;
  const lines = received.trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(lines.length, 3);
  assert.equal(lines[0].result.protocolVersion, "2025-06-18");
  assert.equal(lines[1].error.code, -32700);
  assert.deepEqual(lines[2], { jsonrpc: "2.0", id: 2, result: {} });
});
