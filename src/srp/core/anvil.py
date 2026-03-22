import os
import subprocess
import time
import shutil
import requests

_anvil_process = None

def get_anvil_path() -> str:
    candidates = [
        os.path.expanduser("~/.foundry/bin/anvil"),
        "/Users/ramprasadgoud/.foundry/bin/anvil",
        shutil.which("anvil") or "",
    ]
    for path in candidates:
        if path and os.path.isfile(path) and os.access(path, os.X_OK):
            return path
    return ""

def is_port_responsive(port: int) -> bool:
    try:
        r = requests.post(
            f"http://127.0.0.1:{port}",
            json={"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1},
            timeout=2
        )
        return r.status_code == 200
    except Exception:
        return False

def start_anvil(port: int = 8545) -> bool:
    global _anvil_process

    anvil_bin = get_anvil_path()
    if not anvil_bin:
        print("[Anvil] Binary not found — skipping")
        return False

    print(f"[Anvil] Using binary: {anvil_bin}")

    # Kill anything on port first
    subprocess.run(["pkill", "-f", "anvil"], capture_output=True)
    time.sleep(1)

    # If already responsive, use it
    if is_port_responsive(port):
        print(f"[Anvil] Already running on port {port}")
        return True

    try:
        _anvil_process = subprocess.Popen(
            [anvil_bin, "--port", str(port), "--silent"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            env={**os.environ, "PATH": f"{os.path.dirname(anvil_bin)}:{os.environ.get('PATH', '')}"}
        )
    except Exception as e:
        print(f"[Anvil] Failed to spawn: {e}")
        return False

    # Wait up to 15s
    for i in range(30):
        time.sleep(0.5)
        if is_port_responsive(port):
            print(f"[Anvil] Started on port {port} (pid {_anvil_process.pid})")
            return True

    print("[Anvil] Failed to start within 15s")
    return False

def stop_anvil():
    global _anvil_process
    if _anvil_process and _anvil_process.poll() is None:
        _anvil_process.terminate()
        _anvil_process.wait()
        print("[Anvil] Stopped")
        _anvil_process = None
