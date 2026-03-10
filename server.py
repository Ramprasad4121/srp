from __future__ import annotations

from dotenv import load_dotenv
load_dotenv()
import asyncio
import json
import os
from pathlib import Path
from typing import Any, Awaitable, Callable
from uuid import uuid4

import uvicorn
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, HTMLResponse, FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ValidationError

from core.orchestrator import SRPOrchestrator
from core.project import SRPProject
from core.skill_loader import SkillLoader, SkillNotFoundError


ROOT_DIR = Path(__file__).resolve().parent
TRACES_DIR = ROOT_DIR / "traces"
REPORTS_DIR = ROOT_DIR / "reports"
UI_DIR = ROOT_DIR / "ui"
RUNTIME_CONTRACTS_DIR = ROOT_DIR / ".runtime" / "contracts"
_project: SRPProject | None = None
SKILL_LOADER = SkillLoader()


class AuditRequest(BaseModel):
    raw_input: str
    contract_code: str
    budget_usd: float = Field(..., ge=0)
    api_key: str | None = None


app = FastAPI(title="SRP API", version="srp-2026.1")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _json_safe(value: Any) -> Any:
    return json.loads(json.dumps(value, default=str))


def _write_contract_source(contract_code: str) -> list[str]:
    RUNTIME_CONTRACTS_DIR.mkdir(parents=True, exist_ok=True)
    contract_path = RUNTIME_CONTRACTS_DIR / f"{uuid4().hex}.sol"
    contract_path.write_text(contract_code, encoding="utf-8")
    return [str(contract_path)]

def get_project() -> SRPProject:
    global _project
    if _project is None:
        root = os.environ.get("SRP_PROJECT_ROOT", ".")
        _project = SRPProject(root)
        if _project.initialized:
            _project.load()
    return _project

def run_audit_background(context: dict, project: SRPProject) -> None:
    orchestrator = SRPOrchestrator()
    result = asyncio.run(
        orchestrator.run_full_audit(
            raw_input=context.get("raw_input", ""),
            contract_paths=context.get("contract_paths", []),
            budget_usd=context.get("budget_usd", 0),
        )
    )
    trace = result.get("trace", {})
    trace_id = trace.get("trace_id")
    if trace_id:
        project.save_audit(trace_id, result)


def _iter_orchestrator_agents(orchestrator: SRPOrchestrator) -> list[tuple[str, Any]]:
    return [
        ("IntentAgent", orchestrator.intent_agent),
        ("ReconAgent", orchestrator.recon_agent),
        ("AttackAgent", orchestrator.attack_agent),
        ("DefenseAgent", orchestrator.defense_agent),
        ("TraceAgent", orchestrator.trace_agent),
        ("ReportAgent", orchestrator.report_agent),
    ]


def _attach_streaming_hooks(
    orchestrator: SRPOrchestrator,
    emit: Callable[[dict], Awaitable[None]],
) -> None:
    for agent_name, agent in _iter_orchestrator_agents(orchestrator):
        original_run = agent.run
        original_log_step = agent.log_step

        async def run_wrapper(
            context: dict,
            _run=original_run,
            _agent_name=agent_name,
        ) -> dict:
            await emit({"event": "agent_start", "agent": _agent_name, "data": {}})
            return await _run(context)

        def log_step_wrapper(
            step: str,
            data: dict,
            _log=original_log_step,
            _agent_name=agent_name,
        ) -> None:
            _log(step, data)
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                return
            payload = {
                "event": "step",
                "agent": _agent_name,
                "data": {"step": step, "data": _json_safe(data)},
            }
            loop.create_task(emit(payload))

        agent.run = run_wrapper  # type: ignore[method-assign]
        agent.log_step = log_step_wrapper  # type: ignore[method-assign]


async def _run_audit(
    request: AuditRequest,
    emit: Callable[[dict], Awaitable[None]] | None = None,
) -> dict:
    # If contract_code is a valid path, use it directly as the scope
    if os.path.exists(request.contract_code):
        contract_paths = [request.contract_code]
    else:
        contract_paths = _write_contract_source(request.contract_code)
    orchestrator = SRPOrchestrator()

    if emit is not None:
        _attach_streaming_hooks(orchestrator, emit)

        async def status_callback(step_name: str, status: str, data: dict) -> None:
            if status == "completed":
                await emit(
                    {
                        "event": "agent_complete",
                        "agent": step_name,
                        "data": _json_safe(data),
                    }
                )
            elif status == "broadcast":
                await emit({"event": "broadcast", "type": step_name, "data": _json_safe(data)})
            else:
                await emit(
                    {
                        "event": "step",
                        "agent": step_name,
                        "data": {"status": status, "details": _json_safe(data)},
                    }
                )

        orchestrator.set_status_callback(status_callback)

    result = await orchestrator.run_full_audit(
        raw_input=request.raw_input,
        contract_paths=contract_paths,
        budget_usd=request.budget_usd,
        api_key=request.api_key,
    )
    return _json_safe(result)

