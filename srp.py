import os
import sys
import json
import asyncio
import subprocess
import webbrowser
import time
from pathlib import Path

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.live import Live
from rich.text import Text
from rich import box
import uvicorn

console = Console()

BANNER = """
[bold cyan]
  ███████╗██████╗ ██████╗ 
  ██╔════╝██╔══██╗██╔══██╗
  ███████╗██████╔╝██████╔╝
  ╚════██║██╔══██╗██╔═══╝ 
  ███████║██║  ██║██║     
  ╚══════╝╚═╝  ╚═╝╚═╝     
[/bold cyan]
[dim]Security Reasoning Protocol — AI Agent Army for Smart Contracts[/dim]
"""

@click.group()
@click.version_option(version="0.1.0", prog_name="srp")
def cli():
    """SRP — Security Reasoning Protocol\n\nAI agent army for smart contract security. Run `srp init` inside your project to get started."""
    pass


# ─── SETUP ───────────────────────────────────────────────────────────────────

@cli.command()
def init():
    """Initialize SRP inside your Solidity project."""
    from core.project import SRPProject
    from core.skill_loader import SkillLoader

    console.print(BANNER)

    project = SRPProject(".")

    if project.initialized:
        config = project.load()
        console.print(f"[yellow]⚠️  SRP already initialized in this project.[/yellow]")
        console.print(f"   Project: [bold]{config['project_name']}[/bold] ({config['total_contracts']} contracts)")
        console.print(f"   Run [bold cyan]srp start[/bold cyan] to open the dashboard.")
        return

    console.print("[bold]Initializing SRP...[/bold]\n")

    with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}"), console=console) as p:
        t = p.add_task("Detecting project type...", total=None)
        project_type = project._detect_project_type()
        p.update(t, description=f"[green]✅ {project_type.capitalize()} project detected[/green]")
        time.sleep(0.3)

        p.update(t, description="Scanning contracts...")
        contracts = project._find_all_contracts()
        p.update(t, description=f"[green]✅ Found {len(contracts)} Solidity files[/green]")
        time.sleep(0.3)

        p.update(t, description="Detecting compiler version...")
        compiler = project._detect_compiler_version()
        p.update(t, description=f"[green]✅ Compiler: solc {compiler}[/green]")
        time.sleep(0.3)

        p.update(t, description="Detecting git repo...")
        repo_url = project._detect_repo_url()
        if repo_url:
            p.update(t, description=f"[green]✅ Repo: {repo_url}[/green]")
        else:
            p.update(t, description="[yellow]⚠️  No git remote found[/yellow]")
        time.sleep(0.3)

        p.update(t, description="Loading skills arsenal...")
        try:
            sl = SkillLoader()
            skill_count = len(sl.list_all())
            p.update(t, description=f"[green]✅ Skills arsenal: {skill_count} skills loaded[/green]")
        except Exception:
            p.update(t, description="[yellow]⚠️  Skills not fully loaded — run Step 0 first[/yellow]")
        time.sleep(0.3)

        p.update(t, description="Saving config...")

    if not repo_url:
        repo_url = click.prompt(
            "\n  GitHub repo URL? (optional — press Enter to skip)",
            default="",
            show_default=False
        )

    config = project.initialize(repo_url=repo_url)

    console.print()
    console.print(Panel(
        f"[bold green]SRP initialized successfully![/bold green]\n\n"
        f"  Project:   [cyan]{config['project_name']}[/cyan]\n"
        f"  Type:      [cyan]{config['detected_type']}[/cyan]\n"
        f"  Contracts: [cyan]{config['total_contracts']} files found[/cyan]\n"
        f"  Compiler:  [cyan]solc {config['compiler_version']}[/cyan]\n"
        f"  Repo:      [cyan]{config['repo_url'] or 'not set'}[/cyan]\n\n"
        f"  Config saved to [dim].srp/config.json[/dim]\n\n"
        f"  Run [bold cyan]srp start[/bold cyan] to open the security dashboard.",
        title="[bold]SRP Ready[/bold]",
        border_style="green"
    ))


@cli.command()
@click.option("--no-browser", is_flag=True, help="Start server without opening browser (headless/CI mode)")
@click.option("--port", default=7337, help="Port to run on (default: 7337)")
def start(no_browser, port):
    """Start the SRP dashboard (use `srp audit` instead)."""
    console.print("[yellow]⚠️  `srp start` is deprecated. Use `srp audit` instead.[/yellow]")
    console.print("[dim]`srp audit` scans your project and launches everything automatically.[/dim]")


