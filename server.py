from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Any, Awaitable, Callable
from uuid import uuid4

import uvicorn
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, HTMLResponse, FileResponse
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
    print("SentinelAgent model: claude-haiku-4-5-20251001 (triage)")
    print("AttackAgents model:  claude-sonnet-4-20250514 (deep reasoning)")


@app.websocket("/ws/audit")
async def websocket_audit(websocket: WebSocket) -> None:
    await websocket.accept()

    async def emit(payload: dict) -> None:
        await websocket.send_json(_json_safe(payload))

    while True:
        try:
            incoming = await websocket.receive_json()
        except WebSocketDisconnect:
            break

        try:
            request = AuditRequest.model_validate(incoming)
            result = await _run_audit(request, emit=emit)
            await emit({"event": "complete", "result": result})
        except ValidationError as exc:
            await emit(
                {
                    "event": "step",
                    "agent": "server",
                    "data": {
                        "error": "invalid_payload",
                        "details": exc.errors(include_url=False),
                    },
                }
            )
        except Exception as exc:
            await emit(
                {
                    "event": "step",
                    "agent": "server",
                    "data": {"error": "audit_failed", "details": str(exc)},
                }
            )


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


@app.post("/api/audit/start")
async def start_audit(request: Request, background_tasks: BackgroundTasks):
    body = await request.json()
    contract_code = body.get("contract_code", "")
    
    project = get_project()
    
    if contract_code:
        # Single contract mode — user pasted code
        context = {
            "all_contracts": {"pasted_contract.sol": contract_code},
            "project_name": "pasted_contract",
            "entry_contracts": ["pasted_contract.sol"],
            "dependency_graph": {},
            "contracts_dir": ".",
            "project_type": "unknown",
            "compiler_version": "0.8.20",
            "project_root": "."
        }
    elif project.initialized:
        # Full project mode
        project.load()
        context = project.get_full_project_context()
    else:
        return {"error": "No contract provided and no project initialized"}

    background_tasks.add_task(run_audit_background, context, project)
    return {"status": "started", "contracts": len(context["all_contracts"])}


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


# Mount static files
ui_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ui")
if os.path.exists(ui_dir):
    app.mount("/ui", StaticFiles(directory=ui_dir), name="ui")

@app.get("/")
async def root():
    return FileResponse(os.path.join(ui_dir, "index.html"))


if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=7337, reload=False)
