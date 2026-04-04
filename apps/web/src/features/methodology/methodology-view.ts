import { LitElement, html, css } from "lit";
import { gatewayClient } from "../../api/client.js";
import type { RuntimeSessionState, PhaseState } from "@srp/shared-types";

export class MethodologyView extends LitElement {
  static override properties = {
    _state: { state: true }
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

    .artifact-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .artifact-title {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .artifact-content {
      font-size: 14px;
      line-height: 1.6;
      color: #374151;
      white-space: pre-wrap;
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
      console.error("Methodology refresh failed", e);
    }
  }

  private async startAudit() {
    try {
      await gatewayClient.startSession();
      await this.refresh();
    } catch (e) {
      alert("Failed to start audit: " + e);
    }
  }

  override render() {
    if (!this._state) return html`<div class="empty-state">Loading methodology engine...</div>`;

    const phases = this._state.phases || [];
    const activePhase = phases[this._activePhaseIndex];

    return html`
      <div class="layout">
        <aside class="sidebar">
          <div class="sidebar-title">Audit Pipeline</div>
          ${phases.map((p, i) => html`
            <div class="phase-item ${this._activePhaseIndex === i ? 'active' : ''}" @click=${() => this._activePhaseIndex = i}>
              <div class="phase-status status-${p.status}"></div>
              ${p.phase.replace('phase-', '').replace('-', ': ')}
            </div>
          `)}
          
          ${!this._state.isRunning && phases.every(p => p.status === 'pending') ? html`
            <button class="btn-start" style="margin-top: 2rem; width: 100%; justify-content: center;" @click=${this.startAudit}>
              🚀 Launch Audit
            </button>
          ` : ''}
        </aside>

        <main class="content">
          ${activePhase ? html`
            <div class="header">
              <div class="phase-label">CURRENT_PHASE_VIEW</div>
              <h1 class="phase-title">${activePhase.phase.toUpperCase().replace(/-/g, ' ')}</h1>
            </div>

            ${this.renderPhaseContent(activePhase)}
          ` : html`
            <div class="empty-state">
              <h2 style="font-size: 1.5rem; color: #111827; margin-bottom: 1rem;">Protocol Methodology Ready</h2>
              <p>Select a phase from the sidebar to view generated artifacts and security reasoning traces.</p>
            </div>
          `}
        </main>
      </div>
    `;
  }

  private renderPhaseContent(phase: PhaseState) {
    if (phase.status === 'pending') {
      return html`<div class="empty-state">This phase has not started yet. Data will appear here once the pipeline reaches this stage.</div>`;
    }

    if (phase.status === 'running') {
      return html`<div class="empty-state">
        <div class="status-running" style="width: 20px; height: 20px; margin: 0 auto 1rem auto; border-radius: 50%;"></div>
        SRP Agents are currently performing reasoning for this phase...
      </div>`;
    }

    // Mock rendering of artifacts based on phase
    return html`
      <div class="artifact-card">
        <div class="artifact-title">📋 Phase Artifact: Methodology Evidence</div>
        <div class="artifact-content">${JSON.stringify(this._state?.[this.mapPhaseToKey(phase.phase) as keyof RuntimeSessionState] || "Artifact data synchronized to run memory.", null, 2)}</div>
      </div>
    `;
  }

  private mapPhaseToKey(phase: string): string {
    const map: Record<string, string> = {
      "phase-0-preparation": "preAuditPrep",
      "phase-1-recon": "reconResult",
      "phase-2-architecture": "architectureSummary",
      "phase-3-invariants": "invariantRegistry",
      "phase-4-hypotheses": "hypothesisRegistry",
      "phase-5-code-reading": "functionAnnotations",
      "phase-6-notes": "questionLog",
      "phase-7-simulations": "economicAnalysis",
      "phase-8-interaction-matrix": "interactionMatrix",
      "phase-9-economic-modeling": "economicScenarios",
      "phase-10-cross-contract-paths": "crossContractAnalysis",
      "phase-11-reporting": "formalReport",
      "phase-12-remediation": "remediationPlan"
    };
    return map[phase] || "";
  }
}

customElements.define("methodology-view", MethodologyView);
