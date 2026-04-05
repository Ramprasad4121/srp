---
name: discovery-onchain
description: Research into on-chain deployments, Etherscan records, and local deployment artifacts. Use this skill to verify deployed contract addresses, constructor arguments, and initial administrative roles.
---

# Discovery: On-Chain

This skill enables the agent to bridge the gap between "Written Intent" and "Actual Deployment."

## Objective
To find the live protocol addresses and identify the initial state (owners, roles, parameters) as it exists on the blockchain.

## Workflow

1.  **Local Artifact Search**: Use `[TOOL: LIST_FILES]` and `[TOOL: READ_FILE]` to look for:
    *   `broadcast/` (Foundry deployment logs).
    *   `deployments/` (Hardhat-deploy logs).
    *   `scripts/` (Deployment scripts containing hardcoded addresses).

2.  **External Search Strategy**:
    *   `[Protocol Name] mainnet contract addresses`
    *   `site:etherscan.io "[Protocol Name]" creation tx`
    *   `[Protocol Name] proxy admin address`

3.  **Analysis**:
    *   **Constructor Args**: What parameters were set during deployment? Are they the same as in the docs?
    *   **Initial Roles**: Who is the `DEFAULT_ADMIN_ROLE` or `owner`? Is it a multisig?
    *   **Proxy Logic**: Is the contract a proxy? If so, what is the implementation address?

4.  **Verification**:
    *   Compare the **Bytecode**: Does the deployed bytecode match what's in the local `out/` folder?
    *   Verify **Initial Salts**: If using `CREATE2`, what were the deployment salts?

5.  **Artifact Generation**:
    *   Output: JSON `{ "title": "On-Chain Deployment Analysis", "summary": "...", "mainnetAddresses": { "Contract": "0x..." }, "relevance": "High" }`

## Best Practices
*   **Check Verified Source**: Always prioritize contracts with verified source code on Etherscan.
*   **Search for Factory Events**: If individual contract addresses are missing, search for the protocol's "Factory" contract and look for `ContractCreated` events.
