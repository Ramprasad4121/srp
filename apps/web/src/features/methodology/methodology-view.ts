import { LitElement, html, css } from "lit";
import { gatewayClient } from "../../api/client.js";
import type { RuntimeSessionState, PhaseState } from "@srp/shared-types";
import "./excalidraw-wrapper.js";

export class MethodologyView extends LitElement {
  static override properties = {
    _state: { state: true },
    _activePhaseIndex: { state: true }
  };

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #fff;
      font-family: 'Inter', system-ui, sans-serif;
      color: #111827;
      overflow: hidden;
    }

    .layout {
      flex: 1;
      display: grid;
      grid-template-columns: 320px 1fr;
      overflow: hidden;
    }

    /* Sidebar / Phase List */
    .sidebar {
      border-right: 1px solid #e5e7eb;
      background: #f9fafb;
      overflow-y: auto;
      padding: 1.5rem;
    }

    .sidebar-title {
      font-size: 12px;
      font-weight: 700;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1.5rem;
    }

    .phase-item {
      padding: 0.75rem 1rem;
      border-radius: 8px;
      margin-bottom: 0.5rem;
      font-size: 13px;
      font-weight: 500;
      color: #4b5563;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      transition: all 0.15s;
      border: 1px solid transparent;
    }

    .phase-item:hover {
      background: #f3f4f6;
    }

    .phase-item.active {
      background: #fff;
      color: #111827;
      border-color: #e5e7eb;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }

    .phase-status {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .status-completed { background: #10b981; }
    .status-running { background: #0052FF; animation: pulse 2s infinite; }
    .status-pending { background: #d1d5db; }
    .status-failed { background: #ef4444; }

    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.4; }
      100% { opacity: 1; }
    }

    /* Content Area */
    .content {
      overflow-y: auto;
      padding: 2.5rem;
      background: #fff;
    }

    .header {
      margin-bottom: 2.5rem;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .phase-label {
      font-size: 12px;
      font-weight: 700;
      color: #0052FF;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 0.5rem;
    }

    .phase-title {
      font-size: 1.875rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #111827;
    }

    .status-badge {
      font-size: 11px;
      padding: 4px 10px;
      border-radius: 6px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .status-badge.completed { background: #dcfce7; color: #047857; }
    .status-badge.running { background: #dbeafe; color: #1d4ed8; }
    .status-badge.failed { background: #fee2e2; color: #b91c1c; }

    /* Reading Room Styles */
    .discovery-entry {
      margin-bottom: 3rem;
      border-bottom: 1px solid #f3f4f6;
      padding-bottom: 3rem;
    }

    .discovery-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.5rem;
    }

    .source-link {
      font-size: 12px;
      color: #0052FF;
      text-decoration: none;
      font-family: 'JetBrains Mono', monospace;
    }

    .source-link:hover { text-decoration: underline; }

    .discovery-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
    }

    .summary-box {
      background: #f9fafb;
      padding: 1.5rem;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
    }

    .raw-box {
      background: #111827;
      color: #9ca3af;
      padding: 1.5rem;
      border-radius: 12px;
      max-height: 400px;
      overflow-y: auto;
      font-size: 12px;
      line-height: 1.6;
      font-family: 'JetBrains Mono', monospace;
    }

    .data-label {
      font-size: 11px;
      font-weight: 700;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 1rem;
      display: block;
    }

    .pill {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      background: #000;
      color: #fff;
      padding: 2px 8px;
      border-radius: 4px;
      text-transform: uppercase;
    }

    .btn-start {
      background: #111827;
      color: #fff;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .btn-start:hover {
      background: #374151;
    }

    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      color: #6b7280;
    }
  `;

  declare _state: RuntimeSessionState | null;
  declare _activePhaseIndex: number;

  constructor() {
    super();
    this._state = null;
    this._activePhaseIndex = 0;
  }

  override async firstUpdated() {
    await this.refresh();
    setInterval(() => this.refresh(), 3000);
  }

  async refresh() {
    try {
      this._state = await gatewayClient.getRuntime();
    } catch (e) {
      console.error("Discovery refresh failed", e);
    }
  }

  private async startAudit() {
    try {
      await gatewayClient.startSession();
      await this.refresh();
    } catch (e) {
      alert("Failed to start discovery: " + e);
    }
  }

  override render() {
    if (!this._state) return html`<div class="empty-state">Initializing discovery engine...</div>`;

    const phases = this._state.phases || [];
    const activePhase = phases[this._activePhaseIndex];

    return html`
      <div class="layout">
        <aside class="sidebar">
          <div class="sidebar-title">Discovery Pipeline</div>
          ${phases.map((p, i) => html`
            <div class="phase-item ${this._activePhaseIndex === i ? 'active' : ''}" @click=${() => this._activePhaseIndex = i}>
              <div class="phase-status status-${p.status}"></div>
              ${p.phase.replace('discovery-', '').replace('synthesis-', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </div>
          `)}
          
          ${!this._state.isRunning && phases.every(p => p.status === 'pending' || p.status === 'completed' || p.status === 'failed') ? html`
            <button class="btn-start" style="margin-top: 2rem; width: 100%; justify-content: center;" @click=${this.startAudit}>
              🚀 Launch Discovery
            </button>
          ` : ''}
        </aside>

        <main class="content">
          ${activePhase ? html`
            <div class="header">
              <div>
                <div class="phase-label">INTELLIGENCE DOMAIN</div>
                <h1 class="phase-title">${activePhase.phase.toUpperCase().replace(/-/g, ' ')}</h1>
              </div>
              <div class="status-badge ${activePhase.status}">${activePhase.status}</div>
            </div>

            ${this.renderPhaseContent(activePhase)}
          ` : html`
            <div class="empty-state">
              <h2 style="font-size: 1.5rem; color: #111827; margin-bottom: 1rem;">SRP Intelligence Engine Ready</h2>
              <p>Select a discovery domain to view scraped documents and auditor summaries.</p>
            </div>
          `}
        </main>
      </div>
    `;
  }

  private renderPhaseContent(phase: PhaseState) {
    if (phase.status === 'pending') {
      return html`<div class="empty-state">Discovery for this domain has not started yet.</div>`;
    }

    if (phase.status === 'running') {
      return html`<div class="empty-state">
        <div class="status-running" style="width: 20px; height: 20px; margin: 0 auto 1rem auto; border-radius: 50%;"></div>
        SRP Agent is currently scraping and analyzing external sources...
      </div>`;
    }

    const data = this._state?.[this.mapPhaseToKey(phase.phase) as keyof RuntimeSessionState];

    if (!data) {
      return html`<div class="empty-state">No discovery data found for this phase.</div>`;
    }

    if (phase.phase.startsWith('discovery-')) return this.renderDiscovery(data as any);
    if (phase.phase === 'visual-flow-map') return this.renderDiagram(data as any);
    
    // Synthesis fallback
    return html`
      <div class="artifact-card">
        <div class="artifact-title">🧠 Synthesis Evidence</div>
        <div class="artifact-content" style="font-size: 15px; line-height: 1.8; white-space: pre-wrap;">
          ${(data as any).markdownSummary || (data as any).draftSummary || JSON.stringify(data, null, 2)}
        </div>
      </div>
    `;
  }

  private renderDiscovery(data: any) {
    const artifacts = data.artifacts || [];
    if (artifacts.length === 0) return html`<div class="empty-state">No sources were found for this domain.</div>`;

    return html`
      <div class="reading-room">
        ${artifacts.map((art: any) => html`
          <div class="discovery-entry">
            <div class="discovery-header">
              <div style="flex: 1;">
                <div class="pill">${art.domain.toUpperCase()}</div>
                <h3 style="margin: 0.5rem 0 0.25rem 0; font-size: 18px;">${art.title}</h3>
                <a href=${art.url} target="_blank" class="source-link">🔗 Source: ${art.url}</a>
              </div>
            </div>

            <div class="discovery-grid">
              <div class="summary-box">
                <span class="data-label">Auditor Digest</span>
                <div style="font-size: 14px; line-height: 1.7; color: #374151;">${art.summary}</div>
              </div>
              <div class="raw-box">
                <span class="data-label" style="color: #6b7280;">Full Original Content (Scraped)</span>
                <div>${art.rawContent}</div>
              </div>
            </div>
          </div>
        `)}
      </div>
    `;
  }

  private renderDiagram(data: any) {
    const elements = data.elements || [];
    const appState = data.appState || {};
    
    return html`
      <div class="artifact-card">
        <div class="artifact-title">🖼️ ${data.title || 'Interactive Protocol Map'}</div>
        <p style="font-size: 13px; color: #6b7280; margin-bottom: 1.5rem;">${data.summary}</p>
        
        <excalidraw-wrapper 
          .elements=${elements} 
          .appState=${appState}
        ></excalidraw-wrapper>
      </div>
    `;
  }

  private mapPhaseToKey(phase: string): string {
    const map: Record<string, string> = {
      "discovery-docs": "discoveryRegistry",
      "discovery-audits": "discoveryRegistry",
      "discovery-governance": "discoveryRegistry",
      "discovery-tokenomics": "discoveryRegistry",
      "discovery-onchain": "discoveryRegistry",
      "synthesis-intent": "intentSummary",
      "synthesis-actors": "architectureSummary",
      "visual-flow-map": "protocolDiagram"
    };
    return map[phase] || "";
  }
}

customElements.define("methodology-view", MethodologyView);
