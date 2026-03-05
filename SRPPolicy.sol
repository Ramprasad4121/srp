// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SRPPolicy
 * @notice ERC-8004 style agent policy registry and intent approval checks.
 */
contract SRPPolicy {
    struct AgentPolicy {
        uint256 agentId;
        address owner;
        uint256 maxBudgetUSD;
        string[] allowedSkills;
        bool active;
    }

    mapping(uint256 => AgentPolicy) public policies;

    event AgentRegistered(
        uint256 indexed agentId,
        address indexed owner,
        uint256 maxBudgetUSD,
        string[] skills
    );

    event IntentApproved(
        uint256 indexed agentId,
        address indexed requester,
        uint256 budgetUSD,
        string skill
    );

    event IntentRejected(
        uint256 indexed agentId,
        address indexed requester,
        uint256 budgetUSD,
        string skill,
        string reason
    );

    event AgentDeactivated(uint256 indexed agentId, address indexed owner);

    function registerAgent(
        uint256 agentId,
        uint256 maxBudgetUSD,
        string[] calldata skills
    ) external {
        require(agentId != 0, "invalid agentId");

        AgentPolicy storage policy = policies[agentId];
        if (policy.owner != address(0)) {
            require(policy.owner == msg.sender, "not policy owner");
        }

        policy.agentId = agentId;
        policy.owner = msg.sender;
        policy.maxBudgetUSD = maxBudgetUSD;
        policy.active = true;

        delete policy.allowedSkills;
        for (uint256 i = 0; i < skills.length; i++) {
            policy.allowedSkills.push(skills[i]);
        }

        emit AgentRegistered(agentId, msg.sender, maxBudgetUSD, skills);
    }

    function approveIntent(
        uint256 agentId,
        uint256 budgetUSD,
        string calldata skill
    ) external view returns (bool) {
        AgentPolicy storage policy = policies[agentId];

        if (!policy.active) {
            return false;
        }

        if (budgetUSD > policy.maxBudgetUSD) {
            return false;
        }

        return _isSkillAllowed(policy, skill);
    }

    /**
     * @notice Non-view helper that emits approval/rejection events.
     * @dev Keeps approveIntent() as a strict view method while still producing event logs.
     */
    function approveIntentWithEvent(
        uint256 agentId,
        uint256 budgetUSD,
        string calldata skill
    ) external returns (bool) {
        AgentPolicy storage policy = policies[agentId];

        if (!policy.active) {
            emit IntentRejected(agentId, msg.sender, budgetUSD, skill, "agent inactive");
            return false;
        }

        if (budgetUSD > policy.maxBudgetUSD) {
            emit IntentRejected(agentId, msg.sender, budgetUSD, skill, "budget exceeds max");
            return false;
        }

        if (!_isSkillAllowed(policy, skill)) {
            emit IntentRejected(agentId, msg.sender, budgetUSD, skill, "skill not allowed");
            return false;
        }

        emit IntentApproved(agentId, msg.sender, budgetUSD, skill);
        return true;
    }

    function deactivateAgent(uint256 agentId) external {
        AgentPolicy storage policy = policies[agentId];
        require(policy.owner != address(0), "agent not registered");
        require(policy.owner == msg.sender, "not policy owner");

        policy.active = false;
        emit AgentDeactivated(agentId, msg.sender);
    }

    function getAllowedSkills(uint256 agentId) external view returns (string[] memory) {
        return policies[agentId].allowedSkills;
    }

    function _isSkillAllowed(
        AgentPolicy storage policy,
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
