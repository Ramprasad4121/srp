import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { SrpMcp } from "../src/server.ts";

const root = new URL("../../../", import.meta.url);

test("agent rules files only name MCP tools that exist", () => {
  const server = new SrpMcp(tmpdir());
  const list = server.handle({ jsonrpc: "2.0", id: 1, method: "tools/list" }) as any;
  const tools = new Set<string>(list.result.tools.map((t: { name: string }) => t.name));
  const files = readdirSync(new URL("docs/agent-rules/", root)).filter((f) => f !== "README.md");
  assert.ok(files.length >= 3);
  for (const file of files) {
    const text = readFileSync(new URL(`docs/agent-rules/${file}`, root), "utf8");
    const named = [...text.matchAll(/\bsrp_[a-z_]+\b/g)].map((m) => m[0]);
    assert.ok(named.includes("srp_scan_path"), `${file} should tell the agent to call srp_scan_path`);
    for (const name of named) assert.ok(tools.has(name), `${file} names unknown tool ${name}`);
  }
});

test("action.yml wires the CLI, SARIF upload and exit code", () => {
  const text = readFileSync(new URL("action.yml", root), "utf8");
  for (const needle of ["using: composite", "--format sarif", "--fail-on", "github/codeql-action/upload-sarif", "exit \"$CODE\""]) {
    assert.ok(text.includes(needle), `action.yml missing ${needle}`);
  }
  assert.ok(!/\bnpx\b/.test(text), "action must not depend on an npm publish");
});
