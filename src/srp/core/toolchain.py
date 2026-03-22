import os, re, json


def detect_toolchain(project_root: str) -> dict:
    """Detect build toolchain from project files and README."""

    roots_to_check = [project_root]
    parent = os.path.dirname(project_root)
    if parent and parent != project_root:
        roots_to_check.append(parent)

    def has(f):
        return any(os.path.isfile(os.path.join(r, f)) for r in roots_to_check)

    def has_dir(d):
        return any(os.path.isdir(os.path.join(r, d)) for r in roots_to_check)

    # README scan
    readme_text = ""
    for r in roots_to_check:
        for name in ["README.md", "readme.md", "README.txt"]:
            p = os.path.join(r, name)
            if os.path.isfile(p):
                try:
                    readme_text = open(p, encoding="utf-8").read(8000).lower()
                    break
                except Exception:
                    pass
        if readme_text:
            break

    # Hardhat — config file OR node_modules/hardhat present (most reliable signal)
    if has("hardhat.config.js") or has("hardhat.config.ts") or has_dir("node_modules/hardhat"):
        return _hardhat(project_root, roots_to_check, readme_text)

    # Anchor
    if has("Anchor.toml"):
        return {
            "type": "anchor",
            "install_cmd": "yarn install",
            "build_cmd": "anchor build",
            "test_cmd": "anchor test",
            "test_file_ext": ".ts",
            "test_dir": "tests",
        }

    # Truffle
    if has("truffle-config.js") or has("truffle.js"):
        return {
            "type": "truffle",
            "install_cmd": "npm install",
            "build_cmd": "truffle compile",
            "test_cmd": "truffle test",
            "test_file_ext": ".js",
            "test_dir": "test",
        }

    # Forge — only after ruling out all JS-based toolchains
    if has("foundry.toml") or has_dir("lib/forge-std"):
        return _forge(project_root, roots_to_check)

    # package.json script fallback
    for r in roots_to_check:
        pkg_path = os.path.join(r, "package.json")
        if os.path.isfile(pkg_path):
            try:
                pkg = json.loads(open(pkg_path).read())
                scripts = pkg.get("scripts", {})
                if any("hardhat" in str(v) for v in scripts.values()):
                    return _hardhat(project_root, roots_to_check, readme_text)
                if any("forge" in str(v) for v in scripts.values()):
                    return _forge(project_root, roots_to_check)
            except Exception:
                pass

    # README keyword fallback
    if "hardhat" in readme_text:
        return _hardhat(project_root, roots_to_check, readme_text)
    if "anchor" in readme_text:
        return {
            "type": "anchor",
            "install_cmd": "yarn install",
            "build_cmd": "anchor build",
            "test_cmd": "anchor test",
            "test_file_ext": ".ts",
            "test_dir": "tests",
        }

    # Default: forge
    return _forge(project_root, roots_to_check)


def _forge(project_root: str, roots_to_check: list) -> dict:
    test_dir = "test"
    for r in roots_to_check:
        toml_path = os.path.join(r, "foundry.toml")
        if os.path.isfile(toml_path):
            try:
                content = open(toml_path).read()
                m = re.search(r'test\s*=\s*"([^"]+)"', content)
                if m:
                    test_dir = m.group(1)
                break
            except Exception:
                pass

    forge_std_present = any(
        os.path.isdir(os.path.join(r, "lib", "forge-std")) for r in roots_to_check
    )

    return {
        "type": "forge",
        "install_cmd": "forge install --no-commit",
        "build_cmd": "forge build",
        "test_cmd": "forge test",
        "test_file_ext": ".t.sol",
        "test_dir": test_dir,
        "forge_std_present": forge_std_present,
    }


def _hardhat(project_root: str, roots_to_check: list, readme_text: str) -> dict:
    test_cmd = "npx hardhat test"
    m = re.search(r'(npx hardhat test[^\n`"]*)', readme_text)
    if m:
        test_cmd = m.group(1).strip()

    # Find the actual project root (where node_modules lives) for install
    install_root = project_root
    is_viem = False
    for r in roots_to_check:
        if os.path.isdir(os.path.join(r, "node_modules")):
            install_root = r
        
        # Check config and package.json for viem
        for fname in ["hardhat.config.ts", "hardhat.config.js", "package.json"]:
            p = os.path.join(r, fname)
            if os.path.isfile(p):
                try:
                    content = open(p, encoding="utf-8").read()
                    if "hardhat-toolbox-viem" in content or "hardhat-viem" in content:
                        is_viem = True
                except Exception:
                    pass

    return {
        "type": "hardhat",
        "install_cmd": "npm install",
        "build_cmd": "npx hardhat compile",
        "test_cmd": test_cmd,
        "test_file_ext": ".js",
        "test_dir": "test",
        "install_root": install_root,
        "is_viem": is_viem,
    }