@cli.command()
@click.argument("target", default=".")
@click.option("--no-browser", is_flag=True, help="Run audit without opening browser")
@click.option("--port", default=7337, help="Port to run on (default: 7337)")
def audit(target, no_browser, port):
    """Scan current directory or target and launch full audit with live UI.

    One command does everything:
    1. Scans target directory for Solidity contracts
    2. Starts server at localhost:7337
    3. Opens browser automatically
    4. Audit begins immediately in the background
    5. UI shows live agent activity as it happens
    6. Results appear on screen when done
    """
    import threading
    from core.project import SRPProject

    console.print(BANNER)

    # 1. Detect project — auto-init if needed
    project = SRPProject(os.getcwd())
    if not project.initialized:
        console.print("[dim]No .srp config found. Auto-initializing...[/dim]")
        try:
            project.initialize()
        except Exception:
            pass

    def detect_scope(base_dir: str) -> str:
        # Priority order — check these folders first
        priority_folders = ["src", "contracts", "contract", "sources"]

        # First, check if base_dir itself looks like a direct scope folder (e.g. user passed `src` directly)
        base_name = os.path.basename(os.path.abspath(base_dir))
        if base_name in priority_folders and os.path.isdir(base_dir):
            return base_dir
            
        for folder in priority_folders:
            candidate = os.path.join(base_dir, folder)
            if os.path.isdir(candidate):
                sol_files = [f for f in os.listdir(candidate) if f.endswith(".sol")]
                if sol_files:
                    console.print(f"  [green]✅ Scope detected:[/green] {candidate} ({len(sol_files)} contracts direct in folder)")
                    return candidate
        
        # No known scope folder found — ask user
        console.print("\n  [yellow]⚠️  Could not auto-detect scope folder.[/yellow]")
        console.print("  [dim]Common scope folders (src, contracts) not found.[/dim]\n")
        user_path = click.prompt("  Enter path to audit scope", type=str).strip()
        
        if not os.path.isdir(user_path):
            console.print(f"  [red]❌ Path not found:[/red] {user_path}")
            sys.exit(1)
        
        sol_files = [f for f in os.listdir(user_path) if f.endswith(".sol")]
        if not sol_files:
            console.print(f"  [red]❌ No .sol files found directly in:[/red] {user_path}")
            sys.exit(1)
        
        console.print(f"  [green]✅ Scope set:[/green] {user_path} ({len(sol_files)} contracts direct in folder)")
        return user_path

    target_path = Path(target).resolve()

    # Find contracts even without init
    if target_path.is_file():
        sol_files = [target_path]
    else:
        scope_path = detect_scope(str(target_path))
        target_path = Path(scope_path)
        sol_files = list(target_path.rglob("*.sol"))
        
    sol_files = [f for f in sol_files if not any(
        p in str(f) for p in ["node_modules", ".git", "lib/", "cache/", "out/", "artifacts/", ".srp/"]
    )]

    if not sol_files:
        console.print(f"[red]❌ No Solidity contracts found in {target_path}.[/red]")
        console.print("[dim]   Try pointing to a specific folder or file.[/dim]")
        sys.exit(1)

    project_name = Path(os.getcwd()).name
    console.print(Panel(
        f"[bold green]SRP AUDIT[/bold green]\n\n"
        f"  Project:   [cyan]{project_name}[/cyan]\n"
        f"  Target:    [cyan]{target}[/cyan]\n"
        f"  Contracts: [cyan]{len(sol_files)} Solidity files[/cyan]\n"
        f"  Agents:    [cyan]13 deploying...[/cyan]\n"
        f"  Dashboard: [bold]http://localhost:{port}[/bold]",
        border_style="green",
        title="[bold]Mission Briefing[/bold]"
    ))

    # 2. Set environment for auto-start
    # If target is a file, project root is its parent. If directory, it is the parent if we are in contracts/ src/ etc.
    actual_project_root = target_path if target_path.is_dir() else target_path.parent
    
    # Check if we should go one level up (if target is contracts/ etc)
    if actual_project_root.name in ["contracts", "src", "contract", "test"]:
        actual_project_root = actual_project_root.parent

    os.environ["SRP_AUTOSTART"] = "true"
    os.environ["SRP_PROJECT_ROOT"] = str(actual_project_root)
    os.environ["SRP_TARGET_PATH"] = str(target_path)

    # 3. Open browser after short delay
    if not no_browser:
        def open_browser():
            time.sleep(2)
            webbrowser.open(f"http://localhost:{port}")
        threading.Thread(target=open_browser, daemon=True).start()

    # 4. Start server (blocks — audit runs inside server on startup)
    srp_root = Path(__file__).parent.resolve()
    if str(srp_root) not in sys.path:
        sys.path.insert(0, str(srp_root))
    os.chdir(srp_root)
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False, log_level="warning")


