"""
SRP Dev Server — I2/I3
Developer feedback server on port 7338.
Provides AI-powered real-time feedback for Solidity development:
- NatSpec generation
- Invariant suggestions
- Test scaffold generation
- Gas optimization hints
- Upgrade safety checks
- Access control analysis
"""
from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from dotenv import load_dotenv

load_dotenv()
load_dotenv(Path(__file__).resolve().parent / ".env")

# Dev port
PORT = int(os.environ.get("SRP_DEV_PORT", 7338))
PROJECT_ROOT = os.environ.get("SRP_PROJECT_ROOT", os.getcwd())


app = FastAPI(title="SRP Dev Server", version="srp-dev-2026.1")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Dev Agent Registry ──────────────────────────────────────────
_dev_agents: dict = {}


def _get_dev_agents() -> dict:
    global _dev_agents
    if _dev_agents:
        return _dev_agents
    try:
        from srp.agents.v2.dev_agents_v2 import NatSpecAgentV2
        _dev_agents["natspec"] = NatSpecAgentV2()
    except Exception as e:
        print(f"[Dev] NatSpecAgentV2 unavailable: {e}")
    try:
        from srp.agents.v2.dev_agents_v2 import SimpleV2Agent
        _dev_agents["invariants"] = SimpleV2Agent(
            system_prompt="You are an invariant expert. Suggest invariants and tests. Return JSON: {'invariants':[{'id':'INV-1','description':'...','test_code':'...'}]}",
            json_mode=True
        )
    except Exception as e:
        print(f"[Dev] InvariantSuggesterV2 unavailable: {e}")
    try:
        from srp.agents.v2.test_writer_v2 import TestWriterV2
        _dev_agents["tests"] = TestWriterV2()
    except Exception as e:
        print(f"[Dev] TestWriterV2 unavailable: {e}")
    try:
        from srp.agents.v2.dev_agents_v2 import GasOptimizerV2
        _dev_agents["gas"] = GasOptimizerV2()
    except Exception as e:
        print(f"[Dev] GasOptimizerV2 unavailable: {e}")
    try:
        from srp.agents.v2.dev_agents_v2 import UpgradeSafetyCheckerV2
        _dev_agents["upgrade"] = UpgradeSafetyCheckerV2()
    except Exception as e:
        print(f"[Dev] UpgradeSafetyCheckerV2 unavailable: {e}")
    try:
        from srp.agents.v2.dev_agents_v2 import DevAccessControlMapperV2
        _dev_agents["access_control"] = DevAccessControlMapperV2()
    except Exception as e:
        print(f"[Dev] DevAccessControlMapperV2 unavailable: {e}")
    return _dev_agents


# ── Routes ─────────────────────────────────────────────────────

@app.get("/")
async def root():
    """I3: Dev UI."""
    return HTMLResponse(content=_dev_ui_html())


@app.get("/api/dev/status")
async def dev_status():
    agents = _get_dev_agents()
    return {
        "status": "ok",
        "mode": "dev",
        "port": PORT,
        "project_root": PROJECT_ROOT,
        "agents_loaded": list(agents.keys()),
        "version": "srp-dev-2026.1",
    }


@app.post("/api/dev/analyze")
async def dev_analyze(request: Request):
    """
    Analyze a Solidity contract snippet with all dev agents.
    Body: { "code": "...", "agents": ["natspec", "invariants", "tests", "gas", "upgrade", "access_control"] }
    """
    body = await request.json()
    code = body.get("code", "")
    requested = set(body.get("agents", ["natspec", "invariants", "tests", "gas", "upgrade", "access_control"]))

    if not code:
        return {"error": "No code provided"}

    agents = _get_dev_agents()
    context = {"code": code, "project_root": PROJECT_ROOT}
    results = {}

    tasks = {}
    for name, agent in agents.items():
        if name in requested:
            tasks[name] = agent.run(context)

    if tasks:
        task_results = await asyncio.gather(*tasks.values(), return_exceptions=True)
        for name, result in zip(tasks.keys(), task_results):
            if isinstance(result, Exception):
                results[name] = {"error": str(result)}
            else:
                results[name] = result

    return {"results": results, "agents_run": list(tasks.keys())}


@app.get("/api/dev/contracts")
async def list_contracts():
    """List all .sol files in project."""
    import glob
    sol_files = glob.glob(os.path.join(PROJECT_ROOT, "**/*.sol"), recursive=True)
    return {"contracts": [os.path.relpath(f, PROJECT_ROOT) for f in sol_files[:50]]}


@app.post("/api/dev/natspec")
async def gen_natspec(request: Request):
    body = await request.json()
    code = body.get("code", "")
    agents = _get_dev_agents()
    if "natspec" not in agents:
        return {"error": "NatSpecAgent not available"}
    result = await agents["natspec"].run({"code": code})
    return result


