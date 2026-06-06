const state = { audits: [], selectedAudit: null, incidents: [] };
const tokenInput = document.querySelector("#token");
const connection = document.querySelector("#connection");

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
  document.querySelector("#findingsList").innerHTML = findings.map((finding) => `
    <article class="finding">
      <h3>${escapeHtml(finding.title)}</h3>
      <div class="meta">
        <span class="pill">${finding.severity}</span>
        <span class="pill">${finding.status}</span>
        <span class="pill">${finding.confidenceBand} ${finding.confidence}</span>
        <span class="pill">${finding.detector}</span>
      </div>
      <p>${escapeHtml(finding.impact)}</p>
      <p>${escapeHtml(finding.remediation)}</p>
    </article>
  `).join("");
}

function renderIncidents() {
  document.querySelector("#incidents").innerHTML = state.incidents.length
    ? state.incidents.map((incident) => `
      <article class="incident">
        <h3>${escapeHtml(incident.title)}</h3>
        <div class="meta"><span class="pill">${incident.severity}</span><span class="pill">${incident.status}</span><span class="pill">${incident.protocol}</span></div>
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
  events.addEventListener("audit.created", refresh);
  events.addEventListener("incident.created", refresh);
  events.onerror = () => connection.textContent = "Event stream paused. API calls still work.";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

document.querySelector("#runAudit").addEventListener("click", runAudit);
document.querySelector("#simulateIncident").addEventListener("click", simulateIncident);
tokenInput.addEventListener("change", () => location.reload());
connectEvents();
refresh().catch((error) => connection.textContent = error.message);
