import test from "node:test";
import assert from "node:assert/strict";
import { AgentRegistry, OrchestrationEngine, SharedMemory, buildProtocolIntent } from "../src/index.ts";

test("intent sentences come from docs and NatSpec, not from code split on dots", () => {
  const intent = buildProtocolIntent({
    name: "Vault",
    chain: "ethereum",
    documents: [{ path: "README.md", kind: "README", content: "Only the governor may pause the vault. Users can withdraw at any time." }],
    sources: [{
      path: "Vault.sol",
      language: "solidity",
      content: `contract Vault {
  /// @notice Withdrawals must never exceed the caller's balance.
  function withdraw() external { require(msg.sender.balance > 0, "only owner must"); (bool ok,) = msg.sender.call(""); }
}`
    }]
  });
  assert.ok(intent.securityGuarantees.includes("Only the governor may pause the vault."));
  assert.ok(intent.securityGuarantees.some((item) => /Withdrawals must never exceed/.test(item)));
  assert.ok(intent.securityGuarantees.every((item) => !/msg\.sender|require\(|\.call/.test(item)), JSON.stringify(intent.securityGuarantees));
});

test("generated assumptions and invariants are labelled Inferred", () => {
  const intent = buildProtocolIntent({ name: "Pool", chain: "ethereum", documents: [], sources: [{ path: "Pool.sol", language: "solidity", content: "contract Pool { address oracle; }" }] });
  assert.ok(intent.invariants.some((item) => item.startsWith("Inferred: protocol accounting")));
  assert.ok(intent.assumptions.some((item) => item.startsWith("Inferred: oracle")));
});

test("orchestration refuses modes it does not implement instead of silently running them sequentially", async () => {
  const registry = new AgentRegistry();
  registry.register({ id: "a", role: "attacker", description: "", execute: (input) => input });
  const engine = new OrchestrationEngine(registry, new SharedMemory());
  await assert.rejects(engine.execute("debate", ["a"], 1), /not implemented/);
  await assert.rejects(engine.execute("verification", ["a"], 1), /not implemented/);
  assert.deepEqual(await engine.execute("sequential", ["a"], 1), [1]);
});
