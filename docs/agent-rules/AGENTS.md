## Web3 security (SRP)

When you write or change Solidity (`.sol`) or Anchor (`.rs`) code, check it with SRP before you say it is done.

1. After editing a contract or program, call the MCP tool `srp_scan_path` on the project (or `srp_scan_source` on code you have not saved yet). If MCP is not available, run `node /path/to/srp/apps/cli/src/cli.ts scan . --format summary`.
2. Fix every `high` or `critical` finding, or explain in the reply why it is a false positive and cite the lines. Do not silence a finding with a comment to make the scan pass.
3. Call `srp_coverage` and mention the residual unknowns. A clean scan is not a proof of safety.
4. Only call a finding proven after you ran a test that shows it and attached it with `srp_attach_proof`. Never run exploits against live chains.
5. Do not use SRP output to claim a contract is audited.