@app.post("/api/dev/invariants")
async def gen_invariants(request: Request):
    body = await request.json()
    code = body.get("code", "")
    agents = _get_dev_agents()
    if "invariants" not in agents:
        return {"error": "InvariantSuggester not available"}
    result = await agents["invariants"].run({"code": code})
    return result


@app.post("/api/dev/tests")
async def gen_tests(request: Request):
    body = await request.json()
    code = body.get("code", "")
    agents = _get_dev_agents()
    if "tests" not in agents:
        return {"error": "TestWriter not available"}
    result = await agents["tests"].run({"code": code})
    return result


@app.post("/api/dev/gas")
async def analyze_gas(request: Request):
    body = await request.json()
    code = body.get("code", "")
    agents = _get_dev_agents()
    if "gas" not in agents:
        return {"error": "GasOptimizer not available"}
    result = await agents["gas"].run({"code": code})
    return result


# ── Dev UI ─────────────────────────────────────────────────────

def _dev_ui_html() -> str:
    return """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SRP Dev Mode — localhost:7338</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}
:root{
  --bg:#050505;--bg-surface:#0a0a0a;--bg-card:#0f0f0f;--bg-hover:#141414;
  --border:#1a1a1a;--border-bright:#2a2a2a;
  --text:#e0e0e0;--text-dim:#666;--text-muted:#444;
  --accent:#00ff88;--accent-dim:rgba(0,255,136,0.15);
  --red:#ff4444;--amber:#ffaa00;--blue:#4488ff;
  --mono:'JetBrains Mono',monospace;--sans:'Inter',-apple-system,sans-serif;
}
body{background:var(--bg);color:var(--text);font-family:var(--sans);min-height:100vh;-webkit-font-smoothing:antialiased;}
.header{position:sticky;top:0;z-index:100;background:var(--bg);border-bottom:1px solid var(--border);padding:0 32px;height:56px;display:flex;align-items:center;justify-content:space-between;}
.logo{font-family:var(--mono);font-size:1.4rem;font-weight:700;color:var(--accent);letter-spacing:-1px;}
.logo-sub{font-family:var(--mono);font-size:0.65rem;color:var(--text-dim);letter-spacing:3px;text-transform:uppercase;margin-left:12px;}
.badge{font-family:var(--mono);font-size:0.6rem;color:var(--amber);background:rgba(255,170,0,0.15);border:1px solid rgba(255,170,0,0.3);padding:2px 8px;border-radius:2px;letter-spacing:1px;}
.main{display:grid;grid-template-columns:1fr 1fr;gap:0;height:calc(100vh - 56px);}
.editor-pane{border-right:1px solid var(--border);display:flex;flex-direction:column;}
.pane-header{padding:12px 20px;border-bottom:1px solid var(--border);font-family:var(--mono);font-size:0.7rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:2px;display:flex;align-items:center;justify-content:space-between;}
.btn{font-family:var(--mono);font-size:0.72rem;color:var(--accent);background:var(--accent-dim);border:1px solid rgba(0,255,136,0.3);padding:4px 14px;border-radius:2px;cursor:pointer;letter-spacing:1px;transition:all 0.2s;}
.btn:hover{background:rgba(0,255,136,0.25);}
.btn:disabled{opacity:0.4;cursor:not-allowed;}
textarea{flex:1;background:var(--bg-surface);color:var(--text);font-family:var(--mono);font-size:0.78rem;padding:20px;border:none;resize:none;outline:none;line-height:1.7;}
.results-pane{overflow-y:auto;background:var(--bg);}
.result-block{border-bottom:1px solid var(--border);padding:20px;}
.result-title{font-family:var(--mono);font-size:0.7rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:2px;margin-bottom:12px;}
.result-content{font-family:var(--mono);font-size:0.73rem;line-height:1.7;color:var(--text);background:var(--bg-surface);padding:12px 16px;border-radius:2px;border:1px solid var(--border);white-space:pre-wrap;word-break:break-word;max-height:400px;overflow-y:auto;}
.result-content.accent{color:var(--accent);}
.loading{color:var(--text-muted);font-family:var(--mono);font-size:0.73rem;padding:20px;text-align:center;}
.agent-pills{display:flex;flex-wrap:wrap;gap:6px;padding:12px 20px;border-bottom:1px solid var(--border);}
.agent-pill{font-family:var(--mono);font-size:0.62rem;padding:3px 10px;border:1px solid var(--border);border-radius:2px;cursor:pointer;color:var(--text-dim);transition:all 0.2s;user-select:none;}
.agent-pill.active{color:var(--accent);background:var(--accent-dim);border-color:rgba(0,255,136,0.3);}
</style>
</head>
<body>
<header class="header">
  <div style="display:flex;align-items:center">
    <div class="logo">SRP</div>
    <div class="logo-sub">Developer Mode</div>
  </div>
  <div style="display:flex;align-items:center;gap:12px">
    <span class="badge">PORT 7338</span>
    <span id="status-badge" class="badge" style="color:var(--accent);background:var(--accent-dim);border-color:rgba(0,255,136,0.3);">LOADING...</span>
  </div>
</header>

<div class="main">
  <div class="editor-pane">
    <div class="pane-header">
      <span>Solidity Editor</span>
      <button class="btn" id="analyze-btn" onclick="analyzeCode()">▶ ANALYZE</button>
    </div>
    <div class="agent-pills" id="agent-pills">
      <span class="agent-pill active" data-agent="natspec">NatSpec</span>
      <span class="agent-pill active" data-agent="invariants">Invariants</span>
      <span class="agent-pill active" data-agent="tests">Tests</span>
      <span class="agent-pill active" data-agent="gas">Gas</span>
      <span class="agent-pill active" data-agent="upgrade">Upgrade Safety</span>
      <span class="agent-pill active" data-agent="access_control">Access Control</span>
    </div>
    <textarea id="code-editor" spellcheck="false" placeholder="// Paste your Solidity code here and click ANALYZE
// SRP Dev will generate NatSpec, invariants, tests, gas hints, and more...

pragma solidity ^0.8.29;

contract Example {
    address public owner;
    mapping(address => uint256) public balances;

    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount);
        (bool ok,) = msg.sender.call{value: amount}('');
        require(ok);
        balances[msg.sender] -= amount;
    }
}"></textarea>
  </div>

  <div class="results-pane" id="results-pane">
    <div class="loading">Paste Solidity code and click ANALYZE →</div>
  </div>
</div>

<script>
const pills=document.querySelectorAll('.agent-pill');
pills.forEach(p=>p.addEventListener('click',()=>p.classList.toggle('active')));

function getActiveAgents(){
  return [...document.querySelectorAll('.agent-pill.active')].map(p=>p.dataset.agent);
}

async function analyzeCode(){
  const btn=document.getElementById('analyze-btn');
  const code=document.getElementById('code-editor').value.trim();
  if(!code){return;}
  const pane=document.getElementById('results-pane');
  btn.disabled=true;
  btn.textContent='ANALYZING...';
  pane.innerHTML='<div class="loading">🔍 Analyzing with SRP Dev agents...</div>';
  try{
    const res=await fetch('/api/dev/analyze',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({code,agents:getActiveAgents()}),
    });
    const data=await res.json();
    if(data.error){pane.innerHTML=`<div class="loading" style="color:var(--red)">${data.error}</div>`;return;}
    renderResults(data.results);
  }catch(e){
    pane.innerHTML=`<div class="loading" style="color:var(--red)">Error: ${e.message}</div>`;
  }finally{
    btn.disabled=false;
    btn.textContent='▶ ANALYZE';
  }
}

function renderResults(results){
  const pane=document.getElementById('results-pane');
  const titles={natspec:'📝 NatSpec',invariants:'🛡️ Invariants',tests:'🧪 Test Scaffold',gas:'⛽ Gas Optimization',upgrade:'🔐 Upgrade Safety',access_control:'🔑 Access Control'};
  let html='';
  for(const[key,val] of Object.entries(results)){
    const title=titles[key]||key;
    let content='';
    if(val.error){content=`<div style="color:var(--red)">${val.error}</div>`;}
    else if(typeof val==='string'){content=`<div class="result-content">${escHtml(val)}</div>`;}
    else if(val.natspec||val.output||val.result||val.suggestion||val.tests||val.gas_hints||val.access_findings){
      const text=val.natspec||val.output||val.result||val.suggestion||val.tests||JSON.stringify(val.gas_hints||val.access_findings||val,null,2);
      content=`<div class="result-content">${escHtml(typeof text==='string'?text:JSON.stringify(text,null,2))}</div>`;
    }else{
      content=`<div class="result-content">${escHtml(JSON.stringify(val,null,2))}</div>`;
    }
    html+=`<div class="result-block"><div class="result-title">${title}</div>${content}</div>`;
  }
  pane.innerHTML=html||'<div class="loading">No results</div>';
}

function escHtml(s){const d=document.createElement('div');d.textContent=String(s||'');return d.innerHTML;}

// Load status
async function loadStatus(){
  try{
    const res=await fetch('/api/dev/status');
    const data=await res.json();
    const badge=document.getElementById('status-badge');
    if(badge){
      badge.textContent=`${data.agents_loaded.length} AGENTS`;
    }
  }catch(_){}
}
loadStatus();

// Ctrl+Enter to analyze
document.addEventListener('keydown',(e)=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')analyzeCode();});
</script>
</body>
</html>"""


# ── Startup ─────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    agents = _get_dev_agents()
    print(f"""
╔══════════════════════════════════════════════════════════╗
║  SRP Dev Server — Port {PORT}                              ║
║  {len(agents)} Dev Agents Active                              ║
║  http://localhost:{PORT}                                  ║
╚══════════════════════════════════════════════════════════╝""")
    print(f"  Agents: {', '.join(agents.keys()) or 'none loaded'}")
    print(f"  Project: {PROJECT_ROOT}\n")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT, reload=False)

