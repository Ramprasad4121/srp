// SRP Console. Static, no framework, no build step.
// Data source: the SRP API when a token is set and the server answers, otherwise
// demo data from mock-data.js (window.SRP_MOCK). Each screen notes what is wired.

const MOCK = window.SRP_MOCK || { audits: [], incidents: [], capabilities: null, exports: {} };
const SEVERITIES = ["critical", "high", "medium", "low", "info"];
const STATUSES = ["proven", "partial", "debated", "candidate", "unverified", "failed"];
const CHAINS = ["ethereum", "arbitrum", "optimism", "base", "polygon", "avalanche", "solana"];
const STAGES = ["intent", "discovery", "debate", "validation", "coverage"];

const SAMPLE_SOL = MOCK.audits[0]?.protocol?.sources?.[0]?.content || "contract Vault {}\n";
const SAMPLE_ANCHOR = `use anchor_lang::prelude::*;

#[program]
pub mod vault {
    use super::*;
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += amount;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub vault: Account<'info, VaultState>,
    /// CHECK: no signer or owner check
    #[account(mut)]
    pub user: AccountInfo<'info>,
}

#[account]
pub struct VaultState { pub authority: Pubkey }
`;

const store = {
  get demo() { return localStorage.getItem("srp.demo") !== "0"; },
  set demo(v) { localStorage.setItem("srp.demo", v ? "1" : "0"); },
  get token() { return localStorage.getItem("srp.token") || ""; },
  set token(v) { localStorage.setItem("srp.token", v); },
  get base() { return localStorage.getItem("srp.base") || ""; },
  set base(v) { localStorage.setItem("srp.base", v.replace(/\/$/, "")); }
};

const state = {
  live: false,
  reason: "",
  audits: [],
  incidents: [],
  capabilities: null,
  health: null,
  filters: { q: "", severity: "", status: "", detector: "", audit: "" },
  events: null
};

// ---------- data layer ----------

async function api(path, options = {}) {
  const response = await fetch(store.base + path, {
    ...options,
    headers: { authorization: `Bearer ${store.token}`, "content-type": "application/json", ...(options.headers || {}) }
  });
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try { const body = await response.json(); message = body.error || message; } catch { /* not json */ }
    throw new Error(message);
  }
  const type = response.headers.get("content-type") || "";
  return type.includes("json") ? response.json() : response.text();
}

function loadMock(reason) {
  state.live = false;
  state.reason = reason;
  state.audits = structuredClone(MOCK.audits);
  state.incidents = structuredClone(MOCK.incidents);
  state.capabilities = MOCK.capabilities;
  state.health = MOCK.health;
}

async function load() {
  if (store.demo) return loadMock("Demo mode on");
  if (!store.token) return loadMock("No API token set, showing demo data");
  try {
    const [health, capabilities, list, incidents] = await Promise.all([
      api("/api/health"), api("/api/capabilities"), api("/api/audits"), api("/api/incidents")
    ]);
    const recent = list.audits.slice(-25).reverse();
    state.audits = (await Promise.all(recent.map((a) => api(`/api/audits/${a.id}`).catch(() => null)))).filter(Boolean);
    state.incidents = incidents.incidents.slice().reverse();
    state.capabilities = capabilities;
    state.health = health;
    state.live = true;
    state.reason = "Connected";
    connectEvents();
  } catch (error) {
    loadMock(`API unreachable (${error.message}), showing demo data`);
  }
}

function connectEvents() {
  if (state.events || !window.EventSource) return;
  const events = new EventSource(`${store.base}/api/events?token=${encodeURIComponent(store.token)}`);
  state.events = events;
  events.addEventListener("audit.stage", (event) => {
    const stage = JSON.parse(event.data).stage;
    document.querySelector(`[data-stage="${CSS.escape(stage)}"]`)?.classList.add("done");
  });
  const reload = async () => { await load(); route(); };
  events.addEventListener("audit.completed", reload);
  events.addEventListener("audit.proved", reload);
  events.addEventListener("incident.created", reload);
}

// ---------- helpers ----------

const $ = (selector, root = document) => root.querySelector(selector);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sev = (s) => `<span class="sev ${esc(s)}">${esc(s)}</span>`;
const pill = (s) => `<span class="pill ${esc(s)}">${esc(s)}</span>`;
const when = (iso) => iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";
const pct = (ratio) => ratio == null ? "n/a" : `${Math.round(ratio * 100)}%`;

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove("show"), 2400);
}

function allFindings() {
  return state.audits.flatMap((audit) => audit.findings.map((finding) => ({ ...finding, audit })));
}

function findFinding(auditId, findingId) {
  const audit = state.audits.find((a) => a.id === auditId);
  return audit && { audit, finding: audit.findings.find((f) => f.id === findingId) };
}

function sourceFor(audit, file) {
  return (audit.protocol?.sources || []).find((s) => s.path === file)?.content;
}

function download(name, content, type) {
  const blob = new Blob([typeof content === "string" ? content : JSON.stringify(content, null, 2)], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast("Copied to clipboard"); }
  catch { toast("Copy failed. Select the text and copy manually."); }
}

function severityBar(findings) {
  const total = findings.length || 1;
  const colors = { critical: "var(--critical)", high: "var(--high)", medium: "var(--medium)", low: "var(--low)", info: "var(--info)" };
  return `<div class="bar" role="img" aria-label="Severity distribution">${SEVERITIES.map((s) => {
    const n = findings.filter((f) => f.severity === s).length;
    return n ? `<span style="width:${(n / total) * 100}%;background:${colors[s]}" title="${s}: ${n}"></span>` : "";
  }).join("")}</div>`;
}


