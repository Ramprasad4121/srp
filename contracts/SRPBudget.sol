// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SRPBudget
 * @notice x402-compatible budget lock and settlement contract.
 */
contract SRPBudget {
    struct BudgetLock {
        bytes32 intentId;
        address payer;
        uint256 amountWei;
        bool settled;
    }

    mapping(bytes32 => BudgetLock) public locks;
    mapping(bytes32 => uint256) public refundableWei;

    address public owner;

    event BudgetLocked(bytes32 indexed intentId, address indexed payer, uint256 amountWei);
    event BudgetSettled(bytes32 indexed intentId, uint256 actualCostWei, address indexed settledBy);
    event BudgetRefunded(bytes32 indexed intentId, address indexed payer, uint256 amountWei);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function lockBudget(bytes32 intentId) external payable {
        require(intentId != bytes32(0), "invalid intentId");
        require(msg.value > 0, "amount must be > 0");

        BudgetLock storage existing = locks[intentId];
        require(existing.payer == address(0), "intent already locked");

        locks[intentId] = BudgetLock({
            intentId: intentId,
            payer: msg.sender,
            amountWei: msg.value,
            settled: false
        });

        emit BudgetLocked(intentId, msg.sender, msg.value);
    }

    function settleBudget(bytes32 intentId, uint256 actualCostWei) external onlyOwner {
        BudgetLock storage budgetLock = locks[intentId];

        require(budgetLock.payer != address(0), "budget not found");
        require(!budgetLock.settled, "already settled");
        require(actualCostWei <= budgetLock.amountWei, "actual cost exceeds locked amount");

        uint256 lockedAmount = budgetLock.amountWei;
        uint256 refundAmount = lockedAmount - actualCostWei;

        budgetLock.settled = true;
        budgetLock.amountWei = actualCostWei;

        if (refundAmount > 0) {
            refundableWei[intentId] = refundAmount;
        }

        if (actualCostWei > 0) {
            (bool sentCost, ) = payable(owner).call{value: actualCostWei}("");
            require(sentCost, "cost transfer failed");
        }

        emit BudgetSettled(intentId, actualCostWei, msg.sender);
    }

    function refund(bytes32 intentId) external {
        BudgetLock storage budgetLock = locks[intentId];

        require(budgetLock.payer != address(0), "budget not found");
        require(msg.sender == budgetLock.payer, "not payer");

        uint256 amountToRefund;

        if (!budgetLock.settled) {
            amountToRefund = budgetLock.amountWei;
            budgetLock.amountWei = 0;
            budgetLock.settled = true;
        } else {
            amountToRefund = refundableWei[intentId];
            refundableWei[intentId] = 0;
        }

        require(amountToRefund > 0, "nothing to refund");

        (bool refunded, ) = payable(msg.sender).call{value: amountToRefund}("");
        require(refunded, "refund transfer failed");

        emit BudgetRefunded(intentId, msg.sender, amountToRefund);
    }
}