@app.on_event("startup")
async def startup_event() -> None:
    TRACES_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    
    skill_count = len(SKILL_LOADER.list_all())
    banner = (
        "╔═══════════════════════════════════════╗\n"
        "║  SRP Security Reasoning Protocol      ║\n"
        f"║  13 Agents Active | Skills Loaded: {skill_count:<3}║\n"
        "║  http://localhost:7337                ║\n"
        "╚═══════════════════════════════════════╝"
    )
    print(banner)

    # Auto-start audit if triggered by `srp audit`
    if os.environ.get("SRP_AUTOSTART") == "true":
        project_root = os.environ.get("SRP_PROJECT_ROOT", os.getcwd())
        target_path = os.environ.get("SRP_TARGET_PATH", project_root)
        print(f"  → Auto-starting audit on target: {target_path}")
        import asyncio
        asyncio.create_task(run_audit_on_project(project_root, target_path))


async def run_audit_on_project(project_root: str, target_path: str = None) -> None:
    """Auto-triggered when `srp audit` is run. Reads project contracts and runs the full pipeline."""
    global audit_state
    from core.project import SRPProject

    project = SRPProject(project_root)
    try:
        project.load()
    except RuntimeError:
        # Not initialized — try to auto-init
        try:
            project.initialize()
        except Exception:
            pass

    if target_path is None:
        target_path = project_root

    # Count actual sol files for UI
    import glob
    sol_files = glob.glob(os.path.join(target_path, "**/*.sol"), recursive=True)
    contract_count = len(sol_files)

    project_name = Path(project_root).name
    audit_state = {
        "status": "running",
        "logs": [f"🚀 Audit started — targeting {target_path} in {project_name}"],
        "findings": [],
        "score": 100,
        "project": project_name,
        "contracts_total": contract_count,
        "contracts_done": 0,
        "current_agent": "WATCHDOG",
        "agent_statuses": {
            "WATCHDOG": "active", "ORACLE": "active", "SPIDER": "active",
            "VIPER": "standby", "GHOST": "standby", "ZERO": "standby",
            "SHIELD": "standby", "FORGE": "standby", "SHOCKWAVE": "standby",
            "MIRROR": "standby", "DELTA": "standby", "COMMAND": "active", "LEDGER": "standby",
        },
    }

    # Skip merging code — pass the target_path directly as a scope
    # This allows ReconAgent to discover files within the scoped folder
    await run_audit(target_path, f"Audit all contracts in {target_path}. Focus on reentrancy, access control, invariant violations, oracle manipulation.")



# WebSockets removed in favor of Server-Sent Events (SSE) at /stream