@cli.command()
def diff():
    """Security diff between current code and last git commit."""
    from core.project import SRPProject
    project = SRPProject(".")
    if not project.initialized:
        console.print("[red]❌ Run `srp init` first.[/red]")
        sys.exit(1)
    config = project.load()
    console.print(f"[cyan]Running security diff for {config['project_name']}...[/cyan]")
    console.print("[dim]Opening http://localhost:7337/diff[/dim]")
    webbrowser.open("http://localhost:7337/diff")


@cli.command(name="fork-check")
def fork_check():
    """Check if any contract is a fork and map inherited vulnerabilities."""
    from core.project import SRPProject
    project = SRPProject(".")
    if not project.initialized:
        console.print("[red]❌ Run `srp init` first.[/red]")
        sys.exit(1)
    console.print("[cyan]Running fork detection...[/cyan]")
    webbrowser.open("http://localhost:7337/fork-check")


@cli.group()
def monitor():
    """Manage 24/7 contract monitoring."""
    pass


@monitor.command("add")
@click.argument("address")
@click.option("--name", required=True, help="Human-readable name for this contract")
@click.option("--source", default=None, help="Path to source .sol file (optional)")
def monitor_add(address, name, source):
    """Register a deployed contract for 24/7 monitoring.\n\n  Example: srp monitor add 0x1234...abcd --name MyVault"""
    from core.project import SRPProject
    import json

    project = SRPProject(".")
    if not project.initialized:
        console.print("[red]❌ Run `srp init` first.[/red]")
        sys.exit(1)

    monitored_path = project.root / ".srp" / "monitored.json"
    monitored = []
    if monitored_path.exists():
        monitored = json.loads(monitored_path.read_text())

    if any(m["address"].lower() == address.lower() for m in monitored):
        console.print(f"[yellow]⚠️  Already monitoring {address}[/yellow]")
        return

    entry = {
        "address": address,
        "name": name,
        "source": source,
        "added_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "status": "active"
    }
    monitored.append(entry)
    monitored_path.write_text(json.dumps(monitored, indent=2))

    console.print(f"[green]✅ Now monitoring:[/green] [bold]{name}[/bold] ({address})")
    console.print("[dim]SentinelAgent will check every 5 minutes[/dim]")


@monitor.command("list")
def monitor_list():
    """Show all monitored contracts."""
    from core.project import SRPProject
    import json

    project = SRPProject(".")
    if not project.initialized:
        console.print("[red]❌ Run `srp init` first.[/red]")
        sys.exit(1)

    monitored_path = project.root / ".srp" / "monitored.json"
    if not monitored_path.exists() or not json.loads(monitored_path.read_text()):
        console.print("[dim]No contracts monitored yet. Use `srp monitor add`[/dim]")
        return

    monitored = json.loads(monitored_path.read_text())

    table = Table(title="Monitored Contracts", box=box.ROUNDED, border_style="cyan")
    table.add_column("Name",     style="bold")
    table.add_column("Address",  style="dim")
    table.add_column("Added",    style="dim")
    table.add_column("Status",   style="green")

    for m in monitored:
        table.add_row(
            m["name"],
            m["address"][:10] + "..." + m["address"][-6:],
            m["added_at"][:10],
            "✅ Active" if m["status"] == "active" else "⏸ Paused"
        )

    console.print(table)


@monitor.command("remove")
@click.argument("address")
def monitor_remove(address):
    """Stop monitoring a contract."""
    from core.project import SRPProject
    import json

    project = SRPProject(".")
    if not project.initialized:
        console.print("[red]❌ Run `srp init` first.[/red]")
        sys.exit(1)

    monitored_path = project.root / ".srp" / "monitored.json"
    if not monitored_path.exists():
        console.print("[yellow]No contracts being monitored.[/yellow]")
        return

    monitored = json.loads(monitored_path.read_text())
    before = len(monitored)
    monitored = [m for m in monitored if m["address"].lower() != address.lower()]

    if len(monitored) == before:
        console.print(f"[yellow]⚠️  Address {address} not found in monitored list.[/yellow]")
        return

    monitored_path.write_text(json.dumps(monitored, indent=2))
    console.print(f"[green]✅ Removed {address} from monitoring.[/green]")


