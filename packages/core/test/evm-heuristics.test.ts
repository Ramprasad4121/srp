import test from "node:test";
import assert from "node:assert/strict";
import { discoverVulnerabilities, runAudit } from "../src/index.ts";
import type { ProtocolInput } from "../src/types.ts";

function evm(content: string, chain: ProtocolInput["chain"] = "ethereum"): ProtocolInput {
  return { name: "Fixture", chain, documents: [], sources: [{ path: "Fixture.sol", language: "solidity", content }] };
}

function detectors(content: string, chain: ProtocolInput["chain"] = "ethereum"): string[] {
  return discoverVulnerabilities(evm(content, chain)).map((finding) => finding.detector);
}

const STALE_ORACLE = `contract Lender {
  AggregatorV3Interface feed;
  function collateralValue(uint256 amount) public view returns (uint256) {
    (, int256 answer, , , ) = feed.latestRoundData();
    return amount * uint256(answer);
  }
}`;

const FRESH_ORACLE = `contract Lender {
  AggregatorV3Interface feed;
  uint256 constant HEARTBEAT = 3600;
  function collateralValue(uint256 amount) public view returns (uint256) {
    (, int256 answer, , uint256 updatedAt, ) = feed.latestRoundData();
    require(block.timestamp - updatedAt <= HEARTBEAT, "stale");
    require(answer > 0, "bad answer");
    return amount * uint256(answer);
  }
}`;

test("stale oracle: flags latestRoundData with no updatedAt check", () => {
  const findings = discoverVulnerabilities(evm(STALE_ORACLE));
  const hit = findings.find((finding) => finding.detector === "evm-oracle-stale-price");
  assert.ok(hit, "expected evm-oracle-stale-price");
  assert.equal(hit.evidence[0]?.startLine, 4);
  assert.match(hit.evidence[0]?.excerpt ?? "", /latestRoundData/);
});

test("stale oracle: silent when updatedAt is compared to block.timestamp", () => {
  assert.ok(!detectors(FRESH_ORACLE).includes("evm-oracle-stale-price"));
});

test("tx.origin auth: flags equality check on tx.origin", () => {
  const src = `contract Wallet {
    address owner;
    function sweep(address to) external {
      require(tx.origin == owner, "not owner");
      payable(to).transfer(address(this).balance);
    }
  }`;
  const hit = discoverVulnerabilities(evm(src)).find((finding) => finding.detector === "evm-tx-origin-auth");
  assert.ok(hit);
  assert.equal(hit.evidence[0]?.startLine, 4);
});

test("tx.origin auth: silent when only msg.sender is used", () => {
  const src = `contract Wallet {
    address owner;
    function sweep(address to) external {
      require(msg.sender == owner, "not owner");
    }
  }`;
  assert.ok(!detectors(src).includes("evm-tx-origin-auth"));
});

const REPLAYABLE = `contract Minter {
  address signer;
  function mintWithSig(address to, uint256 amount, uint8 v, bytes32 r, bytes32 s) external {
    bytes32 digest = keccak256(abi.encodePacked(to, amount));
    require(ecrecover(digest, v, r, s) == signer, "bad sig");
    _mint(to, amount);
  }
}`;

const WITH_NONCE = `contract Minter {
  address signer;
  mapping(address => uint256) public nonces;
  function mintWithSig(address to, uint256 amount, uint8 v, bytes32 r, bytes32 s) external {
    bytes32 digest = keccak256(abi.encodePacked(to, amount, nonces[to]++, block.chainid, address(this)));
    require(ecrecover(digest, v, r, s) == signer, "bad sig");
    _mint(to, amount);
  }
}`;

test("signature replay: flags ecrecover with no nonce or used-signature record", () => {
  const hit = discoverVulnerabilities(evm(REPLAYABLE)).find((finding) => finding.detector === "evm-signature-replay");
  assert.ok(hit);
  assert.equal(hit.evidence[0]?.startLine, 5);
  assert.ok(hit.attackPath.some((step) => /resubmit/i.test(step)));
});

test("signature replay: silent when a nonce is consumed", () => {
  assert.ok(!detectors(WITH_NONCE).includes("evm-signature-replay"));
});

const NAIVE_VAULT = `contract Vault is ERC4626 {
  function totalAssets() public view override returns (uint256) {
    return asset.balanceOf(address(this));
  }
}`;

const OFFSET_VAULT = `contract Vault is ERC4626 {
  function _decimalsOffset() internal pure override returns (uint8) { return 6; }
  function totalAssets() public view override returns (uint256) {
    return asset.balanceOf(address(this));
  }
}`;

test("ERC4626 donation: flags totalAssets read from raw balance", () => {
  const hit = discoverVulnerabilities(evm(NAIVE_VAULT)).find((finding) => finding.detector === "evm-erc4626-donation-inflation");
  assert.ok(hit);
  assert.equal(hit.evidence[0]?.startLine, 3);
});