// ---------- analyzers and external tools ----------
// Built-in rows mirror /api/capabilities. Every external tool is a planned integration: SRP does not run it yet (wire later).
const TOOLS = [
  { id: "srp-structural", name: "SRP structural", chain: "evm", kind: "static", status: "built-in", about: "Per-function Solidity index: visibility, modifiers, params, state writes." },
  { id: "srp-pattern", name: "SRP pattern", chain: "evm", kind: "static", status: "built-in", about: "Guarded file-level patterns for Solidity." },
  { id: "srp-anchor", name: "SRP Anchor", chain: "solana", kind: "static", status: "built-in", about: "Anchor account constraints and account data structs." },
  { id: "slither", name: "Slither", chain: "evm", kind: "static", status: "planned", url: "https://github.com/crytic/slither", about: "Solidity static analysis framework by Trail of Bits." },
  { id: "aderyn", name: "Aderyn", chain: "evm", kind: "static", status: "planned", url: "https://github.com/Cyfrin/aderyn", about: "Rust-based Solidity static analyzer." },
  { id: "mythril", name: "Mythril", chain: "evm", kind: "symbolic", status: "planned", url: "https://github.com/Consensys/mythril", about: "Symbolic execution for EVM bytecode." },
  { id: "semgrep", name: "Semgrep", chain: "evm", kind: "static", status: "planned", url: "https://github.com/Decurity/semgrep-smart-contracts", about: "Pattern rules for smart contracts." },
  { id: "solhint", name: "Solhint", chain: "evm", kind: "lint", status: "planned", url: "https://github.com/protofire/solhint", about: "Solidity linter with security rules." },
  { id: "4naly3er", name: "4naly3er", chain: "evm", kind: "static", status: "planned", url: "https://github.com/Picodes/4naly3er", about: "Pattern-based report generator for common issues." },
  { id: "wake", name: "Wake", chain: "evm", kind: "static", status: "planned", url: "https://github.com/Ackee-Blockchain/wake", about: "Python framework with detectors and testing." },
  { id: "halmos", name: "Halmos", chain: "evm", kind: "dynamic", status: "planned", url: "https://github.com/a16z/halmos", about: "Symbolic testing of Foundry tests." },
  { id: "echidna", name: "Echidna", chain: "evm", kind: "dynamic", status: "planned", url: "https://github.com/crytic/echidna", about: "Property-based fuzzer." },
  { id: "medusa", name: "Medusa", chain: "evm", kind: "dynamic", status: "planned", url: "https://github.com/crytic/medusa", about: "Parallel coverage-guided fuzzer." },
  { id: "anchor-sentinel", name: "Anchor-Sentinel", chain: "solana", kind: "static", status: "planned", url: "https://github.com/Ramprasad4121/anchor-sentinel", about: "Static analyzer for Anchor programs." },
  { id: "cargo-audit", name: "cargo-audit", chain: "solana", kind: "deps", status: "planned", url: "https://github.com/rustsec/rustsec", about: "Known-vulnerable crate advisories." },
  { id: "clippy", name: "Clippy", chain: "solana", kind: "lint", status: "planned", url: "https://github.com/rust-lang/rust-clippy", about: "Rust lints." },
  { id: "xray", name: "Soteria / sec3 X-ray", chain: "solana", kind: "static", status: "planned", url: "https://www.sec3.dev/", about: "Solana program scanner." }
];
const toolName = (id) => TOOLS.find((t) => t.id === id)?.name || id;

// wire later: demo results from external tools, merged into SRP findings by file and nearby line.
const EXTERNAL_DEMO = [
  { tool: "slither", check: "reentrancy-eth", topic: "reentrancy", file: "Vault.sol", line: 17 },
  { tool: "aderyn", check: "state-change-after-external-call", topic: "reentrancy", file: "Vault.sol", line: 18 },
  { tool: "slither", check: "tx-origin", topic: "tx-origin", file: "Vault.sol", line: 29 },
  { tool: "solhint", check: "avoid-tx-origin", topic: "tx-origin", file: "Vault.sol", line: 29 },
  { tool: "aderyn", check: "centralization-risk", topic: "access-control", file: "Vault.sol", line: 23 },
  { tool: "slither", check: "arbitrary-send-eth", topic: "arbitrary-send", file: "Vault.sol", line: 30, severity: "medium", title: "sweep sends ETH to a caller-chosen address" }
];
const TOPIC = (detector) => /reentr/.test(detector) ? "reentrancy" : /origin/.test(detector) ? "tx-origin" : /access/.test(detector) ? "access-control" : detector;
const SOLODIT_KEYWORDS = { reentrancy: "reentrancy withdraw", "tx-origin": "tx.origin authorization", "access-control": "missing access control owner" };

function foundBy(audit, finding) {
  const own = [...new Set(finding.evidence.map((e) => e.provider).filter(Boolean))];
  if (state.live || !audit.id.startsWith("audit_demo")) return own;
  const near = EXTERNAL_DEMO.filter((x) => x.topic === TOPIC(finding.detector) && finding.evidence.some((e) => e.file === x.file && Math.abs(e.startLine - x.line) <= 2));
  return [...own, ...new Set(near.map((x) => x.tool))];
}

function externalOnly(audit) {
  if (state.live || !audit.id.startsWith("audit_demo")) return [];
  const topics = new Set(audit.findings.map((f) => TOPIC(f.detector)));
  return EXTERNAL_DEMO.filter((x) => !topics.has(x.topic) && x.title);
}

const toolChips = (ids) => ids.map((id) => `<span class="pill ${id.startsWith("srp-") ? "" : "ext"}">${esc(toolName(id))}</span>`).join("");
const battleBadge = (f) => f.status === "proven" ? `<a class="pill bc" href="#/battlechain">Ready for BattleChain</a>` : "";

function soloditCard(finding) {
  const keywords = SOLODIT_KEYWORDS[TOPIC(finding.detector)] || finding.title;
  return `<div class="card">
    <h2>Similar real-world findings from Solodit</h2>
    <p class="small muted">Search Solodit's public database of audit findings for this pattern. Keywords: <strong>${esc(keywords)}</strong></p>
    <div class="row"><a class="btn primary" href="https://solodit.cyfrin.io/" target="_blank" rel="noopener">Open Solodit</a><button type="button" data-copy="${esc(keywords)}">Copy keywords</button></div>
    <div class="skeleton" aria-hidden="true"><span></span><span></span><span></span></div>
    <p class="small muted" style="margin-bottom:0">Matched results will list here once the Solodit API is wired.</p>
  </div>`;
}

// wire later: BattleChain lifecycle is demo state only. SRP is not affiliated with Cyfrin or BattleChain.
const BATTLE_STEPS = [
  ["Deploy", "Deploy the audited contracts to BattleChain with real funds."],
  ["Safe Harbor", "Adopt a Safe Harbor agreement with bounty terms."],
  ["Request attack", "Request Attack Mode through the AttackRegistry."],
  ["DAO approval", "The BattleChain DAO reviews and approves the request."],
  ["Under attack", "Whitehats may legally attack the contracts for bounties."],
  ["Promote", "Request promotion and move to production."]
];
const BATTLE_DEMO = { step: 2, state: "ATTACK_REQUESTED", network: "BattleChain testnet (chain ID 627)" };

// ---------- views ----------

