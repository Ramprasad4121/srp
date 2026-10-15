import test from "node:test";
import assert from "node:assert/strict";
import { discoverVulnerabilities, inputErrors, runAudit } from "../src/index.ts";
import type { ProtocolInput } from "../src/types.ts";

function evm(content: string, extra: Partial<ProtocolInput> = {}): ProtocolInput {
  return { name: "Fixture", chain: "ethereum", documents: [], sources: [{ path: "Fixture.sol", language: "solidity", content }], ...extra };
}
const ids = (content: string) => discoverVulnerabilities(evm(content)).map((finding) => finding.detector);

const ETHER_STORE = `contract EtherStore {
    mapping(address => uint256) public balances;
    function deposit() public payable { balances[msg.sender] += msg.value; }
    function withdraw() public {
        uint256 bal = balances[msg.sender];
        require(bal > 0);
        (bool sent, ) = msg.sender.call{value: bal}("");
        require(sent, "Failed to send Ether");
        balances[msg.sender] = 0;
    }
}`;

const SAFE_STORE = `contract SafeStore {
    mapping(address => uint256) public balances;
    function withdraw() public {
        uint256 bal = balances[msg.sender];
        balances[msg.sender] = 0;
        (bool sent, ) = msg.sender.call{value: bal}("");
        require(sent);
    }
}`;

test("reentrancy: EtherStore (write after call) is flagged with call line and write line", () => {
  const hit = discoverVulnerabilities(evm(ETHER_STORE)).find((finding) => finding.detector === "evm-reentrancy-external-call");
  assert.ok(hit);
  assert.deepEqual(hit.evidence.map((item) => item.startLine), [7, 9]);
  assert.equal(hit.context?.function, "withdraw");
  assert.ok(hit.context?.facts.some((fact) => /balances is written at L9/.test(fact)));
});

test("reentrancy: checks-effects-interactions ordering is not flagged (false positive fix)", () => {
  assert.ok(!ids(SAFE_STORE).includes("evm-reentrancy-external-call"));
});

test("reentrancy: an internal helper is reported with lower confidence than a public entrypoint", () => {
  const internal = ETHER_STORE.replace("function withdraw() public", "function _withdraw() internal");
  const pub = discoverVulnerabilities(evm(ETHER_STORE)).find((finding) => finding.detector === "evm-reentrancy-external-call");
  const priv = discoverVulnerabilities(evm(internal)).find((finding) => finding.detector === "evm-reentrancy-external-call");
  assert.ok(pub && priv);
  assert.ok(priv.confidence < pub.confidence);
});

test("comments neither trigger nor silence rules", () => {
  const replay = `contract Minter {
    address signer;
    // TODO: add a nonce
    function mint(address to, uint256 amount, uint8 v, bytes32 r, bytes32 s) external {
      require(ecrecover(keccak256(abi.encodePacked(to, amount)), v, r, s) == signer);
    }
  }`;
  assert.ok(ids(replay).includes("evm-signature-replay"), "a word in a comment must not suppress the rule");
  const commented = `contract A { /* (bool ok,) = msg.sender.call(""); */ uint256 x; function f() external { x = 1; } }`;
  assert.ok(!ids(commented).includes("evm-reentrancy-external-call"));
});

test("missing access control: Fallout-style public owner setter is flagged", () => {
  const src = `contract Fallout {
    address payable public owner;
    function Fal1out() public payable {
      owner = payable(msg.sender);
    }
  }`;
  const hit = discoverVulnerabilities(evm(src)).find((finding) => finding.detector === "evm-missing-access-control");
  assert.ok(hit);
  assert.equal(hit.evidence[1]?.startLine, 4);
});

test("missing access control: guarded setters and initializer-protected init are not flagged", () => {
  const src = `contract Config {
    address public owner;
    address public treasury;
    function setTreasury(address t) external onlyOwner { treasury = t; }
    function setOwner(address o) external { require(msg.sender == owner, "no"); owner = o; }
    function initialize(address o) external initializer { owner = o; }
  }`;
  assert.ok(!ids(src).includes("evm-missing-access-control"));
});

test("old presence-based access-control rule no longer fires on code that has guards", () => {
  const src = `contract Ownable { address owner; modifier onlyOwner() { require(msg.sender == owner); _; } function pause() external onlyOwner {} }`;
  assert.ok(!ids(src).includes("access-control"));
});

