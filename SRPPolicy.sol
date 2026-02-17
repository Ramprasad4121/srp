// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SRPPolicy
 * @author Ramprasad
 * @notice ERC-8004 compatible policy contract for Security Reasoning Protocol
 * @dev Every SRP execution intent must be approved by this contract before running.
 *      No approval = no execution. This is enforced at the protocol level.
 *
 * ERC-8004 Integration:
 * - Uses ERC-721 based Identity Registry for agent identification
 * - Approvals are logic-based, not just signature-based
 * - Records execution completions for Reputation Registry
 *
 * Deployment: Base Sepolia (testnet) → Base Mainnet (production)
 */

interface IERC8004IdentityRegistry {
    function ownerOf(uint256 agentId) external view returns (address);
    function tokenURI(uint256 agentId) external view returns (string memory);
}

interface IERC8004ReputationRegistry {
    function submitFeedback(
        address client,
        address server,
        string calldata feedbackURI
    ) external;
}

contract SRPPolicy {

    // ─── Structs ──────────────────────────────────────────────────────────────

    struct Policy {
        string[] allowedSkills;
        uint8 maxReasoningDepth;
        uint256 maxBudgetUSDC;      // in 6 decimals (USDC precision)
        bool exploitSimAllowed;
        bool humanInLoopRequired;
        bool active;
    }

    struct ExecutionRecord {
        bytes32 intentHash;
        bytes32 outputHash;
        uint256 timestamp;
        bool approved;
        bool executed;
    }

    // ─── Storage ──────────────────────────────────────────────────────────────

    IERC8004IdentityRegistry public identityRegistry;
    IERC8004ReputationRegistry public reputationRegistry;

    mapping(uint256 => Policy) public agentPolicies;
    mapping(bytes32 => ExecutionRecord) public executions;
    mapping(bytes32 => bool) public approvedIntents;

    address public owner;
    uint256 public totalExecutions;

    // ─── Events ───────────────────────────────────────────────────────────────

    event IntentApproved(
        bytes32 indexed intentHash,
        uint256 indexed agentId,
        uint256 budgetUSDC,
        uint8 depth
    );

    event IntentRejected(
        bytes32 indexed intentHash,
        uint256 indexed agentId,
        string reason
    );

    event ExecutionRecorded(
        bytes32 indexed intentHash,
        bytes32 indexed outputHash,
        uint256 agentId
    );

    event PolicySet(uint256 indexed agentId, address setBy);

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _identityRegistry) {
        identityRegistry = IERC8004IdentityRegistry(_identityRegistry);
        owner = msg.sender;
    }

    // ─── Core Functions ───────────────────────────────────────────────────────

    /**
     * @notice Approve an execution intent against agent policy
     * @dev Called by SRP CLI before execution begins
     *
     * Checks:
     * 1. Agent has an active policy
     * 2. Budget is within policy limits
     * 3. Reasoning depth is within policy limits
     * 4. All requested skills are in the allowlist
     * 5. Exploit simulation is permitted (if requested)
     *
     * @param agentId ERC-8004 agent identity token ID
     * @param intentHash SHA-256 hash of the execution intent
     * @param requestedSkills Array of skill names requested
     * @param depth Reasoning depth (1-5)
     * @param budgetUSDC Budget in USDC (6 decimals)
     * @param requestsExploitSim Whether exploit simulation is requested
     */
    function approveIntent(
        uint256 agentId,
        bytes32 intentHash,
        string[] calldata requestedSkills,
        uint8 depth,
        uint256 budgetUSDC,
        bool requestsExploitSim
    ) external returns (bool approved) {
        Policy storage policy = agentPolicies[agentId];

        // ── Policy must exist and be active ──────────────────────────────────
        if (!policy.active) {
            emit IntentRejected(intentHash, agentId, "No active policy for agent");
            return false;
        }

        // ── Budget check ──────────────────────────────────────────────────────
        if (budgetUSDC > policy.maxBudgetUSDC) {
            emit IntentRejected(intentHash, agentId, "Budget exceeds policy limit");
            return false;
        }

        // ── Depth check ───────────────────────────────────────────────────────
        if (depth > policy.maxReasoningDepth) {
            emit IntentRejected(intentHash, agentId, "Depth exceeds policy limit");
            return false;
        }

        // ── Exploit simulation check ──────────────────────────────────────────
        if (requestsExploitSim && !policy.exploitSimAllowed) {
            emit IntentRejected(intentHash, agentId, "Exploit simulation not permitted");
            return false;
        }

        // ── Skill allowlist check ─────────────────────────────────────────────
        for (uint256 i = 0; i < requestedSkills.length; i++) {
            if (!_isSkillAllowed(policy, requestedSkills[i])) {
                emit IntentRejected(intentHash, agentId, "Skill not in allowlist");
                return false;
            }
        }

        // ── Approve ───────────────────────────────────────────────────────────
        approvedIntents[intentHash] = true;
        executions[intentHash] = ExecutionRecord({
            intentHash: intentHash,
            outputHash: bytes32(0),
            timestamp: block.timestamp,
            approved: true,
            executed: false
        });

        emit IntentApproved(intentHash, agentId, budgetUSDC, depth);
        return true;
    }

    /**
     * @notice Record a completed execution (for ERC-8004 Reputation Registry)
     * @dev Called by SRP after execution completes and output hash is known
     */
    function recordExecution(
        uint256 agentId,
        bytes32 intentHash,
        bytes32 outputHash
    ) external {
        require(approvedIntents[intentHash], "Intent was not approved");
        require(!executions[intentHash].executed, "Already executed");

        executions[intentHash].outputHash = outputHash;
        executions[intentHash].executed = true;
        totalExecutions++;

        emit ExecutionRecorded(intentHash, outputHash, agentId);
    }

    /**
     * @notice Set policy for an agent (only agent owner can set their own policy)
     * @dev Uses ERC-8004 Identity Registry to verify ownership
     */
    function setPolicy(
        uint256 agentId,
        string[] calldata allowedSkills,
        uint8 maxDepth,
        uint256 maxBudgetUSDC,
        bool exploitSimAllowed,
        bool humanInLoopRequired
    ) external {
        // Verify caller owns this agent in the ERC-8004 registry
        address agentOwner = identityRegistry.ownerOf(agentId);
        require(msg.sender == agentOwner, "Not agent owner");

        agentPolicies[agentId] = Policy({
            allowedSkills: allowedSkills,
            maxReasoningDepth: maxDepth,
            maxBudgetUSDC: maxBudgetUSDC,
            exploitSimAllowed: exploitSimAllowed,
            humanInLoopRequired: humanInLoopRequired,
            active: true
        });

        emit PolicySet(agentId, msg.sender);
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    function isIntentApproved(bytes32 intentHash) external view returns (bool) {
        return approvedIntents[intentHash];
    }

    function isIntentExecuted(bytes32 intentHash) external view returns (bool) {
        return executions[intentHash].executed;
    }

    function getExecution(bytes32 intentHash) external view returns (ExecutionRecord memory) {
        return executions[intentHash];
    }

    function getPolicy(uint256 agentId) external view returns (
        uint8 maxDepth,
        uint256 maxBudget,
        bool exploitSim,
        bool active
    ) {
        Policy storage p = agentPolicies[agentId];
        return (p.maxReasoningDepth, p.maxBudgetUSDC, p.exploitSimAllowed, p.active);
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _isSkillAllowed(
        Policy storage policy,
        string calldata skill
    ) internal view returns (bool) {
        bytes32 skillHash = keccak256(bytes(skill));
        for (uint256 i = 0; i < policy.allowedSkills.length; i++) {
            if (keccak256(bytes(policy.allowedSkills[i])) == skillHash) {
                return true;
            }
        }
        return false;
    }
}
