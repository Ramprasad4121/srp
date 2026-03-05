const API_BASE = "http://localhost:7337";
const WS_URL = "ws://localhost:7337/ws/audit";

const AGENT_CODENAMES = {
    "SentinelAgent":    { codename: "WATCHDOG",  color: "#ff6b35" },
    "ThreatIntelAgent": { codename: "ORACLE",    color: "#9b59b6" },
    "GraphAgent":       { codename: "SPIDER",    color: "#1abc9c" },
    "AttackAgentAlpha": { codename: "VIPER",     color: "#e74c3c" },
    "AttackAgentBeta":  { codename: "GHOST",     color: "#95a5a6" },
    "AttackAgentGamma": { codename: "ZERO",      color: "#e67e22" },
    "DefenseAgent":     { codename: "SHIELD",    color: "#3498db" },
    "PatchAgent":       { codename: "FORGE",     color: "#f39c12" },
    "BlastRadiusAgent": { codename: "SHOCKWAVE", color: "#e74c3c" },
    "ForkAgent":        { codename: "MIRROR",    color: "#2ecc71" },
    "DiffAgent":        { codename: "DELTA",     color: "#00d4ff" },
    "OrchestratorAgent":{ codename: "COMMAND",   color: "#00ff88" },
    "TraceAgent":       { codename: "LEDGER",    color: "#bdc3c7" },
};

// Usage: show "VIPER (AttackAgentAlpha)" in UI
function getAgentDisplay(agentName) {
    const info = AGENT_CODENAMES[agentName];
    if (!info) return agentName;
    return `<span style="color:${info.color};font-weight:bold">${info.codename}</span> <span style="opacity:0.5;font-size:11px">${agentName}</span>`;
}

const DEFAULT_SKILL = {
  name: "solidity-auditor",
  source: "audit-skills",
  status: "ACTIVE",
};
const FIRM_META = {
  audit-firm-1: { label: "Pashov", className: "firm-audit-firm-1" },
  quillai: { label: "QuillAI", className: "firm-quillai" },
  trailofbits: { label: "TrailOfBits", className: "firm-trailofbits" },
  ethskills: { label: "EthSkills", className: "firm-ethskills" },
  cyfrin: { label: "Cyfrin", className: "firm-cyfrin" },
  scvscan: { label: "KadenZipfel", className: "firm-kadenzipfel" },
  archethect: { label: "Archethect", className: "firm-archethect" },
  unknown: { label: "Unknown", className: "firm-unknown" },
};
const SKILLS_ARSENAL_BY_AGENT = {
  ReconAgent: ["sc-auditor-skill", "tob-entry-point", "tob-audit-context"],
  ForkAgent: ["ethskills-concepts", "tob-audit-context"],
  AttackAgentAlpha: [
    "audit-firm-1-solidity-auditor",
    "quillai-bsa",
    "quillai-semantic-guard",
    "quillai-state-invariant",
  ],
  AttackAgentBeta: [
    "quillai-reentrancy",
    "quillai-oracle-flashloan",
    "quillai-proxy-upgrade",
    "ethskills-audit",
    "tob-building-secure",
  ],
  AttackAgentGamma: [
    "quillai-signature-replay",
    "quillai-dos-griefing",
    "quillai-external-call",
    "quillai-input-arithmetic",
    "scv-scan",
  ],
  DefenseAgent: ["audit-firm-1-solidity-auditor", "tob-spec-compliance"],
  PatchAgent: ["cyfrin-solskill", "ethskills-security", "ethskills-testing", "tob-fix-review"],
  SentinelAgent: ["audit-firm-1-solidity-auditor", "ethskills-concepts"],
  ThreatIntelAgent: ["ethskills-concepts"],
  BlastRadiusAgent: ["tob-variant-analysis"],
  DiffAgent: ["tob-differential-review", "audit-firm-1-solidity-auditor"],
  GraphAgent: ["ethskills-standards", "ethskills-concepts"],
  OrchestratorAgent: ["ethskills-standards", "ethskills-concepts"],
};
const LIVE_CARD_SKILLS = {
  IntentAgent: ["ethskills-concepts"],
  ReconAgent: ["sc-auditor-skill", "tob-entry-point", "tob-audit-context"],
  AttackAgent: ["audit-firm-1-solidity-auditor", "quillai-bsa", "scv-scan"],
  DefenseAgent: ["audit-firm-1-solidity-auditor", "tob-spec-compliance", "cyfrin-solskill"],
  TraceAgent: ["ethskills-standards"],
  ReportAgent: ["ethskills-concepts"],
};

const AGENTS = [
  {
    id: "IntentAgent",
    short: "Intent",
    role: "Parses user input and builds a structured execution intent",
  },
  {
    id: "ReconAgent",
    short: "Recon",
    role: "Maps contract architecture and identifies entry points",
  },
  {
    id: "AttackAgent",
    short: "Attack",
    role: "Red team exploit discovery",
  },
  {
    id: "DefenseAgent",
    short: "Defense",
    role: "Blue team validation and fixes",
  },
  {
    id: "TraceAgent",
    short: "Trace",
    role: "Cryptographic trace generation",
  },
  {
    id: "ReportAgent",
    short: "Report",
    role: "Professional markdown report compilation",
  },
];

const state = {
  startedAt: Date.now(),
  latestResult: null,
  latestTraceId: null,
  latestReportMd: "",
  traceCache: new Map(),
  ws: null,
  statusByAgent: Object.fromEntries(AGENTS.map((a) => [a.id, "waiting"])),
  currentSkill: { ...DEFAULT_SKILL },
  skillsManifest: null,
  skillsHealth: null,
  skillsHealthLastCheckedAt: 0,
};

