import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runAudit, summarizeReport, exportEvidenceBundle, capabilities } from "../src/index.ts";

type Schema = Record<string, any>;
const load = (name: string): Schema => JSON.parse(readFileSync(new URL(`../../../schemas/${name}.schema.json`, import.meta.url), "utf8"));

/** Minimal validator for the JSON Schema subset the srp schemas use. Returns error paths. */
function validate(schema: Schema, value: any, path = "$"): string[] {
  const errors: string[] = [];
  if ("const" in schema && value !== schema.const) return [`${path}: expected ${schema.const}`];
  if (schema.enum && !schema.enum.includes(value)) return [`${path}: ${JSON.stringify(value)} not in enum`];
  const t = schema.type;
  if (t === "string" && typeof value !== "string") return [`${path}: expected string`];
  if (t === "number" && typeof value !== "number") return [`${path}: expected number`];
  if (t === "integer" && !Number.isInteger(value)) return [`${path}: expected integer`];
  if (t === "boolean" && typeof value !== "boolean") return [`${path}: expected boolean`];
  if (schema.pattern && !new RegExp(schema.pattern).test(value)) return [`${path}: pattern`];
  if (t === "array") {
    if (!Array.isArray(value)) return [`${path}: expected array`];
    value.forEach((item, i) => errors.push(...validate(schema.items ?? {}, item, `${path}[${i}]`)));
  }
  if (t === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [`${path}: expected object`];
    for (const key of schema.required ?? []) if (!(key in value) || value[key] === undefined) errors.push(`${path}.${key}: missing`);
    for (const [key, v] of Object.entries(value)) {
      if (v === undefined) continue;
      const sub = schema.properties?.[key] ?? (typeof schema.additionalProperties === "object" ? schema.additionalProperties : undefined);
      if (sub) errors.push(...validate(sub, v, `${path}.${key}`));
    }
  }
  return errors;
}

const report = runAudit({
  name: "Vault",
  chain: "ethereum",
  documents: [{ path: "README.md", kind: "README", content: "The vault must remain solvent." }],
  sources: [{ path: "Vault.sol", language: "solidity", content: `contract Vault {
    mapping(address => uint256) balances;
    function withdraw() external {
      (bool ok,) = msg.sender.call{value: balances[msg.sender]}("");
      require(ok);
      balances[msg.sender] = 0;
    }
  }` }]
});

test("real outputs validate against the frozen schemas", () => {
  assert.ok(report.findings.length > 0);
  assert.deepEqual(validate(load("srp.audit.v1"), JSON.parse(JSON.stringify(report))), []);
  assert.deepEqual(validate(load("srp.summary.v1"), JSON.parse(JSON.stringify(summarizeReport(report)))), []);
  assert.deepEqual(validate(load("srp.evidence-bundle.v1"), JSON.parse(JSON.stringify(exportEvidenceBundle(report)))), []);
  assert.deepEqual(validate(load("srp.capabilities.v1"), JSON.parse(JSON.stringify(capabilities(false)))), []);
});

test("the validator rejects a broken summary", () => {
  const summary: any = JSON.parse(JSON.stringify(summarizeReport(report)));
  delete summary.counts;
  summary.findings[0].status = "bogus";
  const errors = validate(load("srp.summary.v1"), summary);
  assert.ok(errors.some((e) => e.includes("counts: missing")));
  assert.ok(errors.some((e) => e.includes("status")));
});
