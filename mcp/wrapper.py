from mcp.mcp_server import registry

class MCPWrapper:
    """Wrapper to call MCP tools programmatically instead of via HTTP."""
    async def call(self, tool_name: str, params: dict) -> dict:
        tool = registry.get(tool_name)
        if not tool:
            return {"status": "error", "error": f"Tool '{tool_name}' not found in MCP registry"}
        return await tool.execute(params)