test("ERC4626 donation: silent with virtual share offset", () => {
  assert.ok(!detectors(OFFSET_VAULT).includes("evm-erc4626-donation-inflation"));
});

test("ERC4626 donation: silent for a contract that is not a vault", () => {
  const src = `contract Treasury {
    function sweep(IERC20 token) external { token.transfer(owner, token.balanceOf(address(this))); }
  }`;
  assert.ok(!detectors(src).includes("evm-erc4626-donation-inflation"));
});

test("new EVM rules do not fire on Solana sources", () => {
  const all = [STALE_ORACLE, REPLAYABLE, NAIVE_VAULT].join("\n");
  const found = detectors(all, "solana");
  for (const id of ["evm-oracle-stale-price", "evm-signature-replay", "evm-erc4626-donation-inflation", "evm-tx-origin-auth"]) {
    assert.ok(!found.includes(id), `${id} should not fire on solana`);
  }
});

test("reentrancy behind nonReentrant is recorded as mitigated and never marked proven", () => {
  const guarded = `contract Vault is ReentrancyGuard {
    mapping(address => uint256) balances;
    function withdraw() external nonReentrant {
      (bool ok,) = msg.sender.call{value: balances[msg.sender]}("");
      require(ok);
      balances[msg.sender] = 0;
    }
  }`;
  const report = runAudit(evm(guarded));
  const hit = report.findings.find((finding) => finding.detector === "evm-reentrancy-external-call");
  assert.ok(hit);
  assert.ok(hit.mitigations?.some((item) => /nonReentrant/.test(item)));
  assert.notEqual(hit.status, "proven");
  const debate = report.debates.find((item) => item.findingId === hit.id);
  assert.ok(debate?.rounds.some((round) => /mitigation/i.test(round.defender)));
});

test("unguarded reentrancy (state written after call) is flagged with both lines but not proven without an executed PoC", () => {
  const report = runAudit(evm(`contract Vault {
    mapping(address => uint256) balances;
    function withdraw() external {
      (bool ok,) = msg.sender.call{value: balances[msg.sender]}("");
      require(ok);
      balances[msg.sender] = 0;
    }
  }`));
  const hit = report.findings.find((finding) => finding.detector === "evm-reentrancy-external-call");
  assert.ok(hit);
  assert.deepEqual(hit.evidence.map((item) => item.startLine), [4, 6]);
  assert.equal(hit.mitigations, undefined);
  assert.equal(hit.status, "partial");
  assert.equal(hit.proposedSeverity, "high");
  const poc = report.pocResults.find((item) => item.findingId === hit.id);
  assert.equal(poc?.executed, false);
  assert.match(poc?.harness ?? "", /forge-std\/Test\.sol/);
});

test("legacy pre-0.5 call.value()() reentrancy is detected (SmartBugs reentrancy_dao shape)", () => {
  const report = runAudit(evm(`pragma solidity ^0.4.19;
  contract DAO {
    mapping(address => uint) credit;
    function withdrawAll() public {
      uint c = credit[msg.sender];
      bool ok = msg.sender.call.value(c)();
      require(ok);
      credit[msg.sender] = 0;
    }
  }`));
  assert.ok(report.findings.some((finding) => finding.detector === "evm-reentrancy-external-call"));
});

const UNCHECKED = `contract Payout {
  mapping(address => uint256) public owed;
  function pay(address to) public {
    owed[to] = 0;
    to.send(1 ether);
  }
  function pay2(address payable to) public {
    to.call.value(1 ether)("");
  }
  function pay3(address to) public {
    to.call{value: 1 ether}("");
  }
}`;

const CHECKED = `contract Payout {
  function a(address to) public { (bool ok, ) = to.call{value: 1 ether}(""); require(ok); }
  function b(address to) public { require(to.send(1 ether)); }
  function c(address to) public { if (!to.send(1 ether)) revert(); }
  function d(address to) public returns (bool) { return to.send(1 ether); }
  function e(address to) public { bool ok = to.send(1 ether); require(ok); }
  function f(address token, address to) public { IERC777(token).send(to, 1, ""); }
  function g(address to) public { payable(to).transfer(1 ether); }
}`;

test("unchecked low-level call: flags bare send, call.value and call{value}", () => {
  const hits = discoverVulnerabilities(evm(UNCHECKED)).filter((finding) => finding.detector === "evm-unchecked-low-level-call");
  assert.equal(hits.length, 3);
  assert.deepEqual(hits.map((hit) => hit.evidence[0]?.startLine).sort((a, b) => (a ?? 0) - (b ?? 0)), [5, 8, 11]);
});

test("unchecked low-level call: checked, returned, assigned and ERC777 send are clean", () => {
  assert.equal(detectors(CHECKED).includes("evm-unchecked-low-level-call"), false);
});
