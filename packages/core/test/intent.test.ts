import test from "node:test";
import assert from "node:assert/strict";
import { buildProtocolIntent } from "../src/intent.ts";
import type { ProtocolInput } from "../src/types.ts";

test("intent engine - trust boundaries and invariants", () => {
  const input: ProtocolInput = {
    name: "GovernanceToken",
    chain: "evm",
    documents: [{
      path: "README.md",
      kind: "README",
      content: "The protocol admin can upgrade the implementation. Total supply must never exceed 1M tokens."
    }],
    sources: []
  };
  const intent = buildProtocolIntent(input);
  assert.ok(intent.trustBoundaries.some(b => b.includes("upgrade")), "Should extract upgrade trust boundary");
  assert.ok(intent.invariants.some(i => i.includes("never exceed")), "Should extract invariant");
});

test("intent engine - DeFi primitives", () => {
  const input: ProtocolInput = {
    name: "AaveClone",
    chain: "evm",
    documents: [{
      path: "README.md",
      kind: "README",
      content: "Users can deposit collateral and borrow assets. Liquidators can liquidate undercollateralized positions."
    }],
    sources: []
  };
  const intent = buildProtocolIntent(input);
  assert.ok(intent.defiPrimitives.includes("Lending/Borrowing"), "Should detect lending/borrowing primitive");
});
