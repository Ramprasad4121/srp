"""
core/v2/tools.py
Model Context Protocol (MCP) Style Tool Registry.
Enforces that agents interact with the environment through strictly defined schemas.
"""
from typing import Dict, Any, Type, Optional
import subprocess
import os
import json
import logging
from pathlib import Path

from srp.core.sandbox.docker_env import DockerSandbox

logger = logging.getLogger(__name__)

class BaseTool:
    name: str = "BaseTool"
    description: str = "Description of the tool"
    schema: Dict[str, Any] = {}
    
    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        
    async def invoke(self, kwargs: Dict[str, Any]) -> str:
        raise NotImplementedError
        

class FoundryTool(BaseTool):
    """
    Executes Foundry builds and test suites.
    Provides stdout trace if test fails, allowing agent to reflect on exact errors.
    """
    name = "foundry"
    description = "Compiles smart contracts and executes Foundry forge tests."
    schema = {
        "properties": {
            "action": {"type": "string", "enum": ["build", "test"]},
            "test_file": {"type": "string", "description": "Optional specific test file to run"}
        },
        "required": ["action"]
    }

    async def invoke(self, kwargs: Dict[str, Any]) -> str:
        action = kwargs.get("action", "build")
        test_file = kwargs.get("test_file", "")
        
        if action == "build":
            cmd = ["forge", "build"]
        elif action == "test":
            cmd = ["forge", "test"]
            if test_file:
                cmd.extend(["--match-path", test_file])
            cmd.extend(["-vvv"])  # Verbose trace for reflexion
        else:
            return "Error: Invalid action"

        logger.debug(f"[FoundryTool] Executing: {' '.join(cmd)}")
        try:
            returncode, stdout, stderr = DockerSandbox.run_command(
                cmd,
                project_root=str(self.project_root),
                image="ghcr.io/foundry-rs/foundry:latest",
                timeout=30 # Prevent hangs
            )
            
            output = stdout
            if returncode != 0:
                output += f"\nSTDERR:\n{stderr}"
                output += "\n[FoundryTool] Execution FAILED. Analyze the trace to fix errors."
            else:
                output += "\n[FoundryTool] Execution SUCCESS."
                
            # Truncate if too huge to avoid blowing context window
            if len(output) > 8000:
                output = output[-8000:]
                
            return output
            
        except subprocess.TimeoutExpired:
            return "Error: Foundry command timed out after 30 seconds."
        except Exception as e:
            return f"Error executing foundry: {str(e)}"


class SlitherTool(BaseTool):
    """
    Executes Slither static analysis and returns structured JSON output.
    """
    name = "slither"
    description = "Analyzes Solidity code using Slither to detect vulnerabilities."
    schema = {
        "properties": {
            "target": {"type": "string", "description": "Contract path to analyze"}
        },
        "required": ["target"]
    }

    async def invoke(self, kwargs: Dict[str, Any]) -> str:
        target = kwargs.get("target", ".")
        # Slither JSON output
        cmd = ["slither", target, "--json", "-"]
        try:
            returncode, stdout, stderr = DockerSandbox.run_command(
                cmd,
                project_root=str(self.project_root),
                image="trailofbits/eth-security-toolbox:nightly",  # Default image containing slither
                timeout=60
            )
            # Slither prints warnings to stderr even on success, and raw JSON to stdout.
            # Return code defines vulnerabilities found vs compilation errors.
            return stdout if stdout else stderr
        except subprocess.TimeoutExpired:
            return "Error: Slither timed out."
        except Exception as e:
            return f"Error executing slither: {str(e)}"
            

# Global Registry
TOOL_REGISTRY: Dict[str, Type[BaseTool]] = {
    "foundry": FoundryTool,
    "slither": SlitherTool
}

def get_tool(name: str, project_root: str) -> Optional[BaseTool]:
    if name in TOOL_REGISTRY:
        return TOOL_REGISTRY[name](project_root=project_root)
    return None
