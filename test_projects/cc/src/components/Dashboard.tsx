import React, { useState } from 'react';
import { Box, Text, Newline } from 'ink';

export const Dashboard: React.FC = () => {
  const [activeFinding, setActiveFinding] = useState<string | null>(null);

  return (
    <Box flexDirection="column" width="100%">
      {/* Header */}
      <Box borderStyle="single" paddingX={1}>
        <Text color="green" bold>SRP — Security Reasoning Protocol</Text>
        <Box marginLeft={2}>
          <Text color="gray">Project: </Text>
          <Text color="white">UNISWAP-V3</Text>
        </Box>
      </Box>

      {/* Main Content */}
      <Box flexDirection="row" height={20}>
        {/* Mission Control */}
        <Box borderStyle="single" width="25%" flexDirection="column" paddingX={1}>
          <Text color="gray" bold underline>MISSION CONTROL</Text>
          <Text color="green">> Viper: Analyzing Pool.sol</Text>
          <Text color="green">> Ghost: Generating exploit</Text>
          <Text color="yellow">> Shield: Debating finding #R1</Text>
        </Box>

        {/* SRG Graph Canvas */}
        <Box borderStyle="single" width="50%" justifyContent="center" alignItems="center">
          <Box flexDirection="column" alignItems="center">
            <Text color="white" bold>Security Reasoning Graph (SRG)</Text>
            <Newline />
            <Text color="gray">[Pool.sol] ──▶ [R1: Reentrancy]</Text>
            <Text color="gray">   │ </Text>
            <Text color="gray">   ▼ </Text>
            <Text color="gray">[Vault.sol]</Text>
          </Box>
        </Box>

        {/* Deep Dive Panel */}
        <Box borderStyle="single" width="25%" flexDirection="column" paddingX={1}>
          <Text color="gray" bold underline>DEEP DIVE</Text>
          {activeFinding ? (
            <Box flexDirection="column">
              <Text color="red" bold>#R1: Reentrancy</Text>
              <Text color="gray">Status: PROVEN (Trace available)</Text>
            </Box>
          ) : (
            <Text color="gray">Select a finding to dive deep.</Text>
          )}
        </Box>
      </Box>

      {/* Footer / Status Bar */}
      <Box borderStyle="single" paddingX={1}>
        <Text color="gray">C0/H0/M1/L0 | SRG: 12 nodes | MCP: 13 agents | THEME: DARK</Text>
      </Box>
    </Box>
  );
};
