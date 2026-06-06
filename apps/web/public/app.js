// SVG Icons
const icons = {
  shield: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  bug: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="6" width="8" height="12" rx="4"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M20 9h-4"/><path d="M8 9H4"/><path d="M20 15h-4"/><path d="M8 15H4"/><path d="M18 19l-2-2"/><path d="M8 7L6 5"/><path d="M18 5l-2 2"/><path d="M8 17l-2 2"/></svg>`,
  activity: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  checkCircle: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  download: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  trash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
  chevronDown: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`
};

// State Management
const state = {
  token: 'srp_demo_admin_token',
  role: 'admin',
  stats: null,
  audits: [],
  incidents: [],
  auditLog: [],
  protocols: [],
  events: [],
  connected: false,
  eventSource: null
};

// Elements
const els = {
  sidebar: document.getElementById('sidebar'),
  overlay: document.getElementById('sidebar-overlay'),
  hamburgerBtn: document.getElementById('hamburger-btn'),
  statusDot: document.getElementById('status-dot'),
  statusText: document.getElementById('status-text'),
  pageTitle: document.getElementById('page-title'),
  pageSubtitle: document.getElementById('page-subtitle'),
  liveIndicator: document.getElementById('live-indicator'),
  topbarRole: document.getElementById('topbar-role'),
  routerView: document.getElementById('router-view'),
  toastContainer: document.getElementById('toast-container')
};

// API Client
async function api(path, options = {}) {
  const headers = {
    'Authorization': \`Bearer \${state.token}\`,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  
  try {
    const res = await fetch(path, { ...options, headers });
    if (!res.ok) {
      let msg = res.statusText;
      try {
        const errJson = await res.json();
        msg = errJson.error || msg;
      } catch (e) {
        msg = await res.text() || msg;
      }
      throw new Error(msg);
    }
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await res.json();
    }
    return await res.text();
  } catch (error) {
    console.error(\`API Error (\${path}):\`, error);
    throw error;
  }
}

// SSE Connection
function connectEvents() {
  if (state.eventSource) {
    state.eventSource.close();
  }
  
  els.statusDot.className = 'status-dot connecting';
  els.statusText.textContent = 'Connecting...';
  
  state.eventSource = new EventSource(\`/api/events?token=\${state.token}\`);
  
  state.eventSource.onopen = () => {
    state.connected = true;
    els.statusDot.className = 'status-dot connected';
    els.statusText.textContent = 'Connected';
    els.liveIndicator.style.display = 'flex';
  };
  
  state.eventSource.onerror = (err) => {
    state.connected = false;
    els.statusDot.className = 'status-dot error';
    els.statusText.textContent = 'Disconnected';
    els.liveIndicator.style.display = 'none';
    console.error('SSE Error', err);
  };
  
  state.eventSource.addEventListener('ready', (e) => {
    const data = JSON.parse(e.data);
    addEvent({ type: 'ready', ...data });
  });
  
  state.eventSource.addEventListener('audit.created', (e) => {
    const data = JSON.parse(e.data);
    addEvent({ type: 'audit.created', ...data });
    showToast(\`Audit completed for \${data.protocol}\`, 'success');
    if (location.hash === '' || location.hash === '#dashboard' || location.hash === '#audits') {
      route(); // Refresh current view
    }
  });
  
  state.eventSource.addEventListener('incident.created', (e) => {
    const data = JSON.parse(e.data);
    addEvent({ type: 'incident.created', ...data });
    showToast(\`New incident: \${data.incident.title}\`, 'error');
    if (location.hash === '' || location.hash === '#dashboard' || location.hash === '#monitoring') {
      route(); // Refresh current view
    }
  });
}

function addEvent(evt) {
  state.events.unshift(evt);
  if (state.events.length > 50) state.events.pop();
}

// Router
window.addEventListener('hashchange', route);

async function route() {
  const hash = window.location.hash || '#dashboard';
  const path = hash.split('?')[0];
  const parts = path.split('/');
  const routeName = parts[0].substring(1); // remove #
  
  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const activeNav = document.getElementById(\`nav-\${routeName.split('-')[0]}\`) || document.getElementById(\`nav-\${routeName}\`);
  if (activeNav) activeNav.classList.add('active');
  
  els.routerView.innerHTML = '<div class="view-loading"><div class="loading-spinner"><div class="spinner-ring"></div></div><p>Loading view...</p></div>';
  
  try {
    switch (routeName) {
      case 'dashboard':
        await renderDashboard();
        break;
      case 'new-audit':
        renderNewAudit();
        break;
      case 'audits':
        await renderAudits();
        break;
      case 'audit':
        await renderAuditDetail(parts[1]);
        break;
      case 'findings':
        await renderFindings();
        break;
      case 'monitoring':
        await renderMonitoring();
        break;
      case 'reports':
        await renderReports();
        break;
      case 'audit-log':
        await renderAuditLog();
        break;
      case 'settings':
        renderSettings();
        break;
      default:
        await renderDashboard();
        break;
    }
  } catch (err) {
    els.routerView.innerHTML = \`<div class="error-message"><h3>Error loading view</h3><p>\${escapeHtml(err.message)}</p></div>\`;
  }
  
  // Close sidebar on mobile after navigation
  els.sidebar.classList.remove('open');
  els.overlay.classList.remove('active');
}

// View Renderers

async function renderDashboard() {
  els.pageTitle.textContent = 'Dashboard';
  els.pageSubtitle.textContent = 'Security operations overview';
  
  const statsRes = await api('/api/stats');
  state.stats = statsRes;
  
  const auditsRes = await api('/api/audits');
  const incidentsRes = await api('/api/incidents');
  
  const audits = auditsRes.audits.sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt)).slice(0, 5);
  const incidents = incidentsRes.incidents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  
  let html = \`
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-label">Total Audits</span>
          <div class="metric-icon blue">\${icons.shield}</div>
        </div>
        <div class="metric-value blue">\${formatNumber(statsRes.totalAudits)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-label">Vulnerabilities</span>
          <div class="metric-icon orange">\${icons.bug}</div>
        </div>
        <div class="metric-value orange">\${formatNumber(statsRes.totalFindings)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-label">Proven Exploits</span>
          <div class="metric-icon red">\${icons.activity}</div>
        </div>
        <div class="metric-value red">\${formatNumber(statsRes.provenCount)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-label">Open Incidents</span>
          <div class="metric-icon green">\${icons.shield}</div>
        </div>
        <div class="metric-value green">\${formatNumber(statsRes.totalIncidents)}</div>
      </div>
    </div>
    
    <div class="form-grid">
      <div class="card" style="margin-bottom: 0;">
        <div class="card-header">
          <h2 class="section-title">Recent Audits</h2>
          <a href="#audits" class="btn-secondary">View All</a>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Protocol</th>
                <th>Chain</th>
                <th>Findings</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              \${audits.length ? audits.map(a => \`
                <tr class="clickable" onclick="location.hash='#audit/\${a.id}'">
                  <td class="primary-cell">\${escapeHtml(a.protocol)}</td>
                  <td><span class="chain-badge">\${a.chain}</span></td>
                  <td><span class="severity-pill \${a.findings > 0 ? 'high' : 'informational'}">\${a.findings} total</span></td>
                  <td>\${formatDate(a.generatedAt)}</td>
                </tr>
              \`).join('') : '<tr><td colspan="4" class="text-center">No audits found.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
      
      <div class="card" style="margin-bottom: 0;">
        <div class="card-header">
          <h2 class="section-title">Live Events</h2>
        </div>
        <div class="events-feed">
          \${state.events.length ? state.events.slice(0, 8).map(e => \`
            <div style="padding: 12px; border-bottom: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; justify-content: space-between;">
                <span style="font-size: 12px; font-weight: 600; color: \${e.type === 'incident.created' ? 'var(--accent-red)' : 'var(--accent-green)'}">\${escapeHtml(e.type)}</span>
                <span style="font-size: 11px; color: var(--text-muted)">\${e.at ? formatDate(e.at) : 'Just now'}</span>
              </div>
              <div style="font-size: 13px; color: var(--text-secondary)">
                \${e.type === 'audit.created' ? \`Completed audit for <strong>\${escapeHtml(e.protocol)}</strong> (\${e.findings} findings)\` : 
                  e.type === 'incident.created' ? \`New incident: <strong>\${escapeHtml(e.incident?.title || 'Unknown')}</strong>\` :
                  \`Connected as \${escapeHtml(e.subject || 'Unknown')}\`}
              </div>
            </div>
          \`).join('') : '<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">Listening for events...</div>'}
        </div>
      </div>
    </div>
  \`;
  
  els.routerView.innerHTML = html;
}

function renderNewAudit() {
  els.pageTitle.textContent = 'New Audit';
  els.pageSubtitle.textContent = 'Submit a protocol for automated security analysis';
  
  els.routerView.innerHTML = \`
    <div class="card" style="max-width: 800px; margin: 0 auto;">
      <form id="audit-form" onsubmit="handleAuditSubmit(event)">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Protocol Name</label>
            <input type="text" id="input-name" class="form-input" required placeholder="e.g. Acme Protocol">
          </div>
          <div class="form-group">
            <label class="form-label">Chain Environment</label>
            <select id="input-chain" class="form-select" required>
              <option value="ethereum">Ethereum</option>
              <option value="arbitrum">Arbitrum</option>
              <option value="optimism">Optimism</option>
              <option value="base">Base</option>
              <option value="polygon">Polygon</option>
              <option value="avalanche">Avalanche</option>
              <option value="solana">Solana</option>
            </select>
          </div>
          
          <div class="form-group full">
            <label class="form-label">Protocol Documentation (Markdown)</label>
            <textarea id="input-docs" class="form-textarea" placeholder="# Architecture\\n\\nDescribe the protocol..."></textarea>
          </div>
          
          <div class="form-group full">
            <label class="form-label">Source Code</label>
            <textarea id="input-source" class="form-textarea" required placeholder="// Paste smart contract code here..."></textarea>
          </div>
        </div>
        
        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick="loadExample()">Load Example</button>
          <button type="submit" id="btn-submit" class="btn-primary">
            \${icons.shield} Run Audit Analysis
          </button>
        </div>
      </form>
    </div>
  \`;
}

// Make loadExample globally available
window.loadExample = () => {
  document.getElementById('input-name').value = 'VaultExample';
  document.getElementById('input-chain').value = 'ethereum';
  document.getElementById('input-docs').value = 'The Vault protocol allows users to deposit ETH and withdraw it later. The admin can upgrade the implementation contract. The protocol must always remain solvent.';
  document.getElementById('input-source').value = \`contract Vault {
    mapping(address => uint256) public balances;
    address public admin;
    
    constructor() {
        admin = msg.sender;
    }
    
    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }
    
    function withdraw() public {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No balance");
        
        // Vulnerable to reentrancy
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        
        balances[msg.sender] = 0;
    }
    
    function emergencyWithdraw() public {
        require(tx.origin == admin, "Not admin");
        selfdestruct(payable(admin));
    }
}\`;
};

window.handleAuditSubmit = async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-submit');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<div class="loading-spinner" style="width:20px;height:20px;"><div class="spinner-ring"></div></div> Processing...';
  btn.disabled = true;
  
  try {
    const payload = {
      name: document.getElementById('input-name').value,
      chain: document.getElementById('input-chain').value,
      documents: [{
        path: 'README.md',
        kind: 'README',
        content: document.getElementById('input-docs').value
      }],
      sources: [{
        path: 'Contract.sol',
        language: document.getElementById('input-chain').value === 'solana' ? 'rust' : 'solidity',
        content: document.getElementById('input-source').value
      }]
    };
    
    const res = await api('/api/audits', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    showToast('Audit completed successfully', 'success');
    window.location.hash = \`#audit/\${res.id}\`;
  } catch (err) {
    showToast(err.message, 'error');
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
};

async function renderAudits() {
  els.pageTitle.textContent = 'Audits';
  els.pageSubtitle.textContent = 'History of protocol security reviews';
  
  const res = await api('/api/audits');
  const audits = res.audits.sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));
  
  let html = \`
    <div class="card">
      <div class="card-header">
        <h2 class="section-title">All Audits (\${audits.length})</h2>
        <a href="#new-audit" class="btn-primary">\${icons.shield} New Audit</a>
      </div>
      \${audits.length === 0 ? \`
        <div class="empty-state">
          <div>\${icons.shield}</div>
          <h3>No audits yet</h3>
          <p>Run your first audit to see results here.</p>
          <a href="#new-audit" class="btn-primary" style="margin-top: 16px;">Create Audit</a>
        </div>
      \` : \`
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Protocol</th>
                <th>Chain</th>
                <th>Findings</th>
                <th>Proven</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              \${audits.map(a => \`
                <tr>
                  <td class="font-mono" style="font-size:12px;">\${a.id.substring(0,8)}...</td>
                  <td class="primary-cell clickable" onclick="location.hash='#audit/\${a.id}'">\${escapeHtml(a.protocol)}</td>
                  <td><span class="chain-badge">\${a.chain}</span></td>
                  <td>\${a.findings}</td>
                  <td><span class="status-badge \${a.verified > 0 ? 'proven' : 'failed'}">\${a.verified}</span></td>
                  <td>\${formatDate(a.generatedAt)}</td>
                  <td>
                    <div style="display:flex; gap:8px;">
                      <a href="#audit/\${a.id}" class="btn-secondary" style="padding:4px 8px;">View</a>
                      \${state.role === 'admin' ? \`<button class="btn-danger" onclick="deleteAudit('\${a.id}')">\${icons.trash}</button>\` : ''}
                    </div>
                  </td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        </div>
      \`}
    </div>
  \`;
  
  els.routerView.innerHTML = html;
}

window.deleteAudit = async (id) => {
  if (!confirm('Are you sure you want to delete this audit?')) return;
  try {
    await api(\`/api/audits/\${id}\`, { method: 'DELETE' });
    showToast('Audit deleted', 'success');
    route();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

async function renderAuditDetail(id) {
  try {
    const audit = await api(\`/api/audits/\${id}\`);
    els.pageTitle.textContent = audit.protocol.name;
    els.pageSubtitle.textContent = \`Audit Report: \${id} • \${formatDate(audit.generatedAt)}\`;
    
    // Sort findings by severity then confidence
    const severityOrder = { critical: 5, high: 4, medium: 3, low: 2, informational: 1 };
    const sortedFindings = [...audit.findings].sort((a, b) => {
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[b.severity] - severityOrder[a.severity];
      }
      return b.confidence - a.confidence;
    });
    
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, informational: 0 };
    audit.findings.forEach(f => severityCounts[f.severity]++);
    
    let html = \`
      <div class="form-grid" style="grid-template-columns: 2fr 1fr;">
        <div class="card">
          <h2 class="section-title" style="margin-bottom: 20px;">Protocol Intent & Threat Model</h2>
          <div class="form-grid" style="margin-bottom: 0;">
            <div>
              <div class="detail-label">Guarantees</div>
              <ul class="attack-path" style="margin-bottom: 16px;">
                \${audit.intent.securityGuarantees.length ? audit.intent.securityGuarantees.map(g => \`<li>\${escapeHtml(g)}</li>\`).join('') : '<li style="color:var(--text-muted)">None extracted</li>'}
              </ul>
              
              <div class="detail-label">Trust Boundaries</div>
              <div class="intent-tags" style="margin-bottom: 16px;">
                \${audit.intent.trustBoundaries.length ? audit.intent.trustBoundaries.map(b => \`<span class="intent-tag">\${escapeHtml(b)}</span>\`).join('') : '<span class="intent-tag">None</span>'}
              </div>
            </div>
            <div>
              <div class="detail-label">DeFi Primitives</div>
              <div class="intent-tags" style="margin-bottom: 16px;">
                \${audit.intent.defiPrimitives.length ? audit.intent.defiPrimitives.map(p => \`<span class="intent-tag">\${escapeHtml(p)}</span>\`).join('') : '<span class="intent-tag">None detected</span>'}
              </div>
              
              <div class="detail-label">Threat Actors</div>
              <div class="intent-tags">
                \${audit.intent.threatModel.actors.length ? audit.intent.threatModel.actors.map(a => \`<span class="intent-tag">\${escapeHtml(a)}</span>\`).join('') : '<span class="intent-tag">None identified</span>'}
              </div>
            </div>
          </div>
        </div>
        
        <div class="card">
          <h2 class="section-title" style="margin-bottom: 20px;">Summary</h2>
          <div style="display:flex; flex-direction:column; gap:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="severity-pill critical">Critical</span>
              <span style="font-weight:700;">\${severityCounts.critical}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="severity-pill high">High</span>
              <span style="font-weight:700;">\${severityCounts.high}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="severity-pill medium">Medium</span>
              <span style="font-weight:700;">\${severityCounts.medium}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="severity-pill low">Low</span>
              <span style="font-weight:700;">\${severityCounts.low}</span>
            </div>
            <div style="border-top: 1px solid var(--border-subtle); padding-top: 12px; display:flex; justify-content:space-between; align-items:center;">
              <span style="font-weight:600; color:var(--text-secondary)">Total Findings</span>
              <span style="font-weight:800; font-size:18px;">\${audit.findings.length}</span>
            </div>
            <a href="/api/reports/\${audit.id}.md" target="_blank" class="btn-primary" style="margin-top:16px;">
              \${icons.download} Download Report
            </a>
          </div>
        </div>
      </div>
      
      <h2 class="section-title" style="margin-bottom: 16px;">Security Findings (\${sortedFindings.length})</h2>
      
      <div class="findings-list">
        \${sortedFindings.length === 0 ? '<div class="empty-state">No vulnerabilities discovered.</div>' : ''}
        \${sortedFindings.map((f, i) => {
          const debate = audit.debates.find(d => d.findingId === f.id);
          const poc = audit.pocResults.find(p => p.findingId === f.id);
          
          return \`
            <div class="finding-card" id="finding-\${f.id}">
              <div class="finding-header" onclick="this.parentElement.classList.toggle('expanded')">
                <span class="severity-pill \${f.severity}">\${f.severity}</span>
                <div class="finding-title">\${i+1}. \${escapeHtml(f.title)}</div>
                <span class="status-badge \${f.status}">\${f.status}</span>
                <div class="finding-expand-icon">\${icons.chevronDown}</div>
              </div>
              <div class="finding-body">
                <div class="form-grid" style="margin-top:20px;">
                  <div class="detail-section">
                    <div class="detail-label">Impact</div>
                    <div class="detail-text">\${escapeHtml(f.impact)}</div>
                  </div>
                  <div class="detail-section">
                    <div class="detail-label">Confidence (\${Math.round(f.confidence * 100)}%)</div>
                    \${confidenceBarHTML(f.confidence, f.confidenceBand)}
                    <div class="detail-text" style="margin-top:8px; font-size:12px;">\${f.likelihood}</div>
                  </div>
                </div>
                
                <div class="detail-section">
                  <div class="detail-label">Attack Path</div>
                  <ul class="attack-path">
                    \${f.attackPath.map(p => \`<li>\${escapeHtml(p)}</li>\`).join('')}
                  </ul>
                </div>
                
                <div class="detail-section">
                  <div class="detail-label">Evidence</div>
                  \${f.evidence.map(e => \`
                    <div class="evidence-block">
                      <div class="evidence-meta">
                        <span>\${escapeHtml(e.file)}</span>
                        <span>Lines \${e.startLine}-\${e.endLine}</span>
                      </div>
                      <div class="evidence-code">\${escapeHtml(e.excerpt)}</div>
                      <div class="evidence-rationale">Rationale: \${escapeHtml(e.rationale)}</div>
                    </div>
                  \`).join('')}
                </div>
                
                <div class="detail-section">
                  <div class="detail-label">Remediation</div>
                  <div class="detail-text" style="background-color:rgba(0,255,136,0.05); border-left:3px solid var(--accent-green); padding:12px; border-radius:4px;">
                    \${escapeHtml(f.remediation)}
                  </div>
                </div>
                
                \${debate ? \`
                  <div class="detail-section">
                    <div class="detail-label">DynaDebate Analysis</div>
                    <div style="background-color:var(--bg-deep); padding:16px; border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
                      <div style="margin-bottom:16px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:600; font-size:13px;">Final Decision: <span class="\${debate.decision.includes('proven') ? 'text-green' : 'text-primary'}">\${debate.decision.toUpperCase().replace('_', ' ')}</span></span>
                        <span style="font-size:13px; color:var(--text-muted)">Final Confidence: \${Math.round(debate.finalConfidence * 100)}%</span>
                      </div>
                      \${debate.rounds.map((r, ri) => \`
                        <div class="debate-round">
                          <div class="debate-header">
                            <span>Round \${ri+1}</span>
                            <span class="debate-delta \${r.confidenceDelta > 0 ? 'positive' : 'negative'}">\${r.confidenceDelta > 0 ? '+' : ''}\${r.confidenceDelta}</span>
                          </div>
                          <div class="debate-role"><div class="role-badge attacker">Attacker</div><div class="role-text">\${escapeHtml(r.attacker)}</div></div>
                          <div class="debate-role"><div class="role-badge defender">Defender</div><div class="role-text">\${escapeHtml(r.defender)}</div></div>
                          <div class="debate-role"><div class="role-badge judge">Judge</div><div class="role-text" style="font-style:italic;">\${escapeHtml(r.judge)}</div></div>
                        </div>
                      \`).join('')}
                    </div>
                  </div>
                \` : ''}
              </div>
            </div>
          \`;
        }).join('')}
      </div>
    \`;
    
    els.routerView.innerHTML = html;
  } catch (err) {
    els.routerView.innerHTML = \`<div class="error-message">Failed to load audit: \${escapeHtml(err.message)}</div>\`;
  }
}

function confidenceBarHTML(score, band) {
  const pct = Math.round(score * 100);
  return \`
    <div class="confidence-bar-container">
      <div class="confidence-track">
        <div class="confidence-fill \${band}" style="width: \${pct}%"></div>
      </div>
      <span class="confidence-text">\${band.toUpperCase()}</span>
    </div>
  \`;
}

async function renderFindings() {
  els.pageTitle.textContent = 'Findings Explorer';
  els.pageSubtitle.textContent = 'Aggregate view of all discovered vulnerabilities';
  
  const res = await api('/api/audits');
  let allFindings = [];
  res.audits.forEach(a => {
    // We only have summaries here. Let's just show a message.
  });
  
  els.routerView.innerHTML = \`
    <div class="card">
      <h2 class="section-title">Aggregate Findings</h2>
      <p style="color:var(--text-secondary); margin-top:16px;">This view aggregates findings across all audits. Currently loading...</p>
      <div class="empty-state" style="margin-top:24px;">
        <div>\${icons.bug}</div>
        <h3>Findings Explorer</h3>
        <p>Please select an individual audit from the Dashboard to view its specific findings.</p>
        <a href="#audits" class="btn-primary" style="margin-top:16px;">View Audits</a>
      </div>
    </div>
  \`;
}

async function renderMonitoring() {
  els.pageTitle.textContent = 'Runtime Monitoring';
  els.pageSubtitle.textContent = 'Active incident detection and response';
  
  const res = await api('/api/incidents');
  const incidents = res.incidents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  els.routerView.innerHTML = \`
    <div class="card">
      <div class="card-header">
        <h2 class="section-title">Active Incidents</h2>
        <button class="btn-danger" onclick="simulateIncident()">\${icons.activity} Simulate Signal</button>
      </div>
      
      \${incidents.length === 0 ? \`
        <div class="empty-state">
          <div>\${icons.shield}</div>
          <h3>No active incidents</h3>
          <p>System monitoring is active. All protocols are healthy.</p>
        </div>
      \` : \`
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Protocol</th>
                <th>Title</th>
                <th>Status</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              \${incidents.map(i => \`
                <tr>
                  <td><span class="severity-pill \${i.severity}">\${i.severity}</span></td>
                  <td class="font-weight-600">\${escapeHtml(i.protocol)}</td>
                  <td class="primary-cell">\${escapeHtml(i.title)}</td>
                  <td><span class="status-badge \${i.status}">\${i.status}</span></td>
                  <td>\${formatDate(i.createdAt)}</td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        </div>
      \`}
    </div>
  \`;
}

window.simulateIncident = async () => {
  try {
    await api('/api/signals', {
      method: 'POST',
      body: JSON.stringify({
        protocol: 'SimulatedVault',
        chain: 'ethereum',
        source: 'treasury',
        metric: 'outflow_1h',
        value: 1500000,
        threshold: 500000
      })
    });
    showToast('Simulated signal sent', 'info');
  } catch (err) {
    showToast('Simulation failed: ' + err.message, 'error');
  }
};

async function renderReports() {
  els.pageTitle.textContent = 'Generated Reports';
  els.pageSubtitle.textContent = 'Downloadable professional audit reports';
  
  const res = await api('/api/audits');
  
  els.routerView.innerHTML = \`
    <div class="card">
      <div class="card-header">
        <h2 class="section-title">Available Reports</h2>
      </div>
      
      \${res.audits.length === 0 ? \`
        <div class="empty-state">
          <div>\${icons.download}</div>
          <h3>No reports generated</h3>
          <p>Run an audit to generate a professional markdown report.</p>
        </div>
      \` : \`
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Protocol</th>
                <th>Chain</th>
                <th>Date</th>
                <th>Format</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              \${res.audits.map(a => \`
                <tr>
                  <td class="primary-cell">\${escapeHtml(a.protocol)}</td>
                  <td><span class="chain-badge">\${a.chain}</span></td>
                  <td>\${formatDate(a.generatedAt)}</td>
                  <td><span class="status-badge info">Markdown</span></td>
                  <td>
                    <a href="/api/reports/\${a.id}.md" target="_blank" class="btn-secondary" style="padding:4px 8px;">
                      \${icons.download} Download
                    </a>
                  </td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        </div>
      \`}
    </div>
  \`;
}

async function renderAuditLog() {
  els.pageTitle.textContent = 'System Audit Log';
  els.pageSubtitle.textContent = 'Immutable trail of platform actions';
  
  if (state.role !== 'admin') {
    els.routerView.innerHTML = \`<div class="error-message"><h3>Access Denied</h3><p>Audit log is restricted to administrator role.</p></div>\`;
    return;
  }
  
  try {
    const res = await api('/api/audit-log');
    const log = res.auditLog.sort((a, b) => new Date(b.at) - new Date(a.at));
    
    els.routerView.innerHTML = \`
      <div class="card">
        <div class="card-header">
          <h2 class="section-title">Activity Trail</h2>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Subject</th>
                <th>Action</th>
                <th>Resource Path</th>
              </tr>
            </thead>
            <tbody>
              \${log.map(l => \`
                <tr>
                  <td style="font-family:var(--font-mono); font-size:12px;">\${new Date(l.at).toLocaleString()}</td>
                  <td class="primary-cell">\${escapeHtml(l.subject)}</td>
                  <td><span class="status-badge \${l.action === 'DELETE' ? 'open' : 'info'}">\${l.action}</span></td>
                  <td style="font-family:var(--font-mono); font-size:12px; color:var(--text-secondary)">\${escapeHtml(l.path)}</td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    \`;
  } catch (err) {
    els.routerView.innerHTML = \`<div class="error-message">Failed to load audit log: \${escapeHtml(err.message)}</div>\`;
  }
}

function renderSettings() {
  els.pageTitle.textContent = 'Settings';
  els.pageSubtitle.textContent = 'Configure session and API access';
  
  els.routerView.innerHTML = \`
    <div class="card" style="max-width: 600px;">
      <h2 class="section-title" style="margin-bottom: 24px;">Connection Settings</h2>
      <form onsubmit="saveSettings(event)">
        <div class="form-group">
          <label class="form-label">API Bearer Token</label>
          <input type="text" id="input-token" class="form-input" value="\${escapeHtml(state.token)}" required>
          <div style="font-size:12px; color:var(--text-muted); margin-top:8px;">
            Demo tokens: srp_demo_admin_token, srp_demo_auditor_token, srp_demo_viewer_token
          </div>
        </div>
        
        <div class="detail-section" style="margin-top:24px; padding:16px; background-color:var(--bg-surface); border-radius:var(--radius-sm); border:1px solid var(--border-subtle);">
          <div class="detail-label">Current Role</div>
          <div class="detail-text"><span class="status-badge info" style="font-size:14px; padding:6px 12px;">\${state.role.toUpperCase()}</span></div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:8px;">Role determines access to operations like running audits and deleting data.</div>
        </div>
        
        <div class="form-actions">
          <button type="submit" class="btn-primary">Save Settings</button>
        </div>
      </form>
    </div>
  \`;
}

window.saveSettings = (e) => {
  e.preventDefault();
  const token = document.getElementById('input-token').value;
  state.token = token;
  
  if (token.includes('admin')) state.role = 'admin';
  else if (token.includes('auditor')) state.role = 'auditor';
  else state.role = 'viewer';
  
  els.topbarRole.textContent = state.role.charAt(0).toUpperCase() + state.role.slice(1);
  const adminBadge = document.getElementById('nav-badge-admin');
  if (adminBadge) adminBadge.style.display = state.role === 'admin' ? 'block' : 'none';
  
  connectEvents();
  showToast('Settings saved. Reconnected.', 'success');
  route();
};

// Utilities
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' });
}

function formatNumber(num) {
  if (num === undefined || num === null) return '0';
  return num.toLocaleString();
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = \`toast \${type}\`;
  toast.innerHTML = \`
    <div style="flex:1;">\${escapeHtml(message)}</div>
  \`;
  els.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Mobile sidebar handling
els.hamburgerBtn.addEventListener('click', () => {
  els.sidebar.classList.add('open');
  els.overlay.classList.add('active');
});

els.overlay.addEventListener('click', () => {
  els.sidebar.classList.remove('open');
  els.overlay.classList.remove('active');
});

// Init
els.topbarRole.textContent = state.role.charAt(0).toUpperCase() + state.role.slice(1);
connectEvents();
route();
