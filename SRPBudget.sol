// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SRPBudget
 * @author Ramprasad
 * @notice x402-compatible budget locking and settlement for SRP executions
 * @dev Implements the x402 V2 pay-per-compute model for security reasoning.
 *
 * x402 V2 Integration:
 * - Budget locked BEFORE execution (no execution without payment)
 * - Pay-per-compute: charged per reasoning pass
 * - Automatic refund of unused budget
 * - Supports USDC on Base (primary) and Solana
 *
 * Flow:
 * 1. lockBudget(intentHash, amount)     → Locks USDC before execution
 * 2. chargePasses(intentHash, passes)   → Charges for compute used
 * 3. settleBudget(intentHash)           → Pays executor, refunds remainder
 */

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract SRPBudget {

    // ─── Structs ──────────────────────────────────────────────────────────────

    struct Budget {
        address payer;
        address executor;
        uint256 amountLocked;       // Total locked (6 decimals)
        uint256 amountCharged;      // Amount charged so far
        uint256 lockedAt;
        uint256 settledAt;
        bytes32 intentHash;
        BudgetStatus status;
    }

    enum BudgetStatus { Empty, Locked, Settled, Refunded }

    // ─── State ────────────────────────────────────────────────────────────────

    IERC20 public usdc;
    address public owner;
    address public srpPolicy;

    // Cost per reasoning pass (in USDC, 6 decimals)
    uint256 public costPerPass = 100_000; // $0.10 per pass

    mapping(bytes32 => Budget) public budgets;
    uint256 public totalSettled;

    // ─── Events ───────────────────────────────────────────────────────────────

    event BudgetLocked(
        bytes32 indexed intentHash,
        address indexed payer,
        uint256 amount
    );

    event PassCharged(
        bytes32 indexed intentHash,
        uint256 passNumber,
        uint256 cost,
        uint256 remaining
    );

    event BudgetSettled(
        bytes32 indexed intentHash,
        address indexed executor,
        uint256 paid,
        uint256 refunded
    );

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
        owner = msg.sender;
    }

    // ─── x402 Budget Flow ─────────────────────────────────────────────────────

    /**
     * @notice Step 1: Lock budget BEFORE execution starts
     * @dev Called by SRP CLI after ERC-8004 policy approval
     *      No lock = no execution (enforced in CLI)
     *
     * @param intentHash The SHA-256 hash of the approved ExecutionIntent
     * @param amount USDC amount to lock (6 decimals)
     * @param executor Address that will receive payment after execution
     */
    function lockBudget(
        bytes32 intentHash,
        uint256 amount,
        address executor
    ) external {
        require(budgets[intentHash].status == BudgetStatus.Empty, "Budget already exists");
        require(amount > 0, "Amount must be positive");
        require(executor != address(0), "Invalid executor");

        // Transfer USDC from payer to this contract
        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        require(success, "USDC transfer failed");

        budgets[intentHash] = Budget({
            payer: msg.sender,
            executor: executor,
            amountLocked: amount,
            amountCharged: 0,
            lockedAt: block.timestamp,
            settledAt: 0,
            intentHash: intentHash,
            status: BudgetStatus.Locked
        });

        emit BudgetLocked(intentHash, msg.sender, amount);
    }

    /**
     * @notice Step 2: Charge for compute used (called per reasoning pass)
     * @dev Tracks running cost against locked budget
     *      Reverts if budget would be exceeded → halts execution
     *
     * @param intentHash The execution intent hash
     * @param passNumber Which reasoning pass (1-5)
     */
    function chargePass(
        bytes32 intentHash,
        uint256 passNumber
    ) external {
        Budget storage budget = budgets[intentHash];
        require(budget.status == BudgetStatus.Locked, "Budget not locked");

        uint256 cost = costPerPass;
        uint256 newTotal = budget.amountCharged + cost;

        require(
            newTotal <= budget.amountLocked,
            "Budget exhausted: execution halted"
        );

        budget.amountCharged = newTotal;
        uint256 remaining = budget.amountLocked - newTotal;

        emit PassCharged(intentHash, passNumber, cost, remaining);
    }

    /**
     * @notice Step 3: Settle budget after execution completes
     * @dev Pays executor for compute used, refunds remainder to payer
     *
     * @param intentHash The execution intent hash
     */
    function settleBudget(bytes32 intentHash) external {
        Budget storage budget = budgets[intentHash];
        require(budget.status == BudgetStatus.Locked, "Budget not locked");

        uint256 payExecutor = budget.amountCharged;
        uint256 refundPayer = budget.amountLocked - payExecutor;

        budget.status = BudgetStatus.Settled;
        budget.settledAt = block.timestamp;
        totalSettled += payExecutor;

        // Pay executor for compute provided
        if (payExecutor > 0) {
            usdc.transfer(budget.executor, payExecutor);
        }

        // Refund unused budget to payer
        if (refundPayer > 0) {
            usdc.transfer(budget.payer, refundPayer);
        }

        emit BudgetSettled(intentHash, budget.executor, payExecutor, refundPayer);
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    function getBudget(bytes32 intentHash) external view returns (Budget memory) {
        return budgets[intentHash];
    }

    function isLocked(bytes32 intentHash) external view returns (bool) {
        return budgets[intentHash].status == BudgetStatus.Locked;
    }

    function remainingBudget(bytes32 intentHash) external view returns (uint256) {
        Budget storage b = budgets[intentHash];
        if (b.status != BudgetStatus.Locked) return 0;
        return b.amountLocked - b.amountCharged;
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setCostPerPass(uint256 _cost) external {
        require(msg.sender == owner, "Not owner");
        costPerPass = _cost;
    }

    function setSRPPolicy(address _policy) external {
        require(msg.sender == owner, "Not owner");
        srpPolicy = _policy;
    }
}