@cli.command()
def traces():
    """List all past audit traces for this project."""
    from core.project import SRPProject

    project = SRPProject(".")
    if not project.initialized:
        console.print("[red]❌ Run `srp init` first.[/red]")
        sys.exit(1)

    project.load()
    audits = project.list_audits()

    if not audits:
        console.print("[dim]No audits yet. Run `srp audit` to start.[/dim]")
        return

    table = Table(title=f"Audit History — {project.config['project_name']}", box=box.ROUNDED, border_style="cyan")
    table.add_column("Trace ID",  style="dim", max_width=16)
    table.add_column("Date",      style="dim")
    table.add_column("Score",     justify="center")
    table.add_column("Findings",  justify="center")

    for a in audits:
        score = a.get("score", "N/A")
        score_color = "green" if isinstance(score, int) and score >= 80 else "yellow" if isinstance(score, int) and score >= 60 else "red"
        table.add_row(
            a["trace_id"][:14] + "...",
            a["timestamp"][:10] if a["timestamp"] else "N/A",
            f"[{score_color}]{score}[/{score_color}]",
            str(a["findings"])
        )

    console.print(table)


@cli.command()
@click.argument("trace_id")
def verify(trace_id):
    """Verify a past audit trace by recomputing cryptographic hashes."""
    console.print(f"[cyan]Verifying trace {trace_id}...[/cyan]")
    webbrowser.open(f"http://localhost:7337/verify/{trace_id}")


@cli.command()
@click.argument("trace_id")
def replay(trace_id):
    """Replay a past audit from its saved trace inputs."""
    console.print(f"[cyan]Replaying trace {trace_id}...[/cyan]")
    webbrowser.open(f"http://localhost:7337/replay/{trace_id}")


@cli.command()
def threats():
    """Show latest DeFi exploit threat intelligence."""
    console.print("[cyan]Opening threat intelligence feed...[/cyan]")
    webbrowser.open("http://localhost:7337/threats")


@cli.command(name="blast-radius")
@click.argument("exploit_url", required=False)
def blast_radius(exploit_url):
    """Check blast radius of a new exploit against monitored contracts.\n\n  Example: srp blast-radius https://rekt.news/euler-rekt/"""
    if exploit_url:
        console.print(f"[cyan]Running blast radius check for:[/cyan] {exploit_url}")
        webbrowser.open(f"http://localhost:7337/blast-radius?url={exploit_url}")
    else:
        webbrowser.open("http://localhost:7337/blast-radius")


@cli.command()
def status():
    """Show SRP system status — agents, skills, watchdog."""
    from core.skill_loader import SkillLoader

    console.print("[bold cyan]SRP System Status[/bold cyan]\n")

    try:
        sl = SkillLoader()
        skills = sl.list_all()
        console.print(f"[green]✅ Skills arsenal:[/green] {len(skills)} skills loaded")
    except Exception as e:
        console.print(f"[red]❌ Skills error:[/red] {e}")

    env_checks = {
        "NVIDIA_API_KEY": "NVIDIA API Key (required)",
        "SRP_WALLET_KEY": "Wallet Private Key (x402 payments)",
        "COINBASE_API_KEY_NAME": "Coinbase API Name (optional)",
        "COINBASE_API_KEY_PRIVATE_KEY": "Coinbase Private Key (optional)",
    }
    
    for k, label in env_checks.items():
        if os.environ.get(k):
            console.print(f"[green]✅ {label}: set[/green]")
        else:
            color = "red" if k == "NVIDIA_API_KEY" else "yellow"
            console.print(f"[{color}]{'❌' if k == 'NVIDIA_API_KEY' else '⚠️ '} {label}: not set[/{color}]")

    console.print()
    for tool in ["slither", "aderyn", "echidna", "openclaw"]:
        result = subprocess.run(["which", tool], capture_output=True)
        if result.returncode == 0:
            console.print(f"[green]✅ {tool}[/green]")
        else:
            console.print(f"[yellow]⚠️  {tool}: not installed (optional)[/yellow]")

    from core.project import SRPProject
    project = SRPProject(".")
    if project.initialized:
        config = project.load()
        console.print(f"\n[green]✅ Project:[/green] {config['project_name']} ({config['total_contracts']} contracts)")
        last = config.get("last_audit")
        if last:
            console.print(f"[dim]   Last audit: {last['timestamp'][:10]} | Score: {last['score']} | Findings: {last['findings']}[/dim]")
        else:
            console.print(f"[dim]   No audits yet[/dim]")
    else:
        console.print(f"\n[yellow]⚠️  No project initialized. Run `srp init` in your project folder.[/yellow]")


if __name__ == "__main__":
    cli()