test("arbitrary delegatecall to a parameter is critical; delegatecall to stored implementation is not flagged", () => {
  const bad = `contract Proxyish { function exec(address target, bytes calldata data) external { (bool ok,) = target.delegatecall(data); require(ok); } }`;
  const good = `contract Proxy { address implementation; fallback() external payable { (bool ok,) = implementation.delegatecall(msg.data); require(ok); } }`;
  const hit = discoverVulnerabilities(evm(bad)).find((finding) => finding.detector === "evm-arbitrary-delegatecall");
  assert.equal(hit?.proposedSeverity, "critical");
  assert.ok(!ids(good).includes("evm-arbitrary-delegatecall"));
  assert.ok(!ids(good).includes("evm-upgrade-admin"), "the word implementation alone must not fire anything");
});

test("UUPS: unprotected _authorizeUpgrade is flagged, onlyOwner version is not", () => {
  const bad = `contract V is UUPSUpgradeable { function _authorizeUpgrade(address) internal override {} }`;
  const good = `contract V is UUPSUpgradeable { function _authorizeUpgrade(address) internal override onlyOwner {} }`;
  assert.ok(ids(bad).includes("evm-unprotected-upgrade"));
  assert.ok(!ids(good).includes("evm-unprotected-upgrade"));
});

test("AMM spot price: getReserves is flagged, TWAP is not, the word price alone is not", () => {
  const spot = `contract Lend { function price() public view returns (uint256) { (uint112 a, uint112 b,) = pair.getReserves(); return uint256(a) * 1e18 / b; } }`;
  const twap = `contract Lend { function price() public view returns (uint256) { (uint112 a,,) = pair.getReserves(); return OracleLibrary.consult(pool, 1800); } }`;
  const plain = `contract Shop { uint256 public price; function getPrice() external view returns (uint256) { return price; } }`;
  assert.ok(ids(spot).includes("evm-oracle-manipulation"));
  assert.ok(!ids(twap).includes("evm-oracle-manipulation"));
  assert.ok(!ids(plain).includes("evm-oracle-manipulation"));
});

test("evidence records carry provenance and deterministic ids", () => {
  const a = discoverVulnerabilities(evm(ETHER_STORE))[0];
  const b = discoverVulnerabilities(evm(ETHER_STORE))[0];
  assert.ok(a?.evidence[0]?.evidenceId?.startsWith("ev_"));
  assert.equal(a?.evidence[0]?.evidenceId, b?.evidence[0]?.evidenceId);
  assert.equal(a?.evidence[0]?.provider, "srp-structural");
  assert.equal(a?.evidence[0]?.kind, "observed");
  assert.equal(a?.evidence[1]?.kind, "derived");
});

test("proof step: only an attached passing test makes a finding proven and restores its severity", () => {
  const first = runAudit(evm(ETHER_STORE));
  const finding = first.findings.find((item) => item.detector === "evm-reentrancy-external-call");
  assert.ok(finding);
  assert.equal(finding.severity, "medium");
  const proof = { findingId: finding.id, command: "forge test --match-test test_reenter_withdraw", passed: true, assertion: "attacker drained 10 ETH with a 1 ETH deposit" };
  const proven = runAudit(evm(ETHER_STORE, { proofs: [proof] })).findings.find((item) => item.id === finding.id);
  assert.equal(proven?.status, "proven");
  assert.equal(proven?.severity, "high");
  const failed = runAudit(evm(ETHER_STORE, { proofs: [{ ...proof, passed: false }] })).findings.find((item) => item.id === finding.id);
  assert.equal(failed?.status, "failed");
});

test("weak static evidence is 'unverified', never 'failed' (failed means an attached run did not pass)", () => {
  const report = runAudit(evm(`contract W { address owner; function sweep() external { require(tx.origin == owner); } }`));
  const hit = report.findings.find((item) => item.detector === "evm-tx-origin-auth");
  assert.equal(hit?.status, "unverified");
  assert.equal(report.pocResults.find((item) => item.findingId === hit?.id)?.executed, false);
});

