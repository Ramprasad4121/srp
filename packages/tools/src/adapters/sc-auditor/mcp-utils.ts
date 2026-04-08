import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Wrap a value as a JSON text CallToolResult.
 * Ported from sc-auditor/src/mcp/server.ts.
 */
export function jsonResult(data: unknown): CallToolResult {
  const text = data === undefined ? "null" : JSON.stringify(data, null, 2);
  return { content: [{ type: "text" as const, text }] };
}