const views = {
  overview() {
    const findings = allFindings();
    const counts = Object.fromEntries(SEVERITIES.map((s) => [s, findings.filter((f) => f.severity === s).length]));
    const proven = findings.filter((f) => f.status === "proven").length;
    const open = state.incidents.filter((i) => i.status === "open");
    const cov = state.audits.length ? state.audits.reduce((sum, a) => sum + (a.coverage?.ratio ?? 0), 0) / state.audits.length : null;
    const hour = new Date().getHours();
    const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const urgent = counts.critical + counts.high;
    const top = findings.filter((f) => f.severity === "critical" || f.severity === "high").slice(0, 3);
    return `
      <section class="hero">
        <p class="eyebrow">${greet}</p>
        <h2 class="display">${urgent ? `<em>${urgent}</em> high-impact finding${urgent === 1 ? "" : "s"}<br>need a look.` : "All quiet.<br>Nothing urgent."}</h2>
        <p class="lede">${state.audits.length} audit${state.audits.length === 1 ? "" : "s"}, ${proven} finding${proven === 1 ? "" : "s"} proven by an attached test run, ${open.length} open incident${open.length === 1 ? "" : "s"}.</p>
      </section>
      <section class="bento">
        <a class="card lift ink span-3" href="#/findings?severity=high">
          <h2>Needs you</h2>
          <ul class="mini-list">${top.length ? top.map((f) => `<li><span>${esc(f.title)}</span><span class="loc" style="color:inherit;opacity:.6">L${f.evidence[0]?.startLine ?? "?"}</span></li>`).join("") : `<li class="muted">Nothing high or critical.</li>`}</ul>
        </a>
        <div class="card lift span-3">
          <h2>Severity</h2>
          <div class="row spread" style="align-items:flex-end;margin-bottom:14px"><span class="big">${findings.length}</span><span class="muted small">findings across ${state.audits.length} audits</span></div>
          ${severityBar(findings)}
          <div class="chips" style="margin-top:14px">${SEVERITIES.filter((s) => counts[s]).map((s) => `<a class="sev ${s}" href="#/findings?severity=${s}" style="text-decoration:none">${s} ${counts[s]}</a>`).join("") || `<span class="muted small">No findings yet</span>`}</div>
        </div>
        <div class="card lift span-2">
          <h2>Coverage</h2>
          <div class="row" style="gap:18px"><div class="ring" style="--p:${Math.round((cov ?? 0) * 100)}"><div>${pct(cov)}</div></div>
          <p class="muted small" style="margin:0">Files SRP actually analyzed. Anything skipped is listed, never silently dropped.</p></div>
        </div>
        <div class="card lift span-2">
          <h2>Proven</h2>
          <div class="big">${proven}<span class="muted" style="font-size:1.2rem"> / ${findings.length}</span></div>
          <p class="muted small">A finding becomes proven only when a passing local test run is attached.</p>
        </div>
        <a class="card lift ${open.length ? "accent" : ""} span-2" href="#/monitoring">
          <h2>Runtime</h2>
          <div class="big">${open.length}</div>
          <p class="small ${open.length ? "" : "muted"}" style="margin-bottom:0">${open.length ? esc(open[0].title) : "No open incidents."}</p>
        </a>
      </section>
      <section>
        <div class="row spread" style="margin:8px 4px 14px"><h2 class="display" style="font-size:1.6rem">Recent audits</h2><a class="btn primary" href="#/scan">New scan</a></div>
        <div class="stack">${state.audits.length ? state.audits.map((a, i) => `
          <a class="item" href="#/findings?audit=${encodeURIComponent(a.id)}" style="animation-delay:${i * 60}ms">
            <span class="logo" aria-hidden="true" style="background:var(--card-2);color:var(--ink)">${esc(a.protocol.name[0] || "?")}</span>
            <span><div class="title">${esc(a.protocol.name)}</div><div class="sub">${esc(a.protocol.chain)}, ${a.findings.length} findings, ${a.findings.filter((f) => f.status === "proven").length} proven, coverage ${pct(a.coverage?.ratio)}</div></span>
            <span class="muted small">${when(a.generatedAt)}</span>
          </a>`).join("") : `<p class="empty">No audits yet. Start a scan.</p>`}</div>
      </section>`;
  },

  scan() {
    return `
      <section class="hero">
        <p class="eyebrow">New scan</p>
        <h2 class="display">Drop your contracts.<br><em>SRP</em> reasons through them.</h2>
        <p class="lede">Solidity or Anchor. Paste code or drop .sol and .rs files into the box below. The agent-native pipeline is deterministic and runs offline.</p>
      </section>
      <section class="thread" id="thread" aria-live="polite">
        <div class="bubble srp">
          <div class="sender"><span class="logo" aria-hidden="true">S</span>SRP</div>
          Hi. Send me a contract and a line about what it must never do. I will map intent, look for bugs, argue each one through DynaDebate, and hand you a Foundry harness to prove it.
        </div>
      </section>
      <form class="composer" id="scanForm">
        <label class="sr-only" for="src" style="position:absolute;left:-999px">Source code</label>
        <textarea id="src" name="source" spellcheck="false">${esc(SAMPLE_SOL)}</textarea>
        <div id="fileList" class="chips"></div>
        <div class="chips" id="toolPicker" role="group" aria-label="Analyzers">${TOOLS.filter((t) => t.chain === "evm").map((t) => `<button type="button" class="chip" data-tool="${t.id}" aria-pressed="${t.status === "built-in"}">${esc(t.name)}${t.status === "built-in" ? "" : " (planned)"}</button>`).join("")}</div>
        <div class="composer-bar">
          <input name="name" value="Vault" aria-label="Protocol name" style="max-width:150px">
          <select name="chain" aria-label="Chain">${CHAINS.map((c) => `<option>${c}</option>`).join("")}</select>
          <input name="docs" aria-label="Protocol intent" value="Only the owner may sweep funds or change ownership. The vault must remain solvent after withdrawals." style="flex:1;min-width:160px">
          <label class="btn ghost" style="cursor:pointer">Attach<input type="file" id="fileInput" multiple accept=".sol,.rs" hidden></label>
          <button type="button" class="ghost" id="loadSample">Sample</button>
          <button class="send" type="submit" id="runBtn" aria-label="Run scan">↑</button>
        </div>
      </form>`;
  },

  findings(params) {
    Object.assign(state.filters, Object.fromEntries(["severity", "status", "detector", "audit", "q"].filter((k) => params.has(k)).map((k) => [k, params.get(k)])));
    const findings = allFindings();
    const detectors = [...new Set(findings.map((f) => f.detector))].sort();
    const f = state.filters;
    const option = (value, current, label = value) => `<option value="${esc(value)}" ${value === current ? "selected" : ""}>${esc(label)}</option>`;
    return `
      <section class="hero"><p class="eyebrow">Findings</p><h2 class="display">Every claim, <em>with evidence.</em></h2></section>
      <section class="grid" style="gap:14px">
        <div class="searchbar" role="search">
          <span aria-hidden="true" class="muted">⌕</span>
          <input id="fq" value="${esc(f.q)}" placeholder="Search title, file, function" aria-label="Search findings">
          <select id="faudit" aria-label="Audit">${option("", f.audit, "All audits")}${state.audits.map((a) => option(a.id, f.audit, a.protocol.name)).join("")}</select>
        </div>
        <div class="chips" role="group" aria-label="Severity">${["", ...SEVERITIES].map((s) => `<button type="button" class="chip" data-sev="${s}" aria-pressed="${f.severity === s}">${s || "All"}</button>`).join("")}</div>
        <div class="row">
          <select id="fstatus" aria-label="Status" style="width:auto;border-radius:99px">${option("", f.status, "Any status")}${STATUSES.map((s) => option(s, f.status)).join("")}</select>
          <select id="fdetector" aria-label="Detector" style="width:auto;border-radius:99px">${option("", f.detector, "Any detector")}${detectors.map((d) => option(d, f.detector)).join("")}</select>
        </div>
      </section>
      <section id="findingsTable"></section>`;
  },

  finding(params) {
    const hit = findFinding(params.get("audit"), params.get("id"));
    if (!hit?.finding) return `<p class="empty">Finding not found. <a href="#/findings">Back to findings</a></p>`;
    const { audit, finding } = hit;
    const debate = (audit.debates || []).find((d) => d.findingId === finding.id);
    const poc = (audit.pocResults || []).find((p) => p.findingId === finding.id);
    return `
      <section class="hero">
        <a href="#/findings" class="small muted">Back to findings</a>
        <h2 class="display" style="font-size:clamp(1.8rem,3.4vw,2.6rem);margin-top:14px">${esc(finding.title)}</h2>
      </section>
      <section class="card">
        <div class="row">${sev(finding.severity)}${finding.proposedSeverity && finding.proposedSeverity !== finding.severity ? `<span class="pill">proposed ${esc(finding.proposedSeverity)}</span>` : ""}${pill(finding.status)}<span class="pill">${esc(finding.confidenceBand)} confidence ${esc(finding.confidence)}</span><span class="pill mono">${esc(finding.detector)}</span>${battleBadge(finding)}</div>
        <div class="row small" style="margin-top:12px"><span class="muted">Found by</span>${toolChips(foundBy(audit, finding))}</div>
        <p class="muted small" style="margin:14px 0">${esc(audit.protocol.name)} on ${esc(audit.protocol.chain)}${finding.context?.function ? `, function <code>${esc(finding.context.function)}</code>` : ""}</p>
        <dl class="kv">
          <dt>Impact</dt><dd>${esc(finding.impact)}</dd>
          <dt>Likelihood</dt><dd>${esc(finding.likelihood)}</dd>
          <dt>Exploitability</dt><dd>${esc(finding.exploitability)}</dd>
        </dl>
      </section>
      <section class="grid cols-2">
        <div class="card">
          <h2>Evidence</h2>
          ${finding.evidence.map((e) => evidenceBlock(audit, e)).join("")}
          ${finding.attackPath?.length ? `<h3>Attack path</h3><ol class="steps">${finding.attackPath.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}
        </div>
        <div class="card">
          <h2>DynaDebate</h2>
          ${debate ? `
            <p class="small muted">Decision: <strong>${esc(debate.decision.replace(/_/g, " "))}</strong>, final confidence ${esc(debate.finalConfidence)}</p>
            <div class="debate">${debate.rounds.map((r, i) => `
              <div class="round-label">Round ${i + 1}, confidence ${r.confidenceDelta >= 0 ? "+" : ""}${esc(r.confidenceDelta)}</div>
              <div class="msg attacker"><span class="who">Attacker</span>${esc(r.attacker)}</div>
              <div class="msg defender"><span class="who">Defender</span>${esc(r.defender)}</div>
              <div class="msg judge"><span class="who">Judge</span>${esc(r.judge)}</div>
            `).join("")}</div>${finding.status === "proven" && debate.decision !== "exploit_proven" ? `<p class="small muted">The debate ran on static evidence before the proof was attached. The attached test run is what marks this finding proven.</p>` : ""}` : `<p class="muted">No debate transcript for this finding.</p>`}
        </div>
      </section>
      ${soloditCard(finding)}
      <section class="grid cols-2">
        <div class="card">
          <h2>Fix</h2>
          <p>${esc(finding.remediation)}</p>
          ${(finding.mitigations || []).length ? `<h3>Mitigations seen</h3><ul>${finding.mitigations.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` : ""}
          <h3>Proof status</h3>
          <div class="row">${pill(poc?.classification || finding.status)}<span class="small muted">${poc?.executed ? "A local test run was attached." : "Not executed yet. Run the harness locally and attach the result."}</span></div>
          ${finding.status === "proven" ? `<p class="small"><a href="#/battlechain">Next: battle-test on BattleChain</a></p>` : ""}
          ${poc?.evidence?.length ? `<ul class="small">${poc.evidence.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
          <h3>Attach proof result</h3>
          <form id="proofForm" class="grid" style="gap:10px">
            <label class="field">Command<input name="command" value="${esc(`forge test --match-contract SRP_${finding.detector.replace(/-/g, "_")} -vvv`)}" required></label>
            <label class="field">Assertion<input name="assertion" value="attacker drained 10 ETH with 1 ETH deposited" required></label>
            <label class="field">Output (optional)<textarea name="output" style="min-height:70px"></textarea></label>
            <div class="row"><label class="toggle"><input type="checkbox" name="passed" checked><span>Test passed</span></label><button class="primary" type="submit">Attach proof</button></div>
          </form>
        </div>
        <div class="card">
          <div class="row spread"><h2>Generated harness</h2>${poc?.harness ? `<button id="copyHarness" type="button">Copy</button>` : ""}</div>
          ${poc?.harness ? `<div class="code harness"><pre><code>${esc(poc.harness)}</code></pre></div>`
            : `<p class="muted">SRP did not generate a harness for this detector. ${esc(finding.proofOfConcept)}</p>`}
        </div>
      </section>`;
  },

  reports() {
    return `
      <section class="hero"><p class="eyebrow">Reports</p><h2 class="display">Take it <em>anywhere.</em></h2>
        <p class="lede">SARIF 2.1.0 for code scanning, an evidence bundle (<code>srp.evidence-bundle/v1</code>, sha256 digest) for reviewers, and a markdown report.</p></section>
      <section class="stack">${state.audits.length ? state.audits.map((a, i) => `
        <div class="item" style="animation-delay:${i * 60}ms">
          <span class="logo" aria-hidden="true" style="background:var(--card-2);color:var(--ink)">${esc(a.protocol.name[0] || "?")}</span>
          <span><div class="title">${esc(a.protocol.name)}</div><div class="sub">${a.findings.length} findings, ${when(a.generatedAt)}</div></span>
          <div class="row">
            <button data-export="sarif" data-id="${esc(a.id)}">SARIF</button>
            <button data-export="bundle" data-id="${esc(a.id)}">Evidence</button>
            <button data-export="md" data-id="${esc(a.id)}">Markdown</button>
            <button class="ghost" data-export="verify" data-id="${esc(a.id)}">Verify</button>
          </div>
        </div>`).join("") : `<p class="empty">No audits to export.</p>`}</section>
      <section class="card"><h2>Preview</h2><div id="reportPreview" class="muted small">Pick an export to preview it here.</div></section>`;
  },

  monitoring() {
    const open = state.incidents.filter((i) => i.status === "open").length;
    return `
      <section class="hero"><p class="eyebrow">Runtime monitoring</p><h2 class="display">${open ? `<em>${open}</em> open incident${open === 1 ? "" : "s"}.` : "Calm waters."}</h2>
        <p class="lede">Incidents come from signals you post to <code>/api/signals</code>. SRP does not watch chains itself.</p>
        <div class="row" style="margin-top:18px"><button id="simulate" class="primary">Simulate treasury signal</button></div></section>
      <section class="stack">${state.incidents.length ? state.incidents.map((i, n) => `
        <div class="item" style="animation-delay:${n * 60}ms">
          ${sev(i.severity)}
          <span><div class="title">${esc(i.title)}</div><div class="sub">${esc(i.protocol)}: ${i.evidence.map(esc).join("; ")}. ${when(i.createdAt)}</div></span>
          <div class="row">${pill(i.status)}${["acknowledged", "resolved", "open"].filter((s) => s !== i.status).map((s) => `<button class="ghost" data-incident="${esc(i.id)}" data-status="${s}">${s === "open" ? "Reopen" : s === "acknowledged" ? "Acknowledge" : "Resolve"}</button>`).join("")}</div>
        </div>`).join("") : `<p class="empty">No incidents.</p>`}</section>`;
  },

  tools() {
    const group = (chain) => TOOLS.filter((t) => t.chain === chain).map((t, i) => `
      <div class="item" style="animation-delay:${i * 40}ms">
        <span class="pill">${esc(t.kind)}</span>
        <span><div class="title">${t.url ? `<a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.name)}</a>` : esc(t.name)}</div><div class="sub">${esc(t.about)}</div></span>
        <span class="pill ${t.status === "built-in" ? "ok" : ""}">${t.status === "built-in" ? "Built-in" : "Planned integration"}</span>
      </div>`).join("");
    return `
      <section class="hero"><p class="eyebrow">Analyzers</p><h2 class="display">One report, <em>many eyes.</em></h2>
        <p class="lede">SRP's own analyzers run today. External static and dynamic tools are planned integrations; when wired, their results merge into SRP findings and duplicates collapse by file, line and topic.</p></section>
      <section class="card">
        <h2>Solodit search</h2>
        <form id="soloditForm" class="searchbar" style="box-shadow:none;background:var(--card-2)">
          <span aria-hidden="true" class="muted">⌕</span>
          <input name="q" placeholder="Search real-world audit findings, for example: reentrancy withdraw" aria-label="Solodit keywords">
          <button class="primary" type="submit">Search Solodit</button>
        </form>
        <p class="small muted" style="margin-bottom:0">Opens solodit.cyfrin.io with your keywords copied. In-app results come once the Solodit API is wired.</p>
      </section>
      <h2 class="display" style="font-size:1.5rem;margin:6px 4px 0">EVM</h2>
      <section class="stack">${group("evm")}</section>
      <h2 class="display" style="font-size:1.5rem;margin:6px 4px 0">Solana</h2>
      <section class="stack">${group("solana")}</section>`;
  },

  battlechain() {
    const proven = allFindings().filter((f) => f.status === "proven");
    const audit = state.audits[0];
    return `
      <section class="hero"><p class="eyebrow">After proof</p><h2 class="display">Battle-test on <em>BattleChain.</em></h2>
        <p class="lede">BattleChain is a pre-mainnet ZKsync-based L2 (mainnet chain ID 626, testnet 627). Protocols deploy audited contracts with real funds, adopt Safe Harbor, and let whitehats legally attack them for bounties before promoting to production. SRP is not affiliated with Cyfrin or BattleChain.</p>
        <div class="row" style="margin-top:16px"><a class="btn" href="https://battlechain.com" target="_blank" rel="noopener">battlechain.com</a><a class="btn" href="https://docs.battlechain.com" target="_blank" rel="noopener">Docs</a></div></section>
      <section class="card">
        <div class="row spread"><h2 style="margin:0">${esc(audit?.protocol?.name || "Protocol")} lifecycle</h2><span class="pill">Demo state: ${esc(BATTLE_DEMO.state)}</span></div>
        <ol class="track">${BATTLE_STEPS.map(([name, about], i) => `
          <li class="${i < BATTLE_DEMO.step ? "done" : i === BATTLE_DEMO.step ? "now" : ""}"><span class="node" aria-hidden="true">${i < BATTLE_DEMO.step ? "✓" : i + 1}</span><strong>${name}</strong><span class="small muted">${about}</span></li>`).join("")}</ol>
        <p class="small muted" style="margin-bottom:0">${esc(BATTLE_DEMO.network)}. States: attack requested, UNDER_ATTACK, PROMOTION_REQUESTED, production. Deploy scripts can use the Foundry library <code>cyfrin/battlechain-lib</code>.</p>
      </section>
      <section class="grid cols-2">
        <div class="card">
          <h2>Safe Harbor bounty terms</h2>
          <p class="small muted">Example terms for the demo. The protocol sets the real ones in its Safe Harbor agreement.</p>
          <dl class="kv">
            <dt>Bounty</dt><dd>10% of funds recovered</dd>
            <dt>Cap</dt><dd>$250,000 per incident</dd>
            <dt>Return to</dt><dd>Protocol recovery address</dd>
            <dt>Identity</dt><dd>Not required for eligible whitehats</dd>
            <dt>Scope</dt><dd>${esc(audit?.protocol?.sources?.map((x) => x.path).join(", ") || "Vault.sol")}</dd>
          </dl>
        </div>
        <div class="card">
          <h2>Ready for BattleChain</h2>
          <p class="small muted">Findings proven by a local test run. Fix these before requesting Attack Mode.</p>
          <ul class="mini-list">${proven.length ? proven.map((f) => `<li><a href="#/finding?audit=${encodeURIComponent(f.audit.id)}&id=${encodeURIComponent(f.id)}">${esc(f.title)}</a>${sev(f.severity)}</li>`).join("") : `<li class="muted">No proven findings yet.</li>`}</ul>
          <button class="primary" type="button" id="requestAttack" style="margin-top:14px">Request Attack Mode</button>
        </div>
      </section>`;
  },

  settings() {
    const caps = state.capabilities;
    return `
      <section class="hero"><p class="eyebrow">Settings</p><h2 class="display">Connection and <em>doctor.</em></h2></section>
      <section class="grid cols-2">
        <form class="card" id="settingsForm">
          <h2>Connection</h2>
          <div class="grid" style="gap:12px">
            <label class="field">API base URL<input name="base" value="${esc(store.base)}" placeholder="Same origin (http://localhost:8080)"></label>
            <label class="field">API token<input name="token" type="password" value="${esc(store.token)}" autocomplete="off" placeholder="srp_demo_admin_token for local dev"></label>
            <label class="toggle"><input type="checkbox" name="demo" ${store.demo ? "checked" : ""}><span>Demo mode (use built-in sample data)</span></label>
            <div class="row"><button class="primary" type="submit">Save and reconnect</button><button type="button" id="useDemoToken">Use local demo token</button></div>
            <p class="small muted">Status: ${esc(state.reason)}${state.health ? `. Server reports ${state.health.audits} audits, ${state.health.incidents} incidents.` : ""}</p>
          </div>
        </form>
        <div class="card">
          <h2>Doctor</h2>
          ${caps ? `
            <dl class="kv"><dt>Version</dt><dd>${esc(caps.version)}</dd><dt>Report schema</dt><dd class="mono">${esc(caps.reportSchema)}</dd><dt>Chains</dt><dd>${caps.chains.map(esc).join(", ")}</dd></dl>
            <h3>Local tools</h3>
            <ul class="list">${caps.tools.map((t) => `<li><span><strong>${esc(t.id)}</strong> <span class="muted small">${esc(t.purpose)}</span></span>${pill(t.available ? "ok" : "missing")}</li>`).join("")}</ul>
            <h3>Not built yet</h3><ul class="small">${caps.notBuilt.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : `<p class="muted">Capabilities unavailable.</p>`}
        </div>
      </section>
      ${caps ? `<section class="grid cols-2">
        <div class="card"><h2>Analyzers</h2><ul class="list">${caps.analyzers.map((a) => `<li><span><strong class="mono">${esc(a.id)}</strong><div class="muted small">${esc(a.description)}</div></span><span class="pill">${a.languages.map(esc).join(", ")}</span></li>`).join("")}</ul></div>
        <div class="card"><h2>Detectors (${caps.detectors.length})</h2><ul class="list">${caps.detectors.map((d) => `<li><span><strong class="mono small">${esc(d.id)}</strong><div class="muted small">${esc(d.summary)}</div></span>${sev(d.severity)}</li>`).join("")}</ul></div>
      </section>` : ""}`;
  }
};

const TITLES = { tools: "Analyzers", battlechain: "BattleChain", overview: "Overview", scan: "New Scan", findings: "Findings", finding: "Finding", reports: "Reports", monitoring: "Monitoring", settings: "Settings" };

function evidenceBlock(audit, e) {
  const source = sourceFor(audit, e.file);
  let body;
  if (source) {
    const lines = source.split("\n");
    const from = Math.max(1, e.startLine - 3);
    const to = Math.min(lines.length, e.endLine + 3);
    body = lines.slice(from - 1, to).map((text, i) => {
      const n = from + i;
      const hit = n >= e.startLine && n <= e.endLine;
      return `<span class="ln${hit ? " hit" : ""}"><span class="n">${n}</span>${esc(text)}</span>`;
    }).join("");
  } else {
    body = `<span class="ln hit"><span class="n">${e.startLine}</span>${esc(e.excerpt)}</span>`;
  }
  return `<div style="margin-bottom:14px">
    <div class="row small" style="margin-bottom:6px"><span class="mono">${esc(e.file)}:L${e.startLine}${e.endLine !== e.startLine ? `-L${e.endLine}` : ""}</span><span class="pill">${esc(e.kind)}</span><span class="muted">${esc(e.rationale)}</span></div>
    <div class="code"><pre><code>${body}</code></pre></div></div>`;
}

function renderFindingsTable() {
  const f = state.filters;
  const q = f.q.toLowerCase();
  const rows = allFindings().filter((x) =>
    (!f.severity || x.severity === f.severity) && (!f.status || x.status === f.status) &&
    (!f.detector || x.detector === f.detector) && (!f.audit || x.audit.id === f.audit) &&
    (!q || [x.title, x.detector, x.context?.function, ...x.evidence.map((e) => e.file)].join(" ").toLowerCase().includes(q))
  ).sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));
  const extra = f.severity && f.severity !== "medium" || f.status || f.detector ? [] : state.audits.filter((a) => !f.audit || a.id === f.audit).flatMap((a) => externalOnly(a).map((x) => ({ ...x, audit: a })));
  const extraHtml = extra.length ? `<h2 class="display" style="font-size:1.3rem;margin:26px 4px 12px">Only external tools flagged</h2><div class="stack">${extra.map((x) => `<div class="item">${sev(x.severity)}<span><div class="title">${esc(x.title)}</div><div class="sub"><span class="loc">${esc(x.file)}:L${x.line}</span>, ${esc(toolName(x.tool))} <span class="mono">${esc(x.check)}</span>. Demo data, not yet triaged by SRP.</div></span>${pill("unverified")}</div>`).join("")}</div>` : "";
  $("#findingsTable").innerHTML = (rows.length ? `<p class="small muted" style="margin:0 4px 12px">${rows.length} finding${rows.length === 1 ? "" : "s"}</p><div class="stack">${rows.map((x, i) => `
    <a class="item" style="animation-delay:${i * 50}ms" href="#/finding?audit=${encodeURIComponent(x.audit.id)}&id=${encodeURIComponent(x.id)}">
      ${sev(x.severity)}
      <span><div class="title">${esc(x.title)}</div><div class="sub"><span class="loc">${esc(x.evidence[0]?.file)}:L${x.evidence[0]?.startLine ?? "?"}</span>, ${esc(x.audit.protocol.name)}, <span class="mono">${esc(x.detector)}</span></div><div class="row" style="margin-top:8px;gap:6px">${toolChips(foundBy(x.audit, x))}</div></span>
      <span class="row" style="justify-content:flex-end">${battleBadge(x)}${pill(x.status)}</span>
    </a>`).join("")}</div>` : `<p class="empty">No findings match these filters.</p>`) + extraHtml;
}

const wait = (ms) => new Promise((r) => setTimeout(r, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms));
const STAGE_LABEL = { intent: "Intent", discovery: "Discovery", debate: "DynaDebate", validation: "Validation", coverage: "Coverage" };

function bubble(html, who = "srp") {
  const node = document.createElement("div");
  node.className = `bubble ${who}`;
  node.innerHTML = who === "srp" ? `<div class="sender"><span class="logo" aria-hidden="true">S</span>SRP</div>${html}` : html;
  $("#thread").append(node);
  node.scrollIntoView({ behavior: "smooth", block: "nearest" });
  return node;
}

function findingCard(audit, f) {
  return `<details class="fcard">
    <summary>${sev(f.severity)}<span><strong>${esc(f.title)}</strong> ${battleBadge(f)}<div class="loc">${esc(f.evidence[0]?.file)}:L${f.evidence[0]?.startLine ?? "?"}</div></span></summary>
    <div class="body">
      <p style="margin:0">${esc(f.impact)}</p>
      ${f.evidence[0] ? `<div class="code"><pre><code><span class="ln hit"><span class="n">${f.evidence[0].startLine}</span>${esc(f.evidence[0].excerpt)}</span></code></pre></div>` : ""}
      <div class="row small"><span class="muted">Found by</span>${toolChips(foundBy(audit, f))}</div>
      <p class="small muted" style="margin:0">Fix: ${esc(f.remediation)}</p>
      <div class="row">${pill(f.status)}<a class="btn" href="#/finding?audit=${encodeURIComponent(audit.id)}&id=${encodeURIComponent(f.id)}">Open evidence, debate and harness</a></div>
    </div></details>`;
}

async function runScan(form) {
  const data = new FormData(form);
  const chain = data.get("chain");
  const solana = chain === "solana";
  const sources = state.files.length ? state.files : [{ path: solana ? "lib.rs" : "Vault.sol", language: solana ? "rust" : "solidity", content: data.get("source") }];
  const body = { name: data.get("name"), chain, documents: [{ path: "README.md", kind: "README", content: data.get("docs") }], sources };
  const button = $("#runBtn");
  button.disabled = true;
  const preview = sources[0].content.split("\n").slice(0, 8).join("\n");
  bubble(`<div>${esc(body.name)} on ${esc(chain)}. ${esc(body.documents[0].content)}</div>
    <div class="chips" style="margin-top:8px">${sources.map((s) => `<span class="pill">${esc(s.path)}</span>`).join("")}</div>
    <div class="code"><pre><code>${esc(preview)}${sources[0].content.split("\n").length > 8 ? "\n..." : ""}</code></pre></div>`, "me");
  await wait(300);
  const reply = bubble(`<div id="replyText">Reading the contract and your intent</div><div class="typing" aria-label="Working"><span></span><span></span><span></span></div>
    <div class="stages">${STAGES.map((s) => `<span data-stage="${s}">${STAGE_LABEL[s]}</span>`).join("")}</div>`);
  try {
    let audit;
    const tick = async () => { for (const s of STAGES) { await wait(380); reply.querySelector(`[data-stage="${s}"]`)?.classList.add("done"); } };
    if (state.live) {
      const [result] = await Promise.all([api("/api/audits", { method: "POST", body: JSON.stringify(body) }), tick()]);
      audit = result;
      state.audits.unshift(audit);
    } else {
      // wire later: demo mode cannot run the analyzer in the browser, so it replays the sample Vault audit.
      await tick();
      audit = state.audits[0];
    }
    reply.querySelector(".typing").remove();
    const n = audit.findings.length;
    reply.querySelector("#replyText").removeAttribute("id");
    reply.firstElementChild.nextElementSibling.textContent = n
      ? `Found ${n} issue${n === 1 ? "" : "s"} in ${audit.coverage?.analyzedFiles ?? sources.length} file${(audit.coverage?.analyzedFiles ?? 1) === 1 ? "" : "s"}, coverage ${pct(audit.coverage?.ratio)}.${state.live ? "" : " (Demo data: the sample Vault audit.)"}`
      : `No findings. Coverage ${pct(audit.coverage?.ratio)}.`;
    for (const f of audit.findings.slice().sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity))) {
      await wait(420);
      reply.insertAdjacentHTML("beforeend", findingCard(audit, f));
      reply.scrollIntoView({ behavior: "smooth", block: "end" });
    }
    const planned = [...document.querySelectorAll("[data-tool][aria-pressed=true]")].map((b) => TOOLS.find((t) => t.id === b.dataset.tool)).filter((t) => t && t.status !== "built-in");
    if (planned.length) reply.insertAdjacentHTML("beforeend", `<p class="small muted">${planned.map((t) => esc(t.name)).join(", ")} ${planned.length === 1 ? "is a" : "are"} planned integration${planned.length === 1 ? "" : "s"} and did not run.${state.live ? "" : " Demo findings show sample corroboration from external tools."}</p>`);
    if ((audit.unknowns || []).length) reply.insertAdjacentHTML("beforeend", `<p class="small muted">Not analyzed: ${audit.unknowns.map((u) => `${esc(u.file)} (${esc(u.reason)})`).join("; ")}</p>`);
    await wait(300);
    bubble(`Want the full write-up? <a href="#/reports">Export SARIF, evidence bundle or markdown</a>, or open a finding to run its Foundry harness and attach the result.`);
  } catch (error) {
    reply.querySelector(".typing")?.remove();
    reply.insertAdjacentHTML("beforeend", `<p style="color:var(--critical);margin:8px 0 0">Scan failed: ${esc(error.message)}</p>`);
  } finally {
    button.disabled = false;
  }
}

async function readFiles(fileList) {
  const accepted = [...fileList].filter((f) => /\.(sol|rs)$/.test(f.name));
  state.files = await Promise.all(accepted.map(async (f) => ({ path: f.name, language: f.name.endsWith(".rs") ? "rust" : "solidity", content: await f.text() })));
  $("#fileList").innerHTML = state.files.length ? `${state.files.map((f) => `<span class="pill">${esc(f.path)}</span>`).join("")}<button type="button" class="chip" id="clearFiles">Clear files</button>` : "";
}

async function attachProof(form, auditId, findingId) {
  const data = new FormData(form);
  const proof = { findingId, command: data.get("command"), passed: data.get("passed") === "on", assertion: data.get("assertion"), output: data.get("output") || undefined };
  try {
    if (state.live) {
      const updated = await api(`/api/audits/${auditId}/proofs`, { method: "POST", body: JSON.stringify({ proofs: [proof] }) });
      const full = updated?.findings ? updated : await api(`/api/audits/${auditId}`);
      state.audits = state.audits.map((a) => a.id === auditId ? full : a);
    } else {
      // wire later: demo mode updates the finding locally; the API re-runs validation server side.
      const { audit, finding } = findFinding(auditId, findingId);
      finding.status = proof.passed ? "proven" : "failed";
      if (proof.passed && finding.proposedSeverity) finding.severity = finding.proposedSeverity;
      const poc = audit.pocResults.find((p) => p.findingId === findingId);
      if (poc) Object.assign(poc, { classification: finding.status, executed: true, evidence: [`${proof.command}: ${proof.assertion}`] });
    }
    toast(proof.passed ? "Proof attached, finding marked proven" : "Failed proof recorded");
    route();
  } catch (error) {
    toast(`Attach failed: ${error.message}`);
  }
}

async function exportReport(kind, id) {
  const preview = $("#reportPreview");
  try {
    const mock = MOCK.exports?.[id];
    if (kind === "verify") {
      let result;
      if (state.live) {
        const bundle = await api(`/api/audits/${id}/evidence`);
        result = await api("/api/evidence-bundles/verify", { method: "POST", body: JSON.stringify(bundle) });
      } else {
        result = { valid: Boolean(mock?.bundle?.digest), note: "wire later: demo mode checks presence only" };
      }
      preview.innerHTML = `<pre class="mono">${esc(JSON.stringify(result, null, 2))}</pre>`;
      return toast(result.valid ? "Bundle verified" : "Bundle invalid");
    }
    const path = kind === "bundle" ? `/api/audits/${id}/evidence` : `/api/reports/${id}.${kind}`;
    const content = state.live ? await api(path) : (kind === "bundle" ? mock?.bundle : mock?.[kind]);
    if (!content) throw new Error("No demo export for this audit");
    const name = kind === "md" ? `${id}.md` : kind === "sarif" ? `${id}.sarif` : `${id}.evidence.json`;
    const text = typeof content === "string" ? content : JSON.stringify(content, null, 2);
    preview.innerHTML = `<div class="row spread" style="margin-bottom:12px"><strong style="color:var(--ink)">${esc(name)}</strong><button class="primary" type="button" id="dl">Download</button></div><div class="code harness"><pre><code>${esc(text.slice(0, 6000))}${text.length > 6000 ? "\n..." : ""}</code></pre></div>`;
    $("#dl").addEventListener("click", () => download(name, content, kind === "md" ? "text/markdown" : "application/json"));
  } catch (error) {
    toast(`Export failed: ${error.message}`);
  }
}

async function simulateSignal() {
  const protocol = state.audits[0]?.protocol?.name || "Vault";
  const signal = { protocol, chain: "ethereum", source: "treasury", metric: "outflow_usd", value: 2500000, threshold: 500000 };
  try {
    if (state.live) {
      const result = await api("/api/signals", { method: "POST", body: JSON.stringify(signal) });
      if (result.incident) state.incidents.unshift(result.incident);
    } else {
      // wire later: demo mode fabricates the incident locally for the walkthrough.
      state.incidents.unshift({ id: `inc_demo_${Date.now()}`, protocol, severity: "critical", title: "Treasury outflow above threshold", evidence: [`treasury outflow_usd ${signal.value} > threshold ${signal.threshold}`, "chain ethereum"], createdAt: new Date().toISOString(), status: "open" });
    }
    toast("Incident created");
    route();
  } catch (error) {
    toast(`Signal failed: ${error.message}`);
  }
}

async function setIncident(id, status) {
  try {
    if (state.live) {
      const updated = await api(`/api/incidents/${id}`, { method: "POST", body: JSON.stringify({ status }) });
      const fresh = updated?.incident || updated;
      state.incidents = state.incidents.map((i) => i.id === id ? { ...i, ...fresh, status } : i);
    } else {
      state.incidents = state.incidents.map((i) => i.id === id ? { ...i, status } : i);
    }
    route();
  } catch (error) {
    toast(`Update failed: ${error.message}`);
  }
}

// ---------- router ----------

function route() {
  const [name, query] = (location.hash.replace(/^#\//, "") || "overview").split("?");
  const view = views[name] ? name : "overview";
  const params = new URLSearchParams(query || "");
  $("#view").innerHTML = views[view](params);
  $("#viewTitle").textContent = TITLES[view];
  document.title = `${TITLES[view]} | SRP Console`;
  document.querySelectorAll("[data-nav]").forEach((a) => {
    const active = a.dataset.nav === view || (view === "finding" && a.dataset.nav === "findings");
    a.classList.toggle("active", active);
    if (active) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  const badge = $("#modeBadge");
  badge.innerHTML = `<span class="dot ${state.live ? "live" : "demo"}"></span>${state.live ? "Live API" : "Demo data"}`;
  badge.className = "badge";
  $("#connDot").className = `dot ${state.live ? "live" : "demo"}`;
  $("#connStatus").textContent = state.reason;
  $("#demoToggle").checked = store.demo;
  bind(view, params);
}

function bind(view, params) {
  document.querySelectorAll("tr[data-href]").forEach((row) => {
    row.addEventListener("click", () => location.hash = row.dataset.href);
    row.addEventListener("keydown", (e) => { if (e.key === "Enter") location.hash = row.dataset.href; });
  });
  if (view === "findings") {
    renderFindingsTable();
    for (const key of ["q", "status", "detector", "audit"]) {
      $(`#f${key}`).addEventListener(key === "q" ? "input" : "change", (e) => { state.filters[key] = e.target.value; renderFindingsTable(); });
    }
    document.querySelectorAll("[data-sev]").forEach((chip) => chip.addEventListener("click", () => {
      state.filters.severity = chip.dataset.sev;
      document.querySelectorAll("[data-sev]").forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
      renderFindingsTable();
    }));
  }
  if (view === "scan") {
    state.files = [];
    const form = $("#scanForm");
    form.addEventListener("submit", (e) => { e.preventDefault(); runScan(form); });
    form.chain.addEventListener("change", () => {
      const solana = form.chain.value === "solana";
      form.source.value = solana ? SAMPLE_ANCHOR : SAMPLE_SOL;
    });
    const picker = (chain) => TOOLS.filter((t) => t.chain === chain).map((t) => `<button type="button" class="chip" data-tool="${t.id}" aria-pressed="${t.status === "built-in"}">${esc(t.name)}${t.status === "built-in" ? "" : " (planned)"}</button>`).join("");
    form.chain.addEventListener("change", () => { $("#toolPicker").innerHTML = picker(form.chain.value === "solana" ? "solana" : "evm"); });
    $("#toolPicker").addEventListener("click", (e) => {
      const chip = e.target.closest("[data-tool]");
      if (chip) chip.setAttribute("aria-pressed", String(chip.getAttribute("aria-pressed") !== "true"));
    });
    $("#loadSample").addEventListener("click", () => { form.source.value = form.chain.value === "solana" ? SAMPLE_ANCHOR : SAMPLE_SOL; });
    $("#fileInput").addEventListener("change", (e) => readFiles(e.target.files));
    const zone = form;
    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("over"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("over"));
    zone.addEventListener("drop", (e) => { e.preventDefault(); zone.classList.remove("over"); readFiles(e.dataTransfer.files); });
    $("#fileList").addEventListener("click", (e) => { if (e.target.id === "clearFiles") { state.files = []; $("#fileList").innerHTML = ""; } });
  }
  if (view === "finding") {
    const auditId = params.get("audit");
    const findingId = params.get("id");
    $("#copyHarness")?.addEventListener("click", () => copy(findFinding(auditId, findingId).audit.pocResults.find((p) => p.findingId === findingId).harness));
    $("#proofForm")?.addEventListener("submit", (e) => { e.preventDefault(); attachProof(e.target, auditId, findingId); });
  }
  document.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", () => copy(b.dataset.copy)));
  if (view === "tools") {
    $("#soloditForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const q = e.target.q.value.trim();
      if (q) navigator.clipboard?.writeText(q).catch(() => {});
      window.open("https://solodit.cyfrin.io/", "_blank", "noopener");
      toast(q ? "Keywords copied. Paste them into Solodit search." : "Opening Solodit");
    });
  }
  if (view === "battlechain") {
    // wire later: needs a wallet and the AttackRegistry contract; demo only advances local state.
    $("#requestAttack").addEventListener("click", () => {
      if (BATTLE_DEMO.step < 3) Object.assign(BATTLE_DEMO, { step: 3, state: "ATTACK_REQUESTED" });
      else if (BATTLE_DEMO.step < 5) Object.assign(BATTLE_DEMO, { step: BATTLE_DEMO.step + 1, state: BATTLE_DEMO.step + 1 === 4 ? "UNDER_ATTACK" : "PROMOTION_REQUESTED" });
      toast(`Demo: ${BATTLE_DEMO.state}`);
      route();
    });
  }
  if (view === "reports") {
    document.querySelectorAll("[data-export]").forEach((b) => b.addEventListener("click", () => exportReport(b.dataset.export, b.dataset.id)));
  }
  if (view === "monitoring") {
    $("#simulate").addEventListener("click", simulateSignal);
    document.querySelectorAll("[data-incident]").forEach((b) => b.addEventListener("click", () => setIncident(b.dataset.incident, b.dataset.status)));
  }
  if (view === "settings") {
    const form = $("#settingsForm");
    $("#useDemoToken").addEventListener("click", () => { form.token.value = "srp_demo_admin_token"; form.demo.checked = false; });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      store.base = form.base.value.trim();
      store.token = form.token.value.trim();
      store.demo = form.demo.checked;
      await reconnect();
      toast(state.live ? "Connected to SRP API" : state.reason);
    });
  }
}

async function reconnect() {
  state.events?.close();
  state.events = null;
  await load();
  route();
}

// ---------- boot ----------

$("#demoToggle").addEventListener("change", async (e) => { store.demo = e.target.checked; await reconnect(); });
$("#themeToggle").checked = document.documentElement.dataset.theme === "dark";
$("#themeToggle").addEventListener("change", (e) => {
  const theme = e.target.checked ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("srp.theme", theme);
});
$("#menuBtn").addEventListener("click", () => {
  const open = $("#sidebar").classList.toggle("open");
  $("#menuBtn").setAttribute("aria-expanded", String(open));
});
$("#sidebar").addEventListener("click", (e) => { if (e.target.matches("nav a")) { $("#sidebar").classList.remove("open"); $("#menuBtn").setAttribute("aria-expanded", "false"); } });
window.addEventListener("hashchange", () => { route(); $("#view").focus({ preventScroll: true }); window.scrollTo(0, 0); });

if (localStorage.getItem("srp.demo") === null) store.demo = !store.token;
load().then(route);