test("debate arguments cite real lines and facts, and an unproven claim is inconclusive, not disproven", () => {
  const report = runAudit(evm(ETHER_STORE));
  const finding = report.findings.find((item) => item.detector === "evm-reentrancy-external-call");
  const debate = report.debates.find((item) => item.findingId === finding?.id);
  assert.ok(debate?.rounds.some((round) => /L9/.test(round.attacker) && /L7/.test(round.attacker)));
  assert.ok(report.debates.every((item) => item.decision !== "exploit_disproven"));
});

test("report has a schema version for agents and tools", () => {
  assert.equal(runAudit(evm(ETHER_STORE)).schemaVersion, "srp.audit/v1");
});

test("coverage: files no analyzer handles become residual unknowns, and assembly is called out", () => {
  const report = runAudit({
    name: "Mixed",
    chain: "ethereum",
    documents: [],
    sources: [
      { path: "A.sol", language: "solidity", content: "contract A { function f() external { assembly { sstore(0, 1) } } }" },
      { path: "move/b.move", language: "move", content: "module b {}" }
    ]
  });
  assert.equal(report.coverage.files, 2);
  assert.equal(report.coverage.analyzedFiles, 1);
  assert.equal(report.coverage.ratio, 0.5);
  assert.ok(report.unknowns.some((unknown) => unknown.file === "move/b.move"));
  assert.ok(report.unknowns.some((unknown) => /assembly/i.test(unknown.reason)));
});

test("inputErrors lists every problem instead of crashing", () => {
  assert.deepEqual(inputErrors(null), ["Body must be a JSON object"]);
  const errors = inputErrors({ name: "x", chain: "bogus" });
  assert.ok(errors.some((error) => /chain must be one of/.test(error)));
  assert.ok(errors.some((error) => /sources must be an array/.test(error)));
  assert.throws(() => runAudit({ name: "x" } as unknown as ProtocolInput), /sources must be an array/);
});

test("arbitrary external call (Truster): caller-chosen target and calldata is critical", () => {
  const src = `contract TrusterLenderPool {
    function flashLoan(uint256 amount, address borrower, address target, bytes calldata data) external returns (bool) {
        token.transfer(borrower, amount);
        target.functionCall(data);
        return true;
    }
  }`;
  const hit = discoverVulnerabilities(evm(src)).find((finding) => finding.detector === "evm-arbitrary-external-call");
  assert.equal(hit?.evidence[0]?.startLine, 4);
  assert.ok(!ids(src.replace("external returns", "external onlyOwner returns")).includes("evm-arbitrary-external-call"));
  // The real Truster has nonReentrant; a reentrancy lock does not restrict who can call.
  assert.ok(ids(src.replace("external returns", "external nonReentrant returns")).includes("evm-arbitrary-external-call"));
});

test("signature verification inside a view helper or library is not flagged as replayable", () => {
  const lib = `library ECDSA { function recover(bytes32 h, uint8 v, bytes32 r, bytes32 s) internal pure returns (address) { return ecrecover(h, v, r, s); } }`;
  const view = `contract W { address owner; function isValidSignature(bytes32 h, bytes memory sig) external view returns (bytes4) { return ECDSA.recover(h, sig) == owner ? bytes4(0x1626ba7e) : bytes4(0); } }`;
  assert.ok(!ids(lib).includes("evm-signature-replay"));
  assert.ok(!ids(view).includes("evm-signature-replay"));
});

test("set-then-restore around a call (execution-id / lock pattern) is not reentrancy", () => {
  const src = `contract Manager {
    bytes32 private _executionId;
    function execute(address target, bytes calldata data) external {
      require(msg.sender == admin);
      bytes32 before = _executionId;
      _executionId = keccak256(data);
      Address.functionCallWithValue(target, data, msg.value);
      _executionId = before;
    }
  }`;
  assert.ok(!ids(src).includes("evm-reentrancy-external-call"));
});

test("_msgSender() checks count as caller checks, and overrides deferring to super are not flagged", () => {
  const a = `contract A { address public owner; function setOwner(address o) external { if (_msgSender() != owner) revert(); owner = o; } }`;
  const b = `contract B is AccessControl { address public admin; function renounceRole(bytes32 r, address a) public override { admin = address(0); super.renounceRole(r, a); } }`;
  assert.ok(!ids(a).includes("evm-missing-access-control"));
  assert.ok(!ids(b).includes("evm-missing-access-control"));
});
