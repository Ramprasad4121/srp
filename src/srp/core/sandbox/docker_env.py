import os
import subprocess
import logging
from typing import List, Tuple

logger = logging.getLogger(__name__)

class DockerSandbox:
    """
    Linus-style ephemeral Docker sandbox execution.
    We don't need a massive multi-container orchestration system for a simple PoC execution.
    We just map the volume, spin up the container, run the command, and let --rm clean it up.
    """
    
    @staticmethod
    def _is_docker_running() -> bool:
        try:
            # Quick check if docker daemon is accessible
            subprocess.run(["docker", "info"], capture_output=True, check=True, timeout=2)
            return True
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
            return False

    @staticmethod
    def run_command(cmd: List[str], project_root: str, image: str = "ghcr.io/foundry-rs/foundry:latest", timeout: int = 60) -> Tuple[int, str, str]:
        """
        Runs the command in an ephemeral Docker sandbox if Docker is available.
        Otherwise, falls back to local Subprocess.
        Returns: (returncode, stdout, stderr)
        """
        if not DockerSandbox._is_docker_running():
            logger.warning(f"Docker is not running or installed. Falling back to local execution for: {' '.join(cmd)}")
            try:
                result = subprocess.run(cmd, cwd=project_root, capture_output=True, text=True, timeout=timeout)
                return result.returncode, result.stdout, result.stderr
            except subprocess.TimeoutExpired:
                return 124, "", f"Error: Command timed out after {timeout} seconds."
            except Exception as e:
                return 1, "", f"Error executing local command: {str(e)}"

        # We have Docker. Build the ephemeral sandbox command.
        # --rm automatically removes container when done
        # -v maps the project root into /workspace inside the container
        # -w sets the working directory to /workspace
        docker_cmd = [
            "docker", "run", "--rm",
            "-v", f"{os.path.abspath(project_root)}:/workspace",
            "-w", "/workspace",
            image
        ] + cmd
        
        logger.debug(f"[Sandbox] Executing in Docker: {' '.join(docker_cmd)}")
        try:
            result = subprocess.run(docker_cmd, capture_output=True, text=True, timeout=timeout)
            return result.returncode, result.stdout, result.stderr
        except subprocess.TimeoutExpired:
            return 124, "", f"Error: Docker Sandbox command timed out after {timeout} seconds."
        except Exception as e:
            return 1, "", f"Error executing sandbox command: {str(e)}"
