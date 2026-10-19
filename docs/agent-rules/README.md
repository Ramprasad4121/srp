# Agent rules files

Drop one of these into a project so your coding agent runs SRP on the contracts it writes.

| Agent | Copy to |
| --- | --- |
| Claude Code | append `CLAUDE.md` to your project `CLAUDE.md` |
| Codex, and any agent that reads AGENTS.md | append `AGENTS.md` to your project `AGENTS.md` |
| Cursor | `srp.mdc` to `.cursor/rules/srp.mdc` |

Register the MCP server first (see [../mcp.md](../mcp.md)), for example `claude mcp add srp -- node /path/to/srp/apps/cli/src/cli.ts mcp`. The tool names used in these files are checked against the server by a test.
