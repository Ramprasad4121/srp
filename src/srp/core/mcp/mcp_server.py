from __future__ import annotations
import json
import sys
import asyncio
from typing import Any, Dict, Callable

# Global registry for tools
registry: Dict[str, Any] = {}

class SRPMCPServer:
    """Direct MCP Server bridge for Python-to-TypeScript communication."""
    def __init__(self):
        self.tools: Dict[str, Callable] = registry

    def register_tool(self, name: str, func: Callable):
        registry[name] = func

    async def start(self):
        """Starts the MCP server listening on stdin."""
        print("[SRP] [MCP] Server started, listening on stdin...", file=sys.stderr)
        while True:
            line = await asyncio.get_event_loop().run_in_executor(None, sys.stdin.readline)
            if not line:
                break
            try:
                request = json.loads(line)
                response = await self.handle_request(request)
                print(json.dumps(response), flush=True)
            except Exception as e:
                print(json.dumps({"error": str(e)}), flush=True, file=sys.stderr)

    async def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        method = request.get("method")
        params = request.get("params", {})
        request_id = request.get("id")

        if method in self.tools:
            try:
                # If tool has execute method (wrapped), use it, otherwise call directly
                tool = self.tools[method]
                if hasattr(tool, 'execute'):
                    result = await tool.execute(params)
                else:
                    result = await tool(**params)
                return {"id": request_id, "result": result}
            except Exception as e:
                return {"id": request_id, "error": str(e)}
        else:
            return {"id": request_id, "error": f"Method {method} not found"}

app = SRPMCPServer()