@app.post("/api/audit")
async def api_audit(request: AuditRequest) -> dict:
    try:
        return await _run_audit(request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Audit failed: {exc}") from exc


@app.get("/api/skills")
async def api_skills() -> dict:
    try:
        return SKILL_LOADER.get_manifest()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load skills manifest: {exc}") from exc


@app.get("/api/skills/{skill_key}")
async def api_skill_by_key(skill_key: str) -> dict:
    try:
        content = SKILL_LOADER.load(skill_key)
    except SkillNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load skill '{skill_key}': {exc}") from exc

    skill_path = SKILL_LOADER.SKILL_REGISTRY.get(skill_key, "")
    return {
        "skill_key": skill_key,
        "path": skill_path,
        "content": content,
    }


@app.get("/api/traces")
async def api_traces() -> list[dict]:
    traces: list[dict] = []
    for trace_file in sorted(
        TRACES_DIR.glob("*.json"),
        key=lambda item: item.stat().st_mtime,
        reverse=True,
    ):
        trace_id = trace_file.stem
        timestamp = None
        try:
            payload = json.loads(trace_file.read_text(encoding="utf-8"))
            trace_id = str(payload.get("trace_id", trace_id))
            timestamp = payload.get("timestamp")
        except (OSError, json.JSONDecodeError):
            pass
        traces.append({"trace_id": trace_id, "file": trace_file.name, "timestamp": timestamp})
    return traces


@app.get("/api/traces/{trace_id}")
async def api_trace_by_id(trace_id: str) -> dict:
    if "/" in trace_id or ".." in trace_id:
        raise HTTPException(status_code=400, detail="Invalid trace_id")

    trace_path = TRACES_DIR / f"{trace_id}.json"
    if not trace_path.exists():
        raise HTTPException(status_code=404, detail="Trace not found")

    try:
        return json.loads(trace_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"Trace JSON invalid: {exc}") from exc


@app.get("/api/reports/{trace_id}")
async def api_report_by_trace_id(trace_id: str) -> PlainTextResponse:
    if "/" in trace_id or ".." in trace_id:
        raise HTTPException(status_code=400, detail="Invalid trace_id")

    report_path = REPORTS_DIR / f"{trace_id}.md"
    if not report_path.exists():
        raise HTTPException(status_code=404, detail="Report not found")

    return PlainTextResponse(report_path.read_text(encoding="utf-8"), media_type="text/markdown")


@app.get("/api/status")
async def api_status() -> dict:
    return {"status": "ok", "version": "srp-2026.1"}


@app.get("/api/audit/emergency")
async def get_emergency():
    """Returns emergency state if audit was halted."""
    project = get_project()
    if not project.initialized:
        return {}
    from core.audit_progress import AuditProgress

    progress = AuditProgress(str(project.root))
    if progress.is_emergency():
        return progress.data.get("emergency", {})
    return {"triggered": False}


@app.get("/api/project")
async def get_project_info():
    project = get_project()
    if not project.initialized:
        return {"initialized": False}
    return {"initialized": True, **project.config}


@app.get("/api/project/contracts")
async def get_all_contracts():
    project = get_project()
    if not project.initialized:
        return {}
    return project.read_all_contracts()


audit_state = {"status": "idle", "logs": [], "findings": [], "score": 100}

@app.post("/api/audit/start")
async def start_audit(request: Request, background_tasks: BackgroundTasks):
    global audit_state
    body = await request.json()
    contract_code = body.get("contract_code", "")
    description = body.get("description", "")
    api_key = body.get("api_key", "")
    
    if not contract_code:
        return {"error": "No contract code provided"}
    
    audit_state = {"status": "running", "logs": ["🚀 Audit started — deploying 13 agents..."], "findings": [], "score": 100}
    background_tasks.add_task(run_audit, contract_code, description, api_key)
    return {"status": "started"}

@app.get("/api/audit/status")  
async def get_audit_status():
    return audit_state

async def run_audit(contract_code: str, description: str = "", api_key: str | None = None):
    global audit_state
    
    try:
        # Build the AuditRequest for the real orchestrator
        raw_input = description or "Audit this Solidity contract for security vulnerabilities."
        audit_req = AuditRequest(
            raw_input=raw_input,
            contract_code=contract_code,
            budget_usd=50.0,
            api_key=api_key,
        )
        
        # Create emit callback that populates audit_state for polling
        async def emit(payload: dict) -> None:
            event = payload.get("event", "")
            agent = payload.get("agent", "")
            data = payload.get("data", {})
            
            if event == "agent_start":
                audit_state["logs"].append(f"🔄 [{agent}] Starting...")
            elif event == "agent_complete":
                audit_state["logs"].append(f"✅ [{agent}] Complete")
            elif event == "step":
                step_name = data.get("step", "") if isinstance(data, dict) else ""
                if step_name and not step_name.endswith("_started"):
                    preview = ""
                    if isinstance(data, dict):
                        d = data.get("data", data)
                        if isinstance(d, dict):
                            preview = d.get("response_preview", d.get("system_preview", ""))[:80]
                    log_msg = f"📋 [{agent}] {step_name}"
                    if preview:
                        log_msg += f" — {preview}"
                    audit_state["logs"].append(log_msg)
                
                # Capture PDF report path
                if data.get("status") == "pdf_ready":
                    pdf_path = data.get("details", {}).get("pdf_path")
                    if pdf_path:
                        audit_state["pdf_report"] = os.path.basename(pdf_path)
            
            for q in sse_queues:
                await q.put(payload)
        
        audit_state["logs"].append("🕷️  [SPIDER] Mapping contract dependencies...")
        audit_state["logs"].append("🔍 [WATCHDOG] Classifying threat surface...")
        
        # Run the REAL orchestrator pipeline
        result = await _run_audit(audit_req, emit=emit)
        
        # Extract findings from the defense output
        defense = result.get("defense", {})
        reviewed = defense.get("reviewed_vulnerabilities", [])
        score = defense.get("overall_security_score", 100)
        
        # Also grab attack findings for context
        attack = result.get("attack", {})
        raw_vulns = attack.get("vulnerabilities", [])
        
        findings = []
        for i, rv in enumerate(reviewed):
            original_vuln = raw_vulns[i] if i < len(raw_vulns) else {}
            # Preserve poc_result
            poc_res = original_vuln.get("poc_result") or rv.get("poc_result") or {"status": "skipped", "reason": "not run"}
            findings.append({
                "title": original_vuln.get("title", rv.get("original_id", f"Finding {i+1}")),
                "severity": rv.get("final_severity", original_vuln.get("severity", "medium")),
                "description": original_vuln.get("description", rv.get("defense_notes", "")),
                "affected_function": original_vuln.get("affected_function", ""),
                "location": original_vuln.get("affected_function", ""),
                "exploit_code": original_vuln.get("exploit_code", ""),
                "fix_code": rv.get("fix_code", ""),
                "status": rv.get("status", "needs_more_info"),
                "defense_notes": rv.get("defense_notes", ""),
                "poc_result": poc_res,
                "id": original_vuln.get("id"),
            })
        
        if not findings and raw_vulns:
            findings = []
            for j, v in enumerate(raw_vulns):
                poc_res = v.get("poc_result") or {"status": "skipped", "reason": "not run"}
                findings.append({
                    "title": v.get("title", f"Finding {j+1}"),
                    "severity": v.get("severity", "medium"),
                    "description": v.get("description", ""),
                    "affected_function": v.get("affected_function", ""),
                    "location": v.get("affected_function", ""),
                    "exploit_code": v.get("exploit_code", ""),
                    "fix_code": "",
                    "poc_result": poc_res,
                    "id": v.get("id"),
                })
        
        # Save trace
        trace = result.get("trace", {})
        trace_id = trace.get("trace_id")
        if trace_id:
            trace_path = TRACES_DIR / f"{trace_id}.json"
            trace_path.write_text(json.dumps(trace, indent=2, default=str), encoding="utf-8")
        
        # Save report
        report = result.get("report", {})
        report_md = report.get("markdown", report.get("report_markdown", ""))
        if trace_id and report_md:
            report_path = REPORTS_DIR / f"{trace_id}.md"
            report_path.write_text(report_md, encoding="utf-8")
        # Send final complete payload to UI through SSE
        await emit({"event": "complete", "result": result})
        
        audit_state["logs"].append(f"✅ Audit complete. Score: {score}/100. {len(findings)} findings.")
        audit_state["status"] = "complete"
        audit_state["findings"] = findings
        audit_state["score"] = score
        
    except Exception as e:
        audit_state["logs"].append(f"❌ Error: {str(e)}")
        audit_state["status"] = "complete"
        audit_state["findings"] = []
        audit_state["score"] = 0
        import traceback
        traceback.print_exc()


@app.get("/api/audits")
async def list_audits():
    project = get_project()
    if not project.initialized:
        return []
    return project.list_audits()


@app.get("/api/audits/{trace_id}")
async def get_audit(trace_id: str):
    project = get_project()
    audit_path = project.root / project.AUDIT_DIR / f"{trace_id}.json"
    if not audit_path.exists():
        return {"error": "Audit not found"}
    return json.loads(audit_path.read_text(encoding="utf-8"))


@app.get("/api/reports/{filename}")
async def get_report(filename: str):
    project = get_project()
    report_path = project.root / ".srp" / "reports" / filename
    if not report_path.exists():
        raise HTTPException(status_code=404, detail="Report not found")
    return FileResponse(report_path)


# Mount static files
ui_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ui")
static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

if os.path.exists(ui_dir):
    app.mount("/ui", StaticFiles(directory=ui_dir), name="ui")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
    app.mount("/reports", StaticFiles(directory=REPORTS_DIR), name="reports")

sse_queues = []

@app.get("/stream")
async def stream_audit(request: Request):
    async def event_generator():
        q = asyncio.Queue()
        sse_queues.append(q)
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    payload = await asyncio.wait_for(q.get(), timeout=1.0)
                    yield f"data: {json.dumps(payload, default=str)}\n\n"
                except asyncio.TimeoutError:
                    pass
        except asyncio.CancelledError:
            pass
        finally:
            if q in sse_queues:
                sse_queues.remove(q)
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/")
async def root():
    # Serve static/index.html (BYOK launch form) as default
    static_index = os.path.join(static_dir, "index.html")
    if os.path.exists(static_index):
        return FileResponse(static_index)
    return FileResponse(os.path.join(ui_dir, "index.html"))


if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=7337, reload=False)
