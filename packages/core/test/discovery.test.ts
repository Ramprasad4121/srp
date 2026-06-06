import test from "node:test";
import assert from "node:assert/strict";
import { discoverVulnerabilities } from "../src/discovery.ts";
import type { ProtocolInput } from "../src/types.ts";

test("discovery engine - EVM reentrancy", () => {
  const input: ProtocolInput = {
    name: "TestVault",
    chain: "evm",
    documents: [],
    sources: [{
      path: "Vault.sol",
      language: "solidity",
      content: `
        function withdraw() public {
          uint balance = balances[msg.sender];
          (bool success, ) = msg.sender.call{value: balance}("");
          require(success);
          balances[msg.sender] = 0;
        }
      `
    }]
  };
  const findings = discoverVulnerabilities(input);
  const reentrancy = findings.find(f => f.detector === "evm-reentrancy-external-call");
  assert.ok(reentrancy, "Should detect reentrancy");
  assert.equal(reentrancy.severity, "high");
});

test("discovery engine - Solana PDA validation", () => {
  const input: ProtocolInput = {
    name: "TestProgram",
    chain: "solana",
    documents: [],
    sources: [{
      path: "lib.rs",
      language: "rust",
      content: `
        let (pda, bump) = Pubkey::find_program_address(&[b"seed"], program_id);
      `
    }]
  };
  const findings = discoverVulnerabilities(input);
  const pda = findings.find(f => f.detector === "solana-pda-validation");
  assert.ok(pda, "Should detect PDA validation requirement");
  assert.equal(pda.severity, "high");
});

test("discovery engine - EVM flash loan", () => {
  const input: ProtocolInput = {
    name: "TestLoan",
    chain: "evm",
    documents: [],
    sources: [{
      path: "FlashLoan.sol",
      language: "solidity",
      content: `
        function executeOperation(address asset, uint256 amount, uint256 premium, address initiator, bytes calldata params) external returns (bool) {
          return true;
        }
      `
    }]
  };
  const findings = discoverVulnerabilities(input);
  const flash = findings.find(f => f.detector === "evm-flash-loan-attack");
  assert.ok(flash, "Should detect flash loan pattern");
});

test("discovery engine - EVM tx.origin", () => {
  const input: ProtocolInput = {
    name: "TestPhish",
    chain: "evm",
    documents: [],
    sources: [{
      path: "Auth.sol",
      language: "solidity",
      content: `
        require(tx.origin == owner, "Not owner");
      `
    }]
  };
  const findings = discoverVulnerabilities(input);
  const origin = findings.find(f => f.detector === "evm-tx-origin");
  assert.ok(origin, "Should detect tx.origin");
  assert.equal(origin.severity, "high");
});

test("discovery engine - EVM selfdestruct", () => {
  const input: ProtocolInput = {
    name: "TestSuicide",
    chain: "evm",
    documents: [],
    sources: [{
      path: "Kill.sol",
      language: "solidity",
      content: `
        function kill() public {
          selfdestruct(payable(msg.sender));
        }
      `
    }]
  };
  const findings = discoverVulnerabilities(input);
  const sd = findings.find(f => f.detector === "evm-selfdestruct");
  assert.ok(sd, "Should detect selfdestruct");
  assert.equal(sd.severity, "critical");
});

test("discovery engine - Chain filtering", () => {
  const input: ProtocolInput = {
    name: "TestFilter",
    chain: "evm",
    documents: [],
    sources: [{
      path: "Filter.sol",
      language: "solidity",
      content: `
        let (pda, bump) = Pubkey::find_program_address(&[b"seed"], program_id);
      `
    }]
  };
  const findings = discoverVulnerabilities(input);
  const pda = findings.find(f => f.detector === "solana-pda-validation");
  assert.ok(!pda, "Should NOT detect Solana patterns on EVM chain");
});
