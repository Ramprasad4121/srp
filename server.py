"""
SRP Web UI — Read-Only Localhost Visualization

The Web UI is secondary to the CLI. It:
- Visualizes flows, invariants, hypotheses, traces
- Is read-only by default
- Can request human approval when policy requires
- NEVER executes reasoning directly
- Runs on localhost only (not cloud, not centralized)

Start: python web/server.py
Access: http://localhost:8404
"""

import json
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse


PORT = 8404
TRACES_DIR = Path("srp-traces")
OUTPUTS_DIR = Path("srp-outputs")


class SRPHandler(BaseHTTPRequestHandler):

    def do_GET(self):
        path = urlparse(self.path).path

        if path == "/" or path == "/index.html":
            self._serve_dashboard()
        elif path == "/api/traces":
            self._serve_traces()
        elif path.startswith("/api/trace/"):
            trace_id = path.split("/")[-1]
            self._serve_trace(trace_id)
        elif path == "/api/status":
            self._serve_status()
        else:
            self._not_found()

    def _serve_dashboard(self):
        html = self._build_dashboard_html()
        self._respond(200, html.encode(), "text/html")

    def _serve_traces(self):
        traces = []
        if TRACES_DIR.exists():
            for f in sorted(TRACES_DIR.glob("*.json"), reverse=True):
                if "-intent" not in f.name and "payments" not in f.name and "executions" not in f.name:
                    try:
                        with open(f) as tf:
                            data = json.load(tf)
                        traces.append({
                            "trace_id": data.get("trace_id", "")[:16],
                            "intent_hash": data.get("intent_hash", "")[:16],
                            "confidence": data.get("execution", {}).get("confidence", 0),
                            "findings": len(data.get("findings", [])),
                            "passes": len(data.get("reasoning_passes", [])),
                            "completed_at": data.get("execution", {}).get("completed_at", ""),
                            "file": f.name,
                        })
                    except Exception:
                        continue
        self._respond(200, json.dumps(traces).encode(), "application/json")

    def _serve_trace(self, trace_id: str):
        for f in TRACES_DIR.glob("*.json"):
            if trace_id in f.name:
                with open(f) as tf:
                    data = json.load(tf)
                self._respond(200, json.dumps(data).encode(), "application/json")
                return
        self._not_found()

    def _serve_status(self):
        status = {
            "srp_version": "0.1",
            "erc8004": "local-mode",
            "x402": "local-mode",
            "agent": "openclaw",
            "model": "moonshotai/kimi-k2.5",
            "traces": len(list(TRACES_DIR.glob("*.json"))) if TRACES_DIR.exists() else 0,
        }
        self._respond(200, json.dumps(status).encode(), "application/json")

    def _respond(self, code: int, body: bytes, content_type: str):
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", len(body))
        self.send_header("Access-Control-Allow-Origin", "http://localhost:8404")
        self.end_headers()
        self.wfile.write(body)

    def _not_found(self):
        self._respond(404, b'{"error": "not found"}', "application/json")

    def log_message(self, format, *args):
        pass  # Suppress request logs

    def _build_dashboard_html(self) -> str:
        return """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SRP — Security Reasoning Protocol</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'JetBrains Mono', 'Fira Code', monospace; background: #0a0a0f; color: #e2e8f0; min-height: 100vh; }
  .header { background: #111827; border-bottom: 1px solid #1e3a5f; padding: 16px 32px; display: flex; align-items: center; gap: 16px; }
  .logo { font-size: 20px; font-weight: 700; color: #60a5fa; letter-spacing: 2px; }
  .subtitle { font-size: 12px; color: #6b7280; }
  .badge { background: #1e3a5f; color: #60a5fa; padding: 2px 8px; border-radius: 4px; font-size: 10px; border: 1px solid #2563eb; }
  .main { padding: 32px; max-width: 1400px; margin: 0 auto; }
  .notice { background: #1a1a2e; border: 1px solid #2563eb; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; font-size: 12px; color: #93c5fd; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
  .card { background: #111827; border: 1px solid #1e293b; border-radius: 8px; padding: 20px; }
  .card-title { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .card-value { font-size: 28px; font-weight: 700; color: #60a5fa; }
  .card-sub { font-size: 11px; color: #4b5563; margin-top: 4px; }
  .section { margin-bottom: 32px; }
  .section-title { font-size: 14px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #1e293b; }
  .trace-row { background: #111827; border: 1px solid #1e293b; border-radius: 6px; padding: 16px; margin-bottom: 8px; display: grid; grid-template-columns: 180px 180px 80px 60px 60px 1fr; gap: 16px; align-items: center; font-size: 12px; }
  .trace-row:hover { border-color: #2563eb; }
  .hash { color: #60a5fa; font-family: monospace; }
  .confidence-high { color: #34d399; }
  .confidence-mid { color: #fbbf24; }
  .confidence-low { color: #f87171; }
  .severity-critical { color: #ef4444; font-weight: 700; }
  .severity-high { color: #f97316; }
  .tag { background: #1e293b; color: #94a3b8; padding: 2px 6px; border-radius: 3px; font-size: 10px; }
  .empty { color: #374151; font-size: 13px; text-align: center; padding: 40px; }
  .cli-block { background: #0d1117; border: 1px solid #21262d; border-radius: 8px; padding: 20px; font-size: 12px; color: #8b949e; }
  .cli-block .cmd { color: #79c0ff; }
  .cli-block .comment { color: #3d444d; }
  .protocol-tags { display: flex; gap: 8px; flex-wrap: wrap; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">⬡ SRP</div>
    <div class="subtitle">Security Reasoning Protocol</div>
  </div>
  <div class="protocol-tags">
    <span class="badge">ERC-8004</span>
    <span class="badge">x402 V2</span>
    <span class="badge">OpenClaw</span>
    <span class="badge">READ-ONLY</span>
  </div>
</div>

<div class="main">
  <div class="notice">
    ⚠️ This UI is read-only. All execution happens through the CLI. This dashboard visualizes traces and findings only.
    Use <code>srp analyze &lt;target&gt;</code> to generate new traces.
  </div>

  <div class="grid" id="stats">
    <div class="card"><div class="card-title">Total Traces</div><div class="card-value" id="stat-traces">—</div><div class="card-sub">Executed</div></div>
    <div class="card"><div class="card-title">Avg Confidence</div><div class="card-value" id="stat-confidence">—</div><div class="card-sub">Across all runs</div></div>
    <div class="card"><div class="card-title">Total Findings</div><div class="card-value" id="stat-findings">—</div><div class="card-sub">Across all traces</div></div>
    <div class="card"><div class="card-title">Protocol</div><div class="card-value" style="font-size:16px; color:#34d399;">SRP v0.1</div><div class="card-sub">ERC-8004 + x402</div></div>
  </div>

  <div class="section">
    <div class="section-title">Reasoning Traces</div>
    <div id="traces-list"></div>
  </div>

  <div class="section">
    <div class="section-title">CLI Quick Reference</div>
    <div class="cli-block">
      <div><span style="color:#3d444d"># Initialize SRP</span></div>
      <div><span class="cmd">srp init</span></div>
      <br>
      <div><span style="color:#3d444d"># Set protocol context</span></div>
      <div><span class="cmd">srp context set protocol=lending chain=ethereum</span></div>
      <div><span class="cmd">srp assume oracle=manipulable flash-loans=enabled</span></div>
      <br>
      <div><span style="color:#3d444d"># Run analysis (ERC-8004 + x402 enforced)</span></div>
      <div><span class="cmd">srp analyze contracts/ --budget 5.0 --depth 3</span></div>
      <br>
      <div><span style="color:#3d444d"># Export and verify</span></div>
      <div><span class="cmd">srp export report</span></div>
      <div><span class="cmd">srp verify --trace srp-traces/&lt;id&gt;.json</span></div>
    </div>
  </div>
</div>

<script>
async function loadData() {
  try {
    const [statusRes, tracesRes] = await Promise.all([
      fetch('/api/status'),
      fetch('/api/traces')
    ]);
    const status = await statusRes.json();
    const traces = await tracesRes.json();

    document.getElementById('stat-traces').textContent = traces.length;

    const avgConf = traces.length > 0
      ? (traces.reduce((a, t) => a + t.confidence, 0) / traces.length * 100).toFixed(0) + '%'
      : '—';
    document.getElementById('stat-confidence').textContent = avgConf;

    const totalFindings = traces.reduce((a, t) => a + t.findings, 0);
    document.getElementById('stat-findings').textContent = totalFindings;

    const list = document.getElementById('traces-list');
    if (traces.length === 0) {
      list.innerHTML = '<div class="empty">No traces yet. Run <code>srp analyze &lt;target&gt;</code> to start.</div>';
      return;
    }

    list.innerHTML = traces.map(t => {
      const confColor = t.confidence > 0.8 ? 'confidence-high' : t.confidence > 0.5 ? 'confidence-mid' : 'confidence-low';
      return `
        <div class="trace-row">
          <div><span class="hash">${t.trace_id}...</span></div>
          <div><span class="hash" style="color:#818cf8">${t.intent_hash}...</span></div>
          <div class="${confColor}">${(t.confidence * 100).toFixed(0)}%</div>
          <div style="color:#60a5fa">${t.passes} passes</div>
          <div style="color:#f87171">${t.findings} findings</div>
          <div style="color:#374151; font-size:10px">${t.completed_at ? new Date(t.completed_at).toLocaleString() : '—'}</div>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error('Failed to load SRP data:', e);
  }
}

loadData();
setInterval(loadData, 10000);
</script>
</body>
</html>"""


def main():
    print(f"[SRP Web UI] Starting on http://localhost:{PORT}")
    print(f"[SRP Web UI] READ-ONLY — Visualization only")
    print(f"[SRP Web UI] Use CLI for all execution: srp analyze <target>")
    print(f"[SRP Web UI] Press Ctrl+C to stop\n")

    server = HTTPServer(("127.0.0.1", PORT), SRPHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[SRP Web UI] Stopped")


if __name__ == "__main__":
    main()
