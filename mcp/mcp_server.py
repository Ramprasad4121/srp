"""
MCP Server — Phase 1 (Upgraded)

FastAPI-based Model Context Protocol server with timing, enriched
response metadata, and structured error handling.

Run standalone:  python -m mcp.mcp_server
"""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel


# ────────────────────────── Tool Abstraction ──────────────────────────────

@dataclass
class ToolSchema:
    type: str = "object"
    properties: dict = field(default_factory=dict)
    required: list[str] = field(default_factory=list)


class Tool(ABC):
    name: str
    description: str
    input_schema: ToolSchema

    @abstractmethod
    async def execute(self, params: dict) -> dict:
        ...


# ────────────────────────── Concrete Tools ────────────────────────────────

class ForkChainTool(Tool):
    name = "fork_chain"
    description = "Fork a live chain locally using Anvil for safe simulation."
    input_schema = ToolSchema(
        properties={
            "rpc_url": {"type": "string", "description": "RPC endpoint to fork from"},
            "block_number": {"type": "integer", "description": "Optional block number to fork at"},
            "port": {"type": "integer", "description": "Local port for Anvil (default: 8545)"},
        },
        required=["rpc_url"],
    )

    async def execute(self, params: dict) -> dict:
        rpc_url = params["rpc_url"]
        port = params.get("port", 8545)
        block = params.get("block_number")

        anvil_bin = os.environ.get("ANVIL_PATH", "anvil")
        cmd = [anvil_bin, "--fork-url", rpc_url, "--port", str(port)]
        if block:
            cmd.extend(["--fork-block-number", str(block)])

        try:
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            await asyncio.sleep(2)
            if proc.poll() is not None:
                stderr = proc.stderr.read().decode() if proc.stderr else ""
                return {"status": "error", "error": f"Anvil exited early: {stderr}"}
            return {
                "status": "success",
                "pid": proc.pid,
                "port": port,
                "rpc": f"http://127.0.0.1:{port}",
                "forked_from": rpc_url,
                "block_number": block,
            }
        except FileNotFoundError:
            return {"status": "error", "error": "Anvil binary not found. Install Foundry first."}


class SimulateTxTool(Tool):
    name = "simulate_tx"
    description = "Simulate a transaction against a local or forked RPC endpoint using eth_call."
    input_schema = ToolSchema(
        properties={
            "rpc_url": {"type": "string", "description": "RPC endpoint (default: http://127.0.0.1:8545)"},
            "from": {"type": "string", "description": "Sender address"},
            "to": {"type": "string", "description": "Target contract address"},
            "data": {"type": "string", "description": "Hex-encoded calldata"},
            "value": {"type": "string", "description": "Wei value (default 0x0)"},
        },
        required=["to", "data"],
    )

    async def execute(self, params: dict) -> dict:
        import httpx

        rpc = params.get("rpc_url", "http://127.0.0.1:8545")
        tx_obj = {
            "from": params.get("from", "0x" + "0" * 40),
            "to": params["to"],
            "data": params["data"],
            "value": params.get("value", "0x0"),
        }
        payload = {"jsonrpc": "2.0", "method": "eth_call", "params": [tx_obj, "latest"], "id": 1}

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(rpc, json=payload)
                result = resp.json()
            if "error" in result:
                return {"status": "error", "error": result["error"]}
            return {"status": "success", "result": result.get("result")}
        except Exception as e:
            return {"status": "error", "error": str(e)}


class TraceTransactionTool(Tool):
    name = "trace_transaction"
    description = "Fetch a debug trace for a transaction hash using debug_traceTransaction."
    input_schema = ToolSchema(
        properties={
            "rpc_url": {"type": "string", "description": "RPC endpoint (default: http://127.0.0.1:8545)"},
            "tx_hash": {"type": "string", "description": "Transaction hash to trace"},
        },
        required=["tx_hash"],
    )

    async def execute(self, params: dict) -> dict:
        import httpx

        rpc = params.get("rpc_url", "http://127.0.0.1:8545")
        payload = {
            "jsonrpc": "2.0",
            "method": "debug_traceTransaction",
            "params": [params["tx_hash"], {"tracer": "callTracer"}],
            "id": 1,
        }

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(rpc, json=payload)
                result = resp.json()
            if "error" in result:
                return {"status": "error", "error": result["error"]}
            return {"status": "success", "trace": result.get("result")}
        except Exception as e:
            return {"status": "error", "error": str(e)}


class EthGetBalanceTool(Tool):
    name = "eth_get_balance"
    description = "Get the ETH balance of an address (in wei) from an RPC endpoint."
    input_schema = ToolSchema(
        properties={
            "rpc_url": {"type": "string", "description": "RPC endpoint (default: http://127.0.0.1:8545)"},
            "address": {"type": "string", "description": "Address to check balance for"},
        },
        required=["address"],
    )

    async def execute(self, params: dict) -> dict:
        import httpx

        rpc = params.get("rpc_url", "http://127.0.0.1:8545")
        payload = {
            "jsonrpc": "2.0",
            "method": "eth_getBalance",
            "params": [params["address"], "latest"],
            "id": 1,
        }

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(rpc, json=payload)
                result = resp.json()
            if "error" in result:
                return {"status": "error", "error": result["error"]}
            
            balance_hex = result.get("result", "0x0")
            balance_int = int(balance_hex, 16)
            return {"status": "success", "result": {"balance": balance_int, "balance_hex": balance_hex}}
        except Exception as e:
            return {"status": "error", "error": str(e)}




# ────────────────────────── Tool Registry ─────────────────────────────────

class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        self._tools[tool.name] = tool

    def get(self, name: str) -> Tool | None:
        return self._tools.get(name)

    def list_tools(self) -> list[dict]:
        return [
            {
                "name": t.name,
                "description": t.description,
                "input_schema": {
                    "type": t.input_schema.type,
                    "properties": t.input_schema.properties,
                    "required": t.input_schema.required,
                },
            }
            for t in self._tools.values()
        ]


# ────────────────────────── FastAPI App ───────────────────────────────────

registry = ToolRegistry()
registry.register(ForkChainTool())
registry.register(SimulateTxTool())
registry.register(TraceTransactionTool())
registry.register(EthGetBalanceTool())


app = FastAPI(title="SRP MCP Server", version="1.1.0")


class ExecuteRequest(BaseModel):
    tool: str
    params: dict[str, Any] = {}


@app.get("/tools")
async def list_tools():
    return {"tools": registry.list_tools()}


@app.post("/execute")
async def execute_tool(req: ExecuteRequest):
    tool = registry.get(req.tool)
    if not tool:
        return {
            "status": "error",
            "tool": req.tool,
            "error": f"Tool '{req.tool}' not found",
            "execution_time": 0.0,
        }
    t0 = time.monotonic()
    try:
        result = await tool.execute(req.params)
        elapsed = round(time.monotonic() - t0, 4)
        return {
            "status": result.get("status", "success"),
            "tool": req.tool,
            "result": result,
            "execution_time": elapsed,
        }
    except Exception as e:
        elapsed = round(time.monotonic() - t0, 4)
        return {
            "status": "error",
            "tool": req.tool,
            "error": str(e),
            "execution_time": elapsed,
        }


# ────────────────────────── Standalone ────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("mcp.mcp_server:app", host="0.0.0.0", port=7338, reload=False, log_level="info")