const el = {
  pages: Array.from(document.querySelectorAll(".page")),
  navItems: Array.from(document.querySelectorAll(".nav-item")),
  latestResultsBtn: document.getElementById("latest-results-btn"),

  auditDescription: document.getElementById("audit-description"),
  contractCode: document.getElementById("contract-code"),
  budgetSlider: document.getElementById("budget-slider"),
  budgetValue: document.getElementById("budget-value"),
  launchAuditBtn: document.getElementById("launch-audit-btn"),
  activeSkillName: document.getElementById("active-skill-name"),
  activeSkillSource: document.getElementById("active-skill-source"),
  activeSkillBadge: document.getElementById("active-skill-badge"),
  skillsArsenalBody: document.getElementById("skills-arsenal-body"),

  pipelineTrack: document.getElementById("pipeline-track"),
  vsBattle: document.getElementById("vs-battle"),
  liveLog: document.getElementById("live-log"),

  scoreGauge: document.getElementById("score-gauge"),
  scoreValue: document.getElementById("score-value"),
  resultSummary: document.getElementById("result-summary"),
  vulnerabilityList: document.getElementById("vulnerability-list"),
  viewReportBtn: document.getElementById("view-report-btn"),
  viewTraceBtn: document.getElementById("view-trace-btn"),
  exportReportBtn: document.getElementById("export-report-btn"),

  refreshTracesBtn: document.getElementById("refresh-traces-btn"),
  tracesTableBody: document.getElementById("traces-table-body"),
  traceDetail: document.getElementById("trace-detail"),
  traceSkillsBody: document.getElementById("trace-skills-body"),

  reportTraceId: document.getElementById("report-trace-id"),
  loadReportBtn: document.getElementById("load-report-btn"),
  refreshReportsBtn: document.getElementById("refresh-reports-btn"),
  reportList: document.getElementById("report-list"),
  reportContent: document.getElementById("report-content"),

  systemIndicator: document.getElementById("system-indicator"),
  systemIndicatorText: document.getElementById("system-indicator-text"),
  agentStatusGrid: document.getElementById("agent-status-grid"),
  policyStatus: document.getElementById("policy-status"),
  budgetStatus: document.getElementById("budget-status"),
  versionStatus: document.getElementById("version-status"),
  uptimeStatus: document.getElementById("uptime-status"),
  refreshSkillsHealthBtn: document.getElementById("refresh-skills-health-btn"),
  skillsHealthSummary: document.getElementById("skills-health-summary"),
  skillsHealthList: document.getElementById("skills-health-list"),
};

function init() {
  renderPipeline();
  renderSkillSection();
  renderSkillsArsenalTable();
  renderStatusCards();
  bindEvents();
  refreshBudgetValue();
  loadSystemStatus();
  loadSkillsManifest();
  loadSkillsHealth();
  loadTraces();
  loadReports();
  setInterval(updateUptime, 1000);
  updateUptime();
}

function bindEvents() {
  el.navItems.forEach((item) => {
    item.addEventListener("click", () => {
      setActivePage(item.dataset.page);
      el.navItems.forEach((nav) => nav.classList.toggle("active", nav === item));
      if (item.dataset.page === "traces-page") {
        loadTraces();
      }
      if (item.dataset.page === "reports-page") {
        loadReports();
      }
      if (item.dataset.page === "status-page") {
        renderStatusCards();
        loadSkillsHealth();
      }
    });
  });

  el.latestResultsBtn.addEventListener("click", () => {
    setActivePage("results-page");
    el.navItems.forEach((nav) => nav.classList.remove("active"));
  });

  el.budgetSlider.addEventListener("input", refreshBudgetValue);
  el.launchAuditBtn.addEventListener("click", launchAudit);
  if (el.refreshSkillsHealthBtn) {
    el.refreshSkillsHealthBtn.addEventListener("click", () => loadSkillsHealth(true));
  }

  el.refreshTracesBtn.addEventListener("click", loadTraces);
  el.loadReportBtn.addEventListener("click", () => {
    const traceId = (el.reportTraceId.value || "").trim();
    if (!traceId) {
      appendGlobalLog("Provide a trace id to load report.", "error");
      return;
    }
    openReport(traceId);
  });
  el.refreshReportsBtn.addEventListener("click", loadReports);

  el.viewReportBtn.addEventListener("click", () => {
    if (!state.latestTraceId) {
      appendGlobalLog("No trace id available for report.", "error");
      return;
    }
    window.open(`${API_BASE}/api/reports/${state.latestTraceId}`, "_blank", "noopener");
  });

  el.viewTraceBtn.addEventListener("click", () => {
    if (!state.latestTraceId) {
      appendGlobalLog("No trace id available.", "error");
      return;
    }
    window.open(`${API_BASE}/api/traces/${state.latestTraceId}`, "_blank", "noopener");
  });

  el.exportReportBtn.addEventListener("click", exportLatestReport);
}

function setActivePage(pageId) {
  el.pages.forEach((page) => page.classList.toggle("active", page.id === pageId));
}

function refreshBudgetValue() {
  el.budgetValue.textContent = `$${Number(el.budgetSlider.value).toFixed(0)}`;
}

function renderPipeline() {
  el.pipelineTrack.innerHTML = "";

  AGENTS.forEach((agent) => {
    const card = document.createElement("article");
    card.className = "agent-card";
    card.id = `agent-${agent.id}`;
    card.innerHTML = `
      <div class="agent-header">
        <div class="agent-title">${agent.short}</div>
        <span class="agent-status status-waiting" id="agent-status-${agent.id}">waiting</span>
      </div>
      <div class="agent-role">${agent.role}</div>
      <div class="agent-skill-dots hidden" id="agent-skill-dots-${agent.id}"></div>
      <ul class="agent-feed" id="agent-feed-${agent.id}"></ul>
    `;

    el.pipelineTrack.appendChild(card);
  });

  updateAgentSkillBadges();
}

