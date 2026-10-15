const state = { audits: [], selectedAudit: null, incidents: [] };
const tokenInput = document.querySelector("#token");
const connection = document.querySelector("#connection");

tokenInput.value = localStorage.getItem("srp.token") || "";

function token() {
  return tokenInput.value.trim();
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      authorization: `Bearer ${token()}`,
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function refresh() {
  const [audits, incidents] = await Promise.all([api("/api/audits"), api("/api/incidents")]);
  state.audits = audits.audits;
  state.incidents = incidents.incidents;
  document.querySelector("#auditCount").textContent = state.audits.length;
  document.querySelector("#incidentCount").textContent = state.incidents.length;
  renderIncidents();
}

async function runAudit() {
  const form = new FormData(document.querySelector("#auditForm"));
  const chain = form.get("chain");
  const extension = chain === "solana" ? "rs" : "sol";
  const language = chain === "solana" ? "rust" : "solidity";
  const audit = await api("/api/audits", {
    method: "POST",
    body: JSON.stringify({
      name: form.get("name"),
      chain,
      documents: [{ path: "README.md", kind: "README", content: form.get("docs") }],
      sources: [{ path: `Protocol.${extension}`, language, content: form.get("source") }]
    })
  });
  state.selectedAudit = audit;
  renderAudit(audit);
  await refresh();
}

function renderAudit(audit) {
  const findings = audit.findings || [];
  document.querySelector("#findingCount").textContent = findings.length;
  document.querySelector("#provenCount").textContent = findings.filter((finding) => finding.status === "proven").length;
  document.querySelector("#coverage").textContent = audit.coverage ? `${Math.round(audit.coverage.ratio * 100)}%` : "-";
  document.querySelector("#unknowns").innerHTML = (audit.unknowns || []).length
    ? `<h3>Not analyzed</h3>${audit.unknowns.map((unknown) => `<p><span class="pill">${escapeHtml(unknown.severity)}</span> ${escapeHtml(unknown.file)}: ${escapeHtml(unknown.reason)}</p>`).join("")}`
    : "";
  document.querySelector("#findingsList").innerHTML = findings.map((finding) => `
    <article class="finding">
      <h3>${escapeHtml(finding.title)}</h3>
      <div class="meta">
        <span class="pill">${escapeHtml(finding.severity)}${finding.proposedSeverity && finding.proposedSeverity !== finding.severity ? ` (proposed ${escapeHtml(finding.proposedSeverity)})` : ""}</span>
        <span class="pill">${escapeHtml(finding.status)}</span>
        <span class="pill">${escapeHtml(finding.confidenceBand)} ${escapeHtml(finding.confidence)}</span>
        <span class="pill">${escapeHtml(finding.detector)}</span>
      </div>
      <p>${escapeHtml(finding.impact)}</p>
      <ul>${finding.evidence.map((evidence) => `<li><code>L${evidence.startLine}</code> ${escapeHtml(evidence.excerpt)} <em>${escapeHtml(evidence.rationale)}</em></li>`).join("")}</ul>
      ${(finding.mitigations || []).length ? `<p>Mitigations: ${finding.mitigations.map(escapeHtml).join("; ")}</p>` : ""}
      <p>${escapeHtml(finding.remediation)}</p>
    </article>
  `).join("");
}

function renderIncidents() {
  document.querySelector("#incidents").innerHTML = state.incidents.length
    ? state.incidents.map((incident) => `
      <article class="incident">
        <h3>${escapeHtml(incident.title)}</h3>
        <div class="meta"><span class="pill">${escapeHtml(incident.severity)}</span><span class="pill">${escapeHtml(incident.status)}</span><span class="pill">${escapeHtml(incident.protocol)}</span></div>
        <p>${incident.evidence.map(escapeHtml).join(" | ")}</p>
      </article>
    `).join("")
    : "<p>No open incidents.</p>";
}

async function simulateIncident() {
  const protocol = state.selectedAudit?.protocol?.name || "ExampleVault";
  const result = await api("/api/signals", {
    method: "POST",
    body: JSON.stringify({ protocol, chain: "ethereum", source: "treasury", metric: "outflow_usd", value: 2500000, threshold: 500000 })
  });
  if (result.incident) state.incidents.unshift(result.incident);
  renderIncidents();
  document.querySelector("#incidentCount").textContent = state.incidents.length;
}

function connectEvents() {
  const events = new EventSource(`/api/events?token=${encodeURIComponent(token())}`);
  events.addEventListener("ready", () => connection.textContent = "Connected to live SRP event stream.");
  events.addEventListener("audit.started", () => document.querySelectorAll("[data-stage]").forEach((node) => node.classList.remove("done")));
  events.addEventListener("audit.stage", (event) => {
    const stage = JSON.parse(event.data).stage;
    document.querySelector(`[data-stage="${CSS.escape(stage)}"]`)?.classList.add("done");
  });
  events.addEventListener("audit.completed", refresh);
  events.addEventListener("audit.proved", refresh);
  events.addEventListener("incident.created", refresh);
  events.onerror = () => connection.textContent = "Event stream paused. API calls still work.";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

document.querySelector("#runAudit").addEventListener("click", runAudit);
document.querySelector("#simulateIncident").addEventListener("click", simulateIncident);
tokenInput.addEventListener("change", () => {
  localStorage.setItem("srp.token", token());
  location.reload();
});
if (token()) {
  connectEvents();
  refresh().catch((error) => connection.textContent = error.message);
} else {
  connection.textContent = "Paste an API token in the sidebar. Local dev: srp_demo_admin_token.";
}