function renderStatusCards() {
  el.agentStatusGrid.innerHTML = "";

  AGENTS.forEach((agent) => {
    const status = state.statusByAgent[agent.id] || "waiting";
    const isGreen = status === "running" || status === "complete";

    const card = document.createElement("div");
    card.className = "status-card";
    card.innerHTML = `
      <div class="status-top">
        <strong>${agent.short}</strong>
        <span class="status-dot ${isGreen ? "green" : "red"}"></span>
      </div>
      <div class="status-role">${agent.role}</div>
      <div>${status}</div>
    `;

    el.agentStatusGrid.appendChild(card);
  });
}

async function launchAudit() {
  const rawInput = (el.auditDescription.value || "").trim();
  const contractCode = (el.contractCode.value || "").trim();
  const budgetUsd = Number(el.budgetSlider.value);

  if (!rawInput) {
    appendGlobalLog("Audit description is required.", "error");
    return;
  }
  if (!contractCode) {
    appendGlobalLog("Contract code is required.", "error");
    return;
  }

  resetAuditDisplay();
  el.launchAuditBtn.disabled = true;
  el.launchAuditBtn.textContent = "MISSION IN PROGRESS...";
  setActivePage("audit-page");

  try {
    if (state.ws) {
      try {
        state.ws.close();
      } catch (_ignored) {
      }
      state.ws = null;
    }

    const ws = new WebSocket(WS_URL);
    state.ws = ws;

    ws.onopen = () => {
      appendGlobalLog("Connected to mission WebSocket.");
      ws.send(
        JSON.stringify({
          raw_input: rawInput,
          contract_code: contractCode,
          budget_usd: budgetUsd,
        })
      );
      appendGlobalLog("Audit payload sent. Awaiting agent execution.");
    };

    ws.onmessage = (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch (_ignored) {
        appendGlobalLog("Received non-JSON message.", "error");
        return;
      }
      handleSocketEvent(payload);
      if (payload.event === "broadcast") {
        if (payload.type === "contract_done") {
          updateContractProgress(payload.data);
        }
        if (payload.type === "phase_start") {
          updatePhaseIndicator(payload.data.phase);
        }
        if (payload.type === "emergency_alert") {
          const banner = document.createElement("div");
          banner.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
            background: #ff0033; color: white; padding: 20px;
            font-family: monospace; font-size: 16px; font-weight: bold;
            text-align: center; box-shadow: 0 4px 20px rgba(255,0,0,0.5);
          `;
          banner.innerHTML = `
            🚨 CRITICAL VULNERABILITY CONFIRMED 🚨<br>
            <span style="font-size:14px;font-weight:normal">
                ${payload.data.critical_count} agents independently confirmed: ${payload.data.contract}<br>
                Audit halted. Immediate attention required.
            </span>
          `;
          document.body.prepend(banner);

          let flash = true;
          setInterval(() => {
            document.title = flash ? '🚨 CRITICAL — SRP' : 'SRP Security Dashboard';
            flash = !flash;
          }, 800);
        }
      }
    };

    ws.onerror = () => {
      appendGlobalLog("WebSocket transport error.", "error");
    };

    ws.onclose = () => {
      state.ws = null;
      el.launchAuditBtn.disabled = false;
      el.launchAuditBtn.textContent = "LAUNCH AUDIT";
    };
  } catch (error) {
    appendGlobalLog(`Failed to start audit: ${error.message}`, "error");
    el.launchAuditBtn.disabled = false;
    el.launchAuditBtn.textContent = "LAUNCH AUDIT";
  }
}

async function startAudit() {
  try {
    const response = await fetch('/api/audit/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    console.log('Audit started:', data);
    const agentPipeline = document.getElementById('agent-pipeline');
    if (agentPipeline) {
      agentPipeline.style.display = 'block';
    }
  } catch (error) {
    console.error('Failed to auto-start audit:', error);
  }
}

async function loadProject() {
  try {
    const response = await fetch('/api/project');
    const project = await response.json();
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === 'true') {
      setTimeout(() => startAudit(), 500);
    }
    return project;
  } catch (error) {
    console.warn('Project auto-start check failed:', error);
    return null;
  }
}

function resetAuditDisplay() {
  state.latestResult = null;
  state.latestTraceId = null;
  state.latestReportMd = "";
  state.currentSkill = { ...DEFAULT_SKILL };

  AGENTS.forEach((agent) => {
    setAgentStatus(agent.id, "waiting");
    const feed = document.getElementById(`agent-feed-${agent.id}`);
    if (feed) {
      feed.innerHTML = "";
    }
  });

  el.liveLog.innerHTML = "";
  el.vsBattle.classList.remove("active");
  renderSkillSection();
  renderStatusCards();
}

function setAgentStatus(agentId, status) {
  state.statusByAgent[agentId] = status;
  const badge = document.getElementById(`agent-status-${agentId}`);
  if (!badge) {
    return;
  }

  badge.className = `agent-status status-${status}`;
  badge.textContent = status;
  updateAgentSkillBadges();
  renderStatusCards();
  updateVsBattleState();
}

function updateVsBattleState() {
  const attackState = state.statusByAgent.AttackAgent;
  const defenseState = state.statusByAgent.DefenseAgent;
  const activeStates = ["running", "complete"];

  if (activeStates.includes(attackState) && activeStates.includes(defenseState)) {
    el.vsBattle.classList.add("active");
  } else {
    el.vsBattle.classList.remove("active");
  }
}

function appendAgentStep(agentId, text) {
  const feed = document.getElementById(`agent-feed-${agentId}`);
  if (!feed) {
    return;
  }

  const item = document.createElement("li");
  item.textContent = text;
  feed.appendChild(item);

  while (feed.children.length > 20) {
    feed.removeChild(feed.firstChild);
  }

  feed.scrollTop = feed.scrollHeight;
}

function appendGlobalLog(message, type = "") {
  const line = document.createElement("div");
  line.className = `log-line ${type}`.trim();
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  el.liveLog.appendChild(line);

  while (el.liveLog.children.length > 200) {
    el.liveLog.removeChild(el.liveLog.firstChild);
  }

  el.liveLog.scrollTop = el.liveLog.scrollHeight;
}

function handleSocketEvent(payload) {
  const { event, agent, data, result } = payload;
  maybeCaptureSkillMetadata(data);

  if (event === "agent_start") {
    setAgentStatus(agent, "running");
    appendAgentStep(agent, "Mission stage started");
    appendGlobalLog(`${agent} started.`);
    return;
  }

  if (event === "step") {
    const text = formatStepMessage(data);
    if (agent && state.statusByAgent[agent] === "waiting") {
      setAgentStatus(agent, "running");
    }
    if (agent) {
      appendAgentStep(agent, text);
    }

    if (data && data.status === "failed") {
      setAgentStatus(agent, "failed");
      appendGlobalLog(`${agent} failed: ${safeString(data.details || data.error || "unknown")}`, "error");
    } else {
      appendGlobalLog(`${agent || "system"}: ${text}`);
    }
    return;
  }

  if (event === "agent_complete") {
    setAgentStatus(agent, "complete");
    appendAgentStep(agent, "Mission stage complete");
    appendGlobalLog(`${agent} complete.`, "complete");
    return;
  }

  if (event === "complete") {
    appendGlobalLog("Audit mission completed successfully.", "complete");
    maybeCaptureSkillMetadata(result);
    AGENTS.forEach((a) => {
      if (state.statusByAgent[a.id] !== "failed") {
        setAgentStatus(a.id, "complete");
      }
    });
    renderResults(result || {});
    setActivePage("results-page");
    el.latestResultsBtn.classList.remove("hidden");

    if (state.ws) {
      state.ws.close();
    }
    return;
  }
}

function updateContractProgress(msg) {
  const pct = msg.total ? Math.round((msg.done / msg.total) * 100) : 0;
  const bar = document.getElementById("audit-progress-bar");
  const label = document.getElementById("audit-progress-label");
  if (bar) bar.style.width = pct + "%";
  if (label)
    label.textContent = `${msg.done}/${msg.total} contracts scanned — ${msg.findings} findings so far`;
}

function updatePhaseIndicator(phase) {
  const phases = ["recon", "fork_check", "attack", "defense", "patch", "trace"];
  phases.forEach((p) => {
    const el = document.getElementById(`phase-${p}`);
    if (!el) return;
    if (p === phase) {
      el.className = "phase-item active";
    } else if (phases.indexOf(p) < phases.indexOf(phase)) {
      el.className = "phase-item done";
    } else {
      el.className = "phase-item";
    }
  });
}

function formatStepMessage(data) {
  if (!data) {
    return "step";
  }

  if (typeof data === "string") {
    return data;
  }

  if (data.step) {
    return `${data.step}${data.data ? ` | ${safeString(data.data)}` : ""}`;
  }

  if (data.error) {
    return `${data.error}${data.details ? ` | ${safeString(data.details)}` : ""}`;
  }

  return safeString(data);
}

function safeString(value) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch (_ignored) {
    return String(value);
  }
}

function renderResults(result) {
  state.latestResult = result || {};
  maybeCaptureSkillMetadata(result);

  const trace = result.trace || {};
  const report = result.report || {};
  const attack = result.attack || {};
  const defense = result.defense || {};

  state.latestTraceId = trace.trace_id || null;
  state.latestReportMd = report.report_md || "";

  const score = normalizeScore(defense.overall_security_score);
  renderScore(score);

  const vulnerabilities = mergeVulnerabilities(
    Array.isArray(attack.vulnerabilities) ? attack.vulnerabilities : [],
    Array.isArray(defense.reviewed_vulnerabilities) ? defense.reviewed_vulnerabilities : []
  );
  renderVulnerabilityList(vulnerabilities);

  el.resultSummary.textContent =
    report.summary || attack.attack_summary || "Audit completed. Review findings and remediation guidance.";

  updateStatusPanelsFromResult(result);
}

function normalizeScore(value) {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return Math.max(0, Math.min(100, Math.round(parsed)));
  }
  return 0;
}

function renderScore(score) {
  el.scoreValue.textContent = String(score);
  el.scoreGauge.style.setProperty("--score", score);

  let color = "var(--green)";
  if (score < 80) {
    color = "var(--yellow)";
  }
  if (score < 60) {
    color = "var(--orange)";
  }
  if (score < 40) {
    color = "var(--red)";
  }

  el.scoreGauge.style.background = `conic-gradient(${color} ${score}%, #1b2741 0)`;
  el.scoreValue.style.color = color;
}

function mergeVulnerabilities(vulnerabilities, reviewedVulnerabilities) {
  const reviewMap = new Map(
    reviewedVulnerabilities.map((item) => [item.original_id, item])
  );

  return vulnerabilities.map((vulnerability, index) => {
    const review = reviewMap.get(vulnerability.id) || {};
    const severity = (review.final_severity || vulnerability.severity || "medium").toLowerCase();

    return {
      id: vulnerability.id || `v-${index + 1}`,
      title: vulnerability.title || `Vulnerability ${index + 1}`,
      severity,
      affectedFunction: vulnerability.affected_function || "unknown",
      description: vulnerability.description || "No description provided.",
      exploitCode: vulnerability.exploit_code || "// No exploit code provided",
      fixCode: review.fix_code || "// No fix code provided",
      defenseNotes: review.defense_notes || "No defense notes provided.",
      status: review.status || "needs_more_info",
      confidence: Number(vulnerability.confidence || 0),
    };
  });
}

function renderVulnerabilityList(vulnerabilities) {
  el.vulnerabilityList.innerHTML = "";

  if (!vulnerabilities.length) {
    el.vulnerabilityList.innerHTML = "<div class=\"panel\">No vulnerabilities reported.</div>";
    return;
  }

  vulnerabilities.forEach((vulnerability) => {
    const item = document.createElement("article");
    item.className = `vuln-item severity-${severityClass(vulnerability.severity)}`;

    const header = document.createElement("button");
    header.className = "vuln-header";
    header.type = "button";
    header.innerHTML = `
      <div class="vuln-left">
        <div class="vuln-title">${escapeHtml(vulnerability.title)}</div>
        <div class="vuln-sub">${escapeHtml(vulnerability.affectedFunction)} - status: ${escapeHtml(vulnerability.status)} - confidence ${vulnerability.confidence.toFixed(2)}</div>
      </div>
      <span class="severity-badge">${escapeHtml(vulnerability.severity)}</span>
    `;

    const body = document.createElement("div");
    body.className = "vuln-body";
    body.innerHTML = `
      <div><strong>Description</strong><br/>${escapeHtml(vulnerability.description)}</div>
      <div><strong>Exploit Code</strong></div>
      <pre class="code-block">${escapeHtml(vulnerability.exploitCode)}</pre>
      <div><strong>Recommended Fix</strong></div>
      <pre class="code-block">${escapeHtml(vulnerability.fixCode)}</pre>
      <div><strong>Defense Notes</strong><br/>${escapeHtml(vulnerability.defenseNotes)}</div>
    `;

    header.addEventListener("click", () => {
      item.classList.toggle("open");
    });

    item.appendChild(header);
    item.appendChild(body);
    el.vulnerabilityList.appendChild(item);
  });
}

function severityClass(severity) {
  const value = String(severity || "medium").toLowerCase();
  if (["critical", "high", "medium", "low"].includes(value)) {
    return value;
  }
  return "medium";
}

function escapeHtml(input) {
  const str = String(input || "");
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function loadTraces() {
  try {
    const response = await fetch(`${API_BASE}/api/traces`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const traces = await response.json();
    el.tracesTableBody.innerHTML = "";

    if (!Array.isArray(traces) || traces.length === 0) {
      el.tracesTableBody.innerHTML =
        "<tr><td colspan=\"6\">No traces available yet.</td></tr>";
      if (el.traceSkillsBody) {
        el.traceSkillsBody.innerHTML =
          "<tr><td colspan=\"4\">No traces available yet.</td></tr>";
      }
      return;
    }

    for (const trace of traces) {
      const traceId = trace.trace_id;
      const detail = await getTraceDetail(traceId);

      const contractName = extractContractName(detail);
      const score = extractScore(detail);
      const status = extractTraceStatus(detail);
      const date = formatDate(trace.timestamp || detail.timestamp);

      const row = document.createElement("tr");
      row.className = "trace-row";
      row.innerHTML = `
        <td>${escapeHtml(traceId)}</td>
        <td>${escapeHtml(date)}</td>
        <td>${escapeHtml(contractName)}</td>
        <td>${escapeHtml(score)}</td>
        <td>${escapeHtml(status)}</td>
        <td><button class="ghost-button replay-btn" type="button">Replay</button></td>
      `;

      row.addEventListener("click", () => viewTraceDetail(traceId));

      const replayButton = row.querySelector(".replay-btn");
      replayButton.addEventListener("click", (event) => {
        event.stopPropagation();
        replayTrace(traceId);
      });

      el.tracesTableBody.appendChild(row);
    }
  } catch (error) {
    el.tracesTableBody.innerHTML = `<tr><td colspan=\"6\">Failed to load traces: ${escapeHtml(
      error.message
    )}</td></tr>`;
    if (el.traceSkillsBody) {
      el.traceSkillsBody.innerHTML =
        "<tr><td colspan=\"4\">Failed to load trace skills.</td></tr>";
    }
  }
}

async function getTraceDetail(traceId) {
  if (state.traceCache.has(traceId)) {
    return state.traceCache.get(traceId);
  }

  try {
    const response = await fetch(`${API_BASE}/api/traces/${traceId}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const detail = await response.json();
    state.traceCache.set(traceId, detail);
    return detail;
  } catch (_error) {
    return {};
  }
}

function extractContractName(trace) {
  if (!trace || !Array.isArray(trace.all_steps)) {
    return "unknown";
  }

  const inputStep = trace.all_steps.find((step) => step.step === "intent_inputs_extracted");
  if (inputStep && inputStep.data && Array.isArray(inputStep.data.contract_paths)) {
    const first = inputStep.data.contract_paths[0] || "unknown";
    const fragments = String(first).split("/");
    return fragments[fragments.length - 1] || "unknown";
  }

  return "unknown";
}

function extractScore(trace) {
  if (!trace) {
    return "N/A";
  }

  const confidence = Number(trace.confidence);
  if (Number.isFinite(confidence)) {
    return `${Math.round(confidence * 100)}`;
  }

  return "N/A";
}

function extractTraceStatus(trace) {
  if (!trace) {
    return "unknown";
  }

  if (trace.x402_tx) {
    return "settled";
  }

  if (trace.erc8004_agent_id) {
    return "verified";
  }

  return "local";
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

async function viewTraceDetail(traceId) {
  const detail = await getTraceDetail(traceId);
  el.traceDetail.textContent = JSON.stringify(detail, null, 2);
  renderTraceSkillsTable(detail);
}

async function replayTrace(traceId) {
  const detail = await getTraceDetail(traceId);

  const inputStep = Array.isArray(detail.all_steps)
    ? detail.all_steps.find((step) => step.step === "intent_inputs_extracted")
    : null;

  const preview =
    inputStep && inputStep.data && inputStep.data.raw_input_preview
      ? String(inputStep.data.raw_input_preview)
      : `Replay trace ${traceId}`;

  el.auditDescription.value = preview;
  setActivePage("audit-page");
  el.navItems.forEach((nav) => nav.classList.toggle("active", nav.dataset.page === "audit-page"));

  if (!el.contractCode.value.trim()) {
    appendGlobalLog(
      `Replay prepared from trace ${traceId}. Paste contract code to launch replay.`,
      "error"
    );
    return;
  }

  appendGlobalLog(`Replaying trace ${traceId} with current contract code.`);
  launchAudit();
}

async function loadReports() {
  try {
    const response = await fetch(`${API_BASE}/api/traces`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const traces = await response.json();
    el.reportList.innerHTML = "";

    if (!Array.isArray(traces) || traces.length === 0) {
      el.reportList.innerHTML = "<div>No traces found.</div>";
      return;
    }

    traces.forEach((trace) => {
      const traceId = trace.trace_id;
      const item = document.createElement("div");
      item.className = "report-list-item";
      item.innerHTML = `
        <div class="report-id">${escapeHtml(traceId)}</div>
        <div class="inline-controls">
          <button class="ghost-button open-report-btn" type="button">Open</button>
          <button class="ghost-button download-report-btn" type="button">Download</button>
        </div>
      `;

      item.querySelector(".open-report-btn").addEventListener("click", () => openReport(traceId));
      item
        .querySelector(".download-report-btn")
        .addEventListener("click", () => exportReportByTraceId(traceId));

      el.reportList.appendChild(item);
    });
  } catch (error) {
    el.reportList.innerHTML = `<div>Failed to load reports: ${escapeHtml(error.message)}</div>`;
  }
}

async function openReport(traceId) {
  try {
    const response = await fetch(`${API_BASE}/api/reports/${traceId}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const markdown = await response.text();
    el.reportContent.textContent = markdown;
    el.reportTraceId.value = traceId;
    state.latestTraceId = traceId;
    state.latestReportMd = markdown;
  } catch (error) {
    el.reportContent.textContent = `Failed to load report ${traceId}: ${error.message}`;
  }
}

async function exportLatestReport() {
  if (!state.latestTraceId) {
    appendGlobalLog("No completed report available to export.", "error");
    return;
  }
  await exportReportByTraceId(state.latestTraceId);
}

async function exportReportByTraceId(traceId) {
  try {
    let markdown = "";

    if (traceId === state.latestTraceId && state.latestReportMd) {
      markdown = state.latestReportMd;
    } else {
      const response = await fetch(`${API_BASE}/api/reports/${traceId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      markdown = await response.text();
    }

    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${traceId}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    appendGlobalLog(`Report export failed: ${error.message}`, "error");
  }
}

async function loadSystemStatus() {
  try {
    const response = await fetch(`${API_BASE}/api/status`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const status = await response.json();
    el.systemIndicator.classList.remove("offline");
    el.systemIndicatorText.textContent = "SYSTEM ONLINE";
    el.versionStatus.textContent = status.version || "srp-2026.1";
  } catch (_error) {
    el.systemIndicator.classList.add("offline");
    el.systemIndicatorText.textContent = "SYSTEM OFFLINE";
    el.versionStatus.textContent = "offline";
  }
}

function updateStatusPanelsFromResult(result) {
  const trace = result.trace || {};

  if (trace.erc8004_agent_id) {
    el.policyStatus.textContent = `verified - ${trace.erc8004_agent_id}`;
    el.policyStatus.style.color = "var(--green)";
  } else {
    el.policyStatus.textContent = "local-mode (no on-chain policy id)";
    el.policyStatus.style.color = "var(--red)";
  }

  if (trace.x402_tx) {
    el.budgetStatus.textContent = `settled - ${trace.x402_tx}`;
    el.budgetStatus.style.color = "var(--green)";
  } else {
    el.budgetStatus.textContent = "local simulation (no x402 tx)";
    el.budgetStatus.style.color = "var(--red)";
  }

  renderStatusCards();
}

function updateUptime() {
  const elapsed = Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000));
  const hh = String(Math.floor(elapsed / 3600)).padStart(2, "0");
  const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  el.uptimeStatus.textContent = `${hh}:${mm}:${ss}`;
}

async function loadSkillsManifest() {
  try {
    const response = await fetch(`${API_BASE}/api/skills`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const manifest = await response.json();
    state.skillsManifest = manifest;
    renderSkillsArsenalTable(manifest);
  } catch (error) {
    state.skillsManifest = null;
    renderSkillsArsenalTable(null, `Failed to load skills manifest: ${error.message}`);
  }
}

async function loadSkillsHealth(force = false) {
  const now = Date.now();
  if (!force && state.skillsHealth && now - state.skillsHealthLastCheckedAt < 60_000) {
    renderSkillsHealth(state.skillsHealth);
    return;
  }

  if (el.skillsHealthSummary) {
    el.skillsHealthSummary.textContent = "Checking skills arsenal...";
    el.skillsHealthSummary.className = "skills-health-summary";
  }

  try {
    const response = await fetch(`${API_BASE}/api/skills`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const manifest = await response.json();
    state.skillsManifest = manifest;
    renderSkillsArsenalTable(manifest);

    const items = Array.isArray(manifest.skills) ? manifest.skills : [];
    const checks = await Promise.all(
      items.map(async (item) => {
        const key = String(item.key || "");
        if (!key) {
          return { key: "", ok: false, error: "missing_key" };
        }
        try {
          const detailResponse = await fetch(`${API_BASE}/api/skills/${encodeURIComponent(key)}`);
          if (!detailResponse.ok) {
            return { key, ok: false, error: `HTTP ${detailResponse.status}` };
          }
          return { key, ok: true, error: "" };
        } catch (error) {
          return { key, ok: false, error: error.message || "request_failed" };
        }
      })
    );

    const missing = checks.filter((item) => !item.ok);
    state.skillsHealth = {
      checkedAt: new Date().toISOString(),
      total: items.length,
      missing,
      available: items.length - missing.length,
    };
    state.skillsHealthLastCheckedAt = now;
    renderSkillsHealth(state.skillsHealth);
  } catch (error) {
    state.skillsHealth = {
      checkedAt: new Date().toISOString(),
      total: 0,
      missing: [{ key: "manifest", ok: false, error: error.message || "failed" }],
      available: 0,
    };
    state.skillsHealthLastCheckedAt = now;
    renderSkillsHealth(state.skillsHealth);
  }
}

function renderSkillsHealth(health) {
  if (!el.skillsHealthSummary || !el.skillsHealthList) {
    return;
  }

  if (!health) {
    el.skillsHealthSummary.textContent = "Skills health unavailable.";
    el.skillsHealthSummary.className = "skills-health-summary warning";
    el.skillsHealthList.innerHTML = "";
    return;
  }

  const missing = Array.isArray(health.missing) ? health.missing : [];
  const hasMissing = missing.length > 0;

  if (hasMissing) {
    el.skillsHealthSummary.textContent = `WARNING: ${missing.length} missing skill file(s) detected.`;
    el.skillsHealthSummary.className = "skills-health-summary warning";
  } else {
    el.skillsHealthSummary.textContent = `All ${health.total} skill files available.`;
    el.skillsHealthSummary.className = "skills-health-summary healthy";
  }

  if (!hasMissing) {
    el.skillsHealthList.innerHTML =
      "<div class=\"skills-health-item ok\">No missing skills detected.</div>";
    return;
  }

  el.skillsHealthList.innerHTML = missing
    .map(
      (item) =>
        `<div class="skills-health-item missing"><strong>${escapeHtml(item.key)}</strong><span>${escapeHtml(
          item.error || "missing"
        )}</span></div>`
    )
    .join("");
}

function renderSkillsArsenalTable(manifest = state.skillsManifest, errorMessage = "") {
  if (!el.skillsArsenalBody) {
    return;
  }

  if (errorMessage) {
    el.skillsArsenalBody.innerHTML = `<tr><td colspan="4">${escapeHtml(errorMessage)}</td></tr>`;
    return;
  }

  const items = Array.isArray(manifest && manifest.skills) ? manifest.skills : [];
  if (!items.length) {
    el.skillsArsenalBody.innerHTML = "<tr><td colspan=\"4\">Skills manifest not loaded.</td></tr>";
    return;
  }

  const byKey = new Map(items.map((item) => [String(item.key || ""), item]));
  const rows = Object.entries(SKILLS_ARSENAL_BY_AGENT);

  el.skillsArsenalBody.innerHTML = rows
    .map(([agent, skillKeys]) => renderArsenalRow(agent, skillKeys, byKey))
    .join("");
}

function renderArsenalRow(agent, skillKeys, byKey) {
  const sourceFirms = new Map();
  let missingSkill = false;

  skillKeys.forEach((skillKey) => {
    const manifestEntry = byKey.get(skillKey);
    const firm = firmFromSkillKey(skillKey, manifestEntry ? manifestEntry.path : "");
    const hash = manifestEntry && manifestEntry.git_hash ? String(manifestEntry.git_hash) : "missing";
    if (hash === "missing") {
      missingSkill = true;
    }
    if (!sourceFirms.has(firm)) {
      sourceFirms.set(firm, new Set());
    }
    sourceFirms.get(firm).add(hash);
  });

  const skillsCell = skillKeys
    .map((skillKey) => `<span class="skill-key">${escapeHtml(skillKey)}</span>`)
    .join("");
  const sourceCell = Array.from(sourceFirms.keys())
    .map((firm) => `<span class="firm-pill ${firmClassName(firm)}">${escapeHtml(firmLabel(firm))}</span>`)
    .join("");
  const hashCell = Array.from(sourceFirms.entries())
    .map(([firm, hashes]) => {
      const summary = Array.from(hashes)
        .map((hash) => (hash === "missing" ? "missing" : shortenHash(hash)))
        .join(", ");
      const missingClass = summary.includes("missing") ? "missing" : "";
      return `<span class="hash-chip ${firmClassName(firm)} ${missingClass}">${escapeHtml(
        `${firmLabel(firm)}: ${summary}`
      )}</span>`;
    })
    .join("");

  return `
    <tr class="${missingSkill ? "arsenal-row-warning" : ""}">
      <td>${escapeHtml(agent)}</td>
      <td>${skillsCell}</td>
      <td>${sourceCell}</td>
      <td>${hashCell}</td>
    </tr>
  `;
}

function renderTraceSkillsTable(trace) {
  if (!el.traceSkillsBody) {
    return;
  }

  const arsenal = trace && typeof trace === "object" ? trace.skills_arsenal : null;
  if (!arsenal || typeof arsenal !== "object") {
    el.traceSkillsBody.innerHTML =
      "<tr><td colspan=\"4\">No skills_arsenal in selected trace.</td></tr>";
    return;
  }

  const gitHashes = trace && typeof trace.skills_git_hashes === "object" ? trace.skills_git_hashes : {};
  const rows = Object.entries(arsenal);
  if (!rows.length) {
    el.traceSkillsBody.innerHTML =
      "<tr><td colspan=\"4\">No skills_arsenal in selected trace.</td></tr>";
    return;
  }

  el.traceSkillsBody.innerHTML = rows
    .map(([agent, skillList]) => {
      const skills = Array.isArray(skillList) ? skillList : [];
      const firms = Array.from(new Set(skills.map((key) => firmFromSkillKey(key, ""))));
      const skillCell = skills.map((skill) => `<span class="skill-key">${escapeHtml(skill)}</span>`).join("");
      const sourceCell = firms
        .map((firm) => `<span class="firm-pill ${firmClassName(firm)}">${escapeHtml(firmLabel(firm))}</span>`)
        .join("");
      const hashCell = firms
        .map((firm) => {
          const repoKey = repoKeyFromFirm(firm);
          const raw = repoKey ? gitHashes[repoKey] : "";
          const text = raw ? shortenHash(raw) : "n/a";
          return `<span class="hash-chip ${firmClassName(firm)}">${escapeHtml(
            `${firmLabel(firm)}: ${text}`
          )}</span>`;
        })
        .join("");
      return `
        <tr>
          <td>${escapeHtml(agent)}</td>
          <td>${skillCell || "-"}</td>
          <td>${sourceCell || "-"}</td>
          <td>${hashCell || "-"}</td>
        </tr>
      `;
    })
    .join("");
}

function firmFromSkillKey(skillKey, path = "") {
  const key = String(skillKey || "").toLowerCase();
  const normalizedPath = String(path || "").toLowerCase();
  if (key.startsWith("audit-firm-1-") || normalizedPath.startsWith("skills/audit-firm-1/")) {
    return "audit-firm-1";
  }
  if (key.startsWith("quillai-") || normalizedPath.startsWith("skills/quillai/")) {
    return "quillai";
  }
  if (key.startsWith("tob-") || normalizedPath.startsWith("skills/trailofbits/")) {
    return "trailofbits";
  }
  if (key.startsWith("ethskills-") || normalizedPath.startsWith("skills/ethskills/")) {
    return "ethskills";
  }
  if (key.startsWith("cyfrin-") || normalizedPath.startsWith("skills/cyfrin/")) {
    return "cyfrin";
  }
  if (key.startsWith("scv-scan") || normalizedPath.startsWith("skills/scv-scan/")) {
    return "scvscan";
  }
  if (key.startsWith("sc-auditor") || normalizedPath.startsWith("skills/sc-auditor/")) {
    return "archethect";
  }
  return "unknown";
}

function firmClassName(firm) {
  const entry = FIRM_META[firm] || FIRM_META.unknown;
  return entry.className;
}

function firmLabel(firm) {
  const entry = FIRM_META[firm] || FIRM_META.unknown;
  return entry.label;
}

function repoKeyFromFirm(firm) {
  if (firm === "audit-firm-1") return "audit-firm-1";
  if (firm === "quillai") return "quillai";
  if (firm === "trailofbits") return "trailofbits";
  if (firm === "scvscan") return "scv-scan";
  if (firm === "cyfrin") return "cyfrin";
  return "";
}

function shortenHash(value) {
  const text = String(value || "").trim();
  if (!text || text === "missing" || text === "unknown") {
    return text || "unknown";
  }
  return text.length > 12 ? `${text.slice(0, 10)}...` : text;
}

function renderSkillSection() {
  if (el.activeSkillName) {
    el.activeSkillName.textContent = state.currentSkill.name || DEFAULT_SKILL.name;
  }
  if (el.activeSkillSource) {
    el.activeSkillSource.textContent = state.currentSkill.source || DEFAULT_SKILL.source;
  }
  if (el.activeSkillBadge) {
    el.activeSkillBadge.textContent = state.currentSkill.status || DEFAULT_SKILL.status;
  }
  renderSkillsArsenalTable(state.skillsManifest);
  updateAgentSkillBadges();
}

function updateAgentSkillBadges() {
  AGENTS.forEach((agent) => {
    const row = document.getElementById(`agent-skill-dots-${agent.id}`);
    if (!row) {
      return;
    }

    const skillKeys = LIVE_CARD_SKILLS[agent.id] || [];
    const shouldShow = ["running", "complete", "failed"].includes(state.statusByAgent[agent.id]);

    row.innerHTML = "";
    if (shouldShow) {
      skillKeys.forEach((skillKey) => {
        const firm = firmFromSkillKey(skillKey);
        const dot = document.createElement("span");
        dot.className = `agent-skill-dot-mini ${firmClassName(firm)}`;
        dot.title = `${skillKey} (${firmLabel(firm)})`;
        row.appendChild(dot);
      });
    }
    row.classList.toggle("hidden", !shouldShow);
  });
}

function maybeCaptureSkillMetadata(value) {
  const meta = extractSkillMetadata(value);
  if (!meta) {
    return;
  }

  let changed = false;
  if (meta.name && meta.name !== state.currentSkill.name) {
    state.currentSkill.name = meta.name;
    changed = true;
  }
  if (meta.source && meta.source !== state.currentSkill.source) {
    state.currentSkill.source = meta.source;
    changed = true;
  }

  if (changed) {
    renderSkillSection();
  }
}

function extractSkillMetadata(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractSkillMetadata(item);
      if (found) {
        return found;
      }
    }
    return null;
  }

  const directName = skillNameFromValue(value);
  const directSource = skillSourceFromValue(value);
  if (directName || directSource) {
    return {
      name: directName || state.currentSkill.name || DEFAULT_SKILL.name,
      source: directSource || state.currentSkill.source || DEFAULT_SKILL.source,
    };
  }

  for (const nested of Object.values(value)) {
    const found = extractSkillMetadata(nested);
    if (found) {
      return found;
    }
  }

  return null;
}

function skillNameFromValue(value) {
  const candidate =
    value.skill_name ||
    value.skillName ||
    value.selected_skill ||
    value.selectedSkill ||
    value.skill;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
}

function skillSourceFromValue(value) {
  const candidate = value.skill_source || value.skillSource || value.source || value.skill_origin;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
}

init();
