import { LitElement, html, css } from "lit";
import { gatewayClient } from "../../api/client.js";
import type {
  ArtifactMetadata,
  MethodologyPhase,
  PhaseState,
  RunEventLogEntry,
  RunManifest,
  RuntimeSessionState
} from "@srp/shared-types";
import { METHODOLOGY_PHASES, PHASE_LABELS, getPhaseDefinition } from "@srp/methodology";
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

    .artifact-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .artifact-title {
      font-size: 14px;
      font-weight: 700;
      color: #111827;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    /* Knowledge Bus & Agent Registry UI */
    .factory-status {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
      padding: 1rem;
      background: #f3f4f6;
      border-radius: 12px;
      overflow-x: auto;
    }

    .agent-pill {
      background: #fff;
      border: 1px solid #e5e7eb;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      min-width: 180px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }

    .agent-name {
      font-size: 11px;
      font-weight: 800;
      color: #111827;
      text-transform: uppercase;
    }

    .agent-task {
      font-size: 10px;
      color: #6b7280;
      margin-top: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .knowledge-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1rem;
      margin-top: 2rem;
    }

    .knowledge-node {
      background: #fff;
      border: 1px solid #e5e7eb;
      padding: 1rem;
      border-radius: 8px;
      font-size: 12px;
    }

    .node-kind {
      font-size: 10px;
      font-weight: 700;
      color: #0052FF;
      text-transform: uppercase;
      margin-bottom: 0.5rem;
    }

    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      color: #6b7280;
    }

    .room-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .room-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 1rem 1.25rem;
    }

    .room-card h3 {
      margin: 0 0 0.5rem 0;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #111827;
    }

    .room-stat {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: #111827;
    }

    .room-meta {
      margin-top: 0.35rem;
      font-size: 12px;
      color: #6b7280;
      line-height: 1.5;
    }

    .failure-banner {
      margin-bottom: 1rem;
      padding: 1rem 1.1rem;
      border-radius: 12px;
      border: 1px solid #fecaca;
      background: #fff1f2;
      color: #881337;
    }

    .failure-title {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 0.35rem;
    }

    .failure-detail {
      font-size: 13px;
      line-height: 1.6;
      color: #9f1239;
      white-space: pre-wrap;
    }

    .playbook-panel {
      margin-bottom: 2rem;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      background: #fcfcfd;
      padding: 1.25rem;
    }

    .playbook-title {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 0.75rem;
      color: #111827;
    }

    .playbook-description {
      font-size: 14px;
      line-height: 1.7;
      color: #374151;
      margin-bottom: 1rem;
    }

    .playbook-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
    }

    .playbook-block {
      background: #ffffff;
      border: 1px solid #eef2f7;
      border-radius: 12px;
      padding: 0.95rem;
    }

    .playbook-block h3 {
      margin: 0 0 0.55rem 0;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #4b5563;
    }

    .playbook-list {
      margin: 0;
      padding-left: 1rem;
      color: #111827;
      font-size: 13px;
      line-height: 1.6;
    }

    .playbook-rescue {
      font-size: 13px;
      line-height: 1.6;
      color: #7c2d12;
    }

    .surface-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .surface-panel {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      padding: 1.25rem;
      min-height: 220px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
    }

    .surface-panel.wide {
      grid-column: 1 / -1;
    }

    .surface-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .surface-title {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #111827;
    }

    .surface-count {
      font-size: 11px;
      font-weight: 700;
      color: #6b7280;
      text-transform: uppercase;
    }

    .surface-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .surface-item {
      border: 1px solid #eef2f7;
      border-radius: 12px;
      padding: 0.85rem 0.9rem;
      background: #f9fafb;
    }

    .surface-item-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 0.35rem;
    }

    .surface-item-title {
      font-size: 13px;
      font-weight: 700;
      color: #111827;
      line-height: 1.4;
    }

    .surface-item-meta {
      font-size: 11px;
      color: #6b7280;
      line-height: 1.5;
    }

    .phase-chip,
    .severity-chip,
    .finding-status-chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      padding: 0.18rem 0.55rem;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .phase-chip {
      background: #e5e7eb;
      color: #374151;
    }

    .severity-chip.critical,
    .finding-status-chip.false-positive {
      background: #fee2e2;
      color: #b91c1c;
    }

    .severity-chip.high {
      background: #ffedd5;
      color: #c2410c;
    }

    .severity-chip.medium,
    .finding-status-chip.mitigated {
      background: #fef3c7;
      color: #b45309;
    }

    .severity-chip.low,
    .severity-chip.informational,
    .finding-status-chip.draft {
      background: #dbeafe;
      color: #1d4ed8;
    }

    .finding-status-chip.confirmed {
      background: #dcfce7;
      color: #047857;
    }

    .timeline-list {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }

    .timeline-item {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 0.75rem;
      padding: 0.75rem 0;
      border-top: 1px solid #f3f4f6;
    }

    .timeline-item:first-child {
      border-top: none;
      padding-top: 0;
    }

    .timeline-time {
      font-size: 11px;
      color: #6b7280;
      font-family: 'JetBrains Mono', monospace;
    }

    .timeline-body {
      min-width: 0;
    }

    .timeline-title {
      font-size: 13px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 0.2rem;
    }

    .timeline-meta {
      font-size: 11px;
      color: #6b7280;
      line-height: 1.5;
    }

    @media (max-width: 1100px) {
      .surface-grid,
      .room-grid {
        grid-template-columns: 1fr;
      }

      .playbook-grid {
        grid-template-columns: 1fr;
      }

      .timeline-item {
        grid-template-columns: 1fr;
      }
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
      const runtime = await gatewayClient.getRuntime();
      if (runtime.auditRoom || runtime.isRunning || runtime.runId) {
        this._state = runtime;
        return;
      }

      const runs = await gatewayClient.getRuns();
      const latestRun = [...runs].sort((left, right) => {
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      })[0];

      if (!latestRun) {
        this._state = runtime;
        return;
      }

      this._state = await this.buildPersistedRunState(runtime, latestRun.runId);
    } catch (e) {
      console.error("Discovery refresh failed", e);
    }
  }

  private async buildPersistedRunState(runtime: RuntimeSessionState, runId: string): Promise<RuntimeSessionState> {
    const [run, projection, events] = await Promise.all([
      gatewayClient.getRun(runId),
      gatewayClient.getRunProjection(runId),
      gatewayClient.getRunEvents(runId)
    ]);

    const payloadEntries = await Promise.all(
      run.artifacts.map(async (artifact) => {
        return [artifact.artifactId, await gatewayClient.getRunArtifact(runId, artifact.artifactId)] as const;
      })
    );

    const payloads = new Map(payloadEntries);

    const persistedState = Object.assign(
      {
        ...runtime,
        runId: run.runId,
        sessionId: run.sessionId,
        currentPhase: run.currentPhase ?? runtime.currentPhase,
        phases: this.rebuildPhaseStates(events),
        auditRoom: projection
      },
      this.withStateField("discoveryRegistry", this.readLatestArtifact<RuntimeSessionState["discoveryRegistry"]>(run, payloads, "discovery-docs", "note")),
      this.withStateField("intentSummary", this.readLatestArtifact<RuntimeSessionState["intentSummary"]>(run, payloads, "synthesis-intent", "note")),
      this.withStateField("architectureSummary", this.readLatestArtifact<RuntimeSessionState["architectureSummary"]>(run, payloads, "synthesis-actors", "note")),
      this.withStateField("functionMap", this.readLatestArtifact<RuntimeSessionState["functionMap"]>(run, payloads, "synthesis-functions", "note")),
      this.withStateField("entryExitMatrix", this.readLatestArtifact<RuntimeSessionState["entryExitMatrix"]>(run, payloads, "synthesis-entry-exit", "note")),
      this.withStateField("invariantRegistry", this.readLatestArtifact<RuntimeSessionState["invariantRegistry"]>(run, payloads, "synthesis-invariants", "invariant")),
      this.withStateField("protocolDiagram", this.readLatestArtifact<RuntimeSessionState["protocolDiagram"]>(run, payloads, "visual-flow-map", "diagram")),
      this.withStateField("hypothesisRegistry", this.readLatestArtifact<RuntimeSessionState["hypothesisRegistry"]>(run, payloads, "audit-hunt", "hypothesis")),
      this.withStateField("findingRegistry", this.readLatestArtifact<RuntimeSessionState["findingRegistry"]>(run, payloads, "audit-verify", "finding")),
      this.withStateField("formalReport", this.readLatestArtifact<RuntimeSessionState["formalReport"]>(run, payloads, "audit-report", "report"))
    );

    return persistedState as RuntimeSessionState;
  }

  private rebuildPhaseStates(events: readonly RunEventLogEntry[]): readonly PhaseState[] {
    const phaseMap = new Map<MethodologyPhase, PhaseState>();

    for (const phase of METHODOLOGY_PHASES) {
      phaseMap.set(phase, { phase, status: "pending" });
    }

    for (const event of events) {
      if (event.type !== "phase.status.changed" || !event.phase || !event.status) {
        continue;
      }

      const current = phaseMap.get(event.phase) ?? { phase: event.phase, status: "pending" as const };
      phaseMap.set(
        event.phase,
        Object.assign(
          {},
          current,
          { status: event.status },
          event.status === "running" ? { startedAt: event.emittedAt } : {},
          event.status === "completed" || event.status === "failed" ? { completedAt: event.emittedAt } : {}
        ) as PhaseState
      );
    }

    return METHODOLOGY_PHASES.map((phase) => phaseMap.get(phase) ?? { phase, status: "pending" });
  }

  private readLatestArtifact<T>(
    run: RunManifest,
    payloads: ReadonlyMap<string, unknown>,
    phase: MethodologyPhase,
    kind: ArtifactMetadata["kind"]
  ): T | undefined {
    const artifact = [...run.artifacts]
      .filter((candidate) => candidate.phase === phase && candidate.kind === kind)
      .sort((left, right) => {
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      })[0];

    return artifact ? (payloads.get(artifact.artifactId) as T | undefined) : undefined;
  }

  private withStateField<K extends keyof RuntimeSessionState>(
    key: K,
    value: RuntimeSessionState[K] | undefined
  ): Partial<RuntimeSessionState> {
    return value === undefined ? {} : { [key]: value } as Partial<RuntimeSessionState>;
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
          ${this.renderFactoryStatus()}
          ${this.renderAuditRoomOverview()}

          ${activePhase ? html`
            <div class="header">
              <div>
                <div class="phase-label">INTELLIGENCE DOMAIN</div>
                <h1 class="phase-title">${PHASE_LABELS[activePhase.phase] ?? activePhase.phase.toUpperCase().replace(/-/g, ' ')}</h1>
              </div>
              <div class="status-badge ${activePhase.status}">${activePhase.status}</div>
            </div>

            ${this.renderPlaybookDetails(activePhase.phase)}
            ${this.renderPhaseContent(activePhase)}
          ` : html`
            <div class="empty-state">
              <h2 style="font-size: 1.5rem; color: #111827; margin-bottom: 1rem;">SRP Intelligence Engine Ready</h2>
              <p>Select a discovery domain to view scraped documents and auditor summaries.</p>
            </div>
          `}

          ${this.renderKnowledgeBus()}
        </main>
      </div>
    `;
  }

  private renderFactoryStatus() {
    const agents = this._state?.agentRegistry?.activeInstances || [];
    if (agents.length === 0) return '';

    return html`
      <div class="factory-status">
        ${agents.map(a => html`
          <div class="agent-pill">
            <div style="display:flex; align-items:center; gap: 6px;">
              <div class="phase-status status-${a.status === 'busy' ? 'running' : (a.status === 'failed' ? 'failed' : 'completed')}"></div>
              <span class="agent-name">${a.definitionId.replace('-',' ').toUpperCase()}</span>
            </div>
            <div class="agent-task">${a.activeTask || a.status.toUpperCase()}</div>
          </div>
        `)}
      </div>
    `;
  }

  private renderAuditRoomOverview() {
    const room = this._state?.auditRoom;
    if (!room) return "";

    const highSignalFindings = room.findings.filter((finding) => finding.severity === "Critical" || finding.severity === "High").length;

    return html`
      ${room.missionControl.lastFailure ? html`
        <div class="failure-banner">
          <div class="failure-title">Run Failed</div>
          <div class="failure-detail">${room.missionControl.lastFailure}</div>
        </div>
      ` : ""}
      <div class="room-grid">
        <div class="room-card">
          <h3>Mission Control</h3>
          <div class="room-stat">${room.missionControl.completedPhases}/${room.missionControl.totalPhases}</div>
          <div class="room-meta">
            Run status: ${room.missionControl.runStatus}<br />
            Current phase: ${room.missionControl.currentPhase ?? "idle"}
          </div>
        </div>
        <div class="room-card">
          <h3>Notes</h3>
          <div class="room-stat">${room.notes.length}</div>
          <div class="room-meta">Projected from the event log and artifact graph.</div>
        </div>
        <div class="room-card">
          <h3>Diagram Board</h3>
          <div class="room-stat">${room.diagrams.length}</div>
          <div class="room-meta">Live scene artifacts linked to audit phases.</div>
        </div>
        <div class="room-card">
          <h3>Findings Registry</h3>
          <div class="room-stat">${room.findings.length}</div>
          <div class="room-meta">${highSignalFindings} high-signal findings with structured lifecycle tracking.</div>
        </div>
        <div class="room-card">
          <h3>Evidence / PoC</h3>
          <div class="room-stat">${room.evidence.length}</div>
          <div class="room-meta">Verification artifacts and proof ledger entries.</div>
        </div>
        <div class="room-card">
          <h3>Timeline</h3>
          <div class="room-stat">${room.timeline.length}</div>
          <div class="room-meta">Recent runtime events reconstructed from append-only log.</div>
        </div>
      </div>
      ${this.renderAuditRoomSurfaces(room)}
    `;
  }

  private renderAuditRoomSurfaces(room: NonNullable<RuntimeSessionState["auditRoom"]>) {
    return html`
      <div class="surface-grid">
        <section class="surface-panel">
          <div class="surface-header">
            <div class="surface-title">Notes</div>
            <div class="surface-count">${room.notes.length} artifacts</div>
          </div>
          ${this.renderArtifactSurfaceList(room.notes, "No note artifacts projected yet.")}
        </section>

        <section class="surface-panel">
          <div class="surface-header">
            <div class="surface-title">Diagram Board</div>
            <div class="surface-count">${room.diagrams.length} diagrams</div>
          </div>
          ${this.renderArtifactSurfaceList(room.diagrams, "No diagram scenes have been projected yet.")}
        </section>

        <section class="surface-panel">
          <div class="surface-header">
            <div class="surface-title">Findings Registry</div>
            <div class="surface-count">${room.findings.length} tracked</div>
          </div>
          ${this.renderFindingsSurface(room)}
        </section>

        <section class="surface-panel">
          <div class="surface-header">
            <div class="surface-title">Evidence / PoC</div>
            <div class="surface-count">${room.evidence.length} entries</div>
          </div>
          ${this.renderArtifactSurfaceList(room.evidence, "No verification evidence has been recorded yet.")}
        </section>

        <section class="surface-panel wide">
          <div class="surface-header">
            <div class="surface-title">Timeline</div>
            <div class="surface-count">${room.timeline.length} recent events</div>
          </div>
          ${this.renderTimelineSurface(room)}
        </section>
      </div>
    `;
  }

  private renderArtifactSurfaceList(
    artifacts: NonNullable<RuntimeSessionState["auditRoom"]>["notes"],
    emptyLabel: string
  ) {
    if (!artifacts.length) {
      return html`<div class="empty-state" style="padding: 2rem 1rem;">${emptyLabel}</div>`;
    }

    return html`
      <div class="surface-list">
        ${artifacts.slice(0, 5).map((artifact) => html`
          <article class="surface-item">
            <div class="surface-item-header">
              <div class="surface-item-title">${artifact.title}</div>
              <span class="phase-chip">${this.formatPhaseLabel(artifact.phase)}</span>
            </div>
            <div class="surface-item-meta">
              Kind: ${artifact.kind}<br />
              Created: ${this.formatTimestamp(artifact.createdAt)}
            </div>
          </article>
        `)}
      </div>
    `;
  }

  private renderFindingsSurface(room: NonNullable<RuntimeSessionState["auditRoom"]>) {
    if (!room.findings.length) {
      return html`<div class="empty-state" style="padding: 2rem 1rem;">No findings have entered the registry yet.</div>`;
    }

    return html`
      <div class="surface-list">
        ${room.findings.slice(0, 6).map((finding) => html`
          <article class="surface-item">
            <div class="surface-item-header">
              <div class="surface-item-title">${finding.title}</div>
              <span class="severity-chip ${finding.severity.toLowerCase()}">${finding.severity}</span>
            </div>
            <div class="surface-item-meta">
              <span class="finding-status-chip ${this.toClassToken(finding.status)}">${finding.status}</span>
              ${finding.phase ? html`<span class="phase-chip" style="margin-left: 0.45rem;">${this.formatPhaseLabel(finding.phase)}</span>` : ""}
              <div style="margin-top: 0.45rem;">
                Evidence links: ${finding.evidenceCount}
              </div>
            </div>
          </article>
        `)}
      </div>
    `;
  }

  private renderTimelineSurface(room: NonNullable<RuntimeSessionState["auditRoom"]>) {
    if (!room.timeline.length) {
      return html`<div class="empty-state" style="padding: 2rem 1rem;">No runtime events have been projected yet.</div>`;
    }

    return html`
      <div class="timeline-list">
        ${room.timeline.slice(0, 8).map((entry) => html`
          <article class="timeline-item">
            <div class="timeline-time">${this.formatTimestamp(entry.at)}</div>
            <div class="timeline-body">
              <div class="timeline-title">${entry.title}</div>
              <div class="timeline-meta">
                Type: ${entry.type}
                ${entry.phase ? html`<br />Phase: ${this.formatPhaseLabel(entry.phase)}` : ""}
                ${entry.status ? html`<br />Status: ${entry.status}` : ""}
                ${entry.detail ? html`<br />${entry.detail}` : ""}
              </div>
            </div>
          </article>
        `)}
      </div>
    `;
  }

  private formatPhaseLabel(phase: string) {
    return phase.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private toClassToken(value: string) {
    return value.toLowerCase().replace(/\s+/g, "-");
  }

  private formatTimestamp(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString();
  }

  private renderKnowledgeBus() {
    const nodes = this._state?.knowledgeBus?.nodes || [];
    if (nodes.length === 0) return '';

    return html`
      <div style="margin-top: 4rem; border-top: 1px solid #eee; padding-top: 2rem;">
        <div class="sidebar-title">Hive Mind Knowledge Bus</div>
        <div class="knowledge-grid">
          ${nodes.map(n => html`
            <div class="knowledge-node">
              <div class="node-kind">${n.kind}</div>
              <div style="font-weight: 700; margin-bottom: 4px;">${n.title}</div>
              <div style="color: #6b7280; font-size: 11px;">Discovered by ${n.sourceAgentId.split('_')[0]}</div>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  private renderPlaybookDetails(phase: MethodologyPhase) {
    const definition = getPhaseDefinition(phase);
    return html`
      <section class="playbook-panel">
        <div class="playbook-title">Playbook Contract</div>
        <div class="playbook-description">${definition.description}</div>
        <div class="playbook-grid">
          <div class="playbook-block">
            <h3>Required Inputs</h3>
            <ul class="playbook-list">
              ${definition.requiredInputs.map((item) => html`<li>${item}</li>`)}
            </ul>
          </div>
          <div class="playbook-block">
            <h3>Exit Criteria</h3>
            <ul class="playbook-list">
              ${definition.exitCriteria.map((item) => html`<li>${item}</li>`)}
            </ul>
          </div>
          <div class="playbook-block">
            <h3>Rescue Path</h3>
            <div class="playbook-rescue">${definition.rescueStrategy}</div>
          </div>
        </div>
      </section>
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
    if (phase.phase === 'synthesis-intent') return this.renderSynthesis(data as any, "Protocol Intent Synthesis");
    if (phase.phase === 'synthesis-actors') return this.renderSynthesis(data as any, "Actor Model Synthesis");
    if (phase.phase === 'synthesis-functions') return this.renderFunctions(data as any);
    if (phase.phase === 'synthesis-entry-exit') return this.renderEntryExit(data as any);
    if (phase.phase === 'synthesis-invariants') return this.renderInvariants(data as any);
    if (phase.phase === 'visual-flow-map') return this.renderDiagram(data as any);
    if (phase.phase === 'audit-hunt') return this.renderInvariants(data as any); // Use invariant style for hypotheses
    if (phase.phase === 'audit-verify') return this.renderVerifiedFindings(data as any);
    if (phase.phase === 'audit-report') return this.renderFormalReport(data as any);
    
    // Synthesis fallback
    return html`
      <div class="artifact-card">
        <div class="artifact-title">🧠 Synthesis Evidence</div>
        <div class="artifact-content" style="font-size: 15px; line-height: 1.8; white-space: pre-wrap;">
          ${(data as any).markdownSummary || (data as any).draftSummary || (data as any).summary || JSON.stringify(data, null, 2)}
        </div>
      </div>
    `;
  }

  private renderDiscovery(data: any) {
    const artifacts = data.artifacts || [];
    if (artifacts.length === 0) return html`
      <div class="empty-state">
        <div class="status-running" style="width: 20px; height: 20px; margin: 0 auto 1rem auto; border-radius: 50%;"></div>
        Generating Intelligence Report via Senior LLM...
      </div>`;

    return html`
      <div class="reading-room">
        ${artifacts.map((art: any) => {
          const links = art.metadata?.links || {};
          return html`
          <div class="discovery-entry">
            <div class="discovery-header">
              <div style="flex: 1;">
                <div class="pill">${art.domain.toUpperCase()} REPORT</div>
                <h3 style="margin: 0.5rem 0 0.25rem 0; font-size: 24px; font-weight: 800; letter-spacing: -0.02em;">${art.title}</h3>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase;">Source</div>
                <div style="font-size: 14px; font-weight: 800; color: #0052FF;">SENIOR_LLM_KNOWLEDGE</div>
              </div>
            </div>

            <!-- Official Links Bar -->
            <div style="display: flex; gap: 1rem; margin-bottom: 2rem; padding: 1rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; overflow-x: auto;">
              ${links.whitepaper && links.whitepaper !== "..." ? html`<a href=${links.whitepaper} target="_blank" style="white-space:nowrap; font-size:12px; font-weight:600; color:#111827; text-decoration:none; padding:4px 12px; background:#fff; border:1px solid #d1d5db; border-radius:6px;">📄 Whitepaper</a>` : ''}
              ${links.documentation && links.documentation !== "..." ? html`<a href=${links.documentation} target="_blank" style="white-space:nowrap; font-size:12px; font-weight:600; color:#111827; text-decoration:none; padding:4px 12px; background:#fff; border:1px solid #d1d5db; border-radius:6px;">📚 Documentation</a>` : ''}
              ${links.etherscan && links.etherscan !== "..." ? html`<a href=${links.etherscan} target="_blank" style="white-space:nowrap; font-size:12px; font-weight:600; color:#111827; text-decoration:none; padding:4px 12px; background:#fff; border:1px solid #d1d5db; border-radius:6px;">🔍 Etherscan</a>` : ''}
              ${links.webapp && links.webapp !== "..." ? html`<a href=${links.webapp} target="_blank" style="white-space:nowrap; font-size:12px; font-weight:600; color:#111827; text-decoration:none; padding:4px 12px; background:#fff; border:1px solid #d1d5db; border-radius:6px;">🌐 Web App</a>` : ''}
            </div>

            <div style="padding: 2.5rem; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
              <div style="font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; margin-bottom: 1.5rem; letter-spacing: 0.05em; border-bottom: 1px solid #f3f4f6; padding-bottom: 0.5rem;">
                Senior Analyst Synthesis
              </div>
              <div style="font-size: 16px; line-height: 1.8; color: #1f2937; white-space: pre-wrap; font-family: 'Inter', system-ui, sans-serif;">
                ${typeof art.rawContent === 'string' ? art.rawContent : JSON.stringify(art.rawContent, null, 2)}
              </div>
              <div style="margin-top: 2.5rem; padding-top: 1.5rem; border-top: 1px solid #f3f4f6; font-size: 11px; color: #9ca3af; display: flex; justify-content: space-between;">
                <span>ANALYSIS_TIMESTAMP: ${new Date(art.analyzedAt).toLocaleString()}</span>
                <span>CONFIDENCE_LEVEL: HIGH</span>
              </div>
            </div>
          </div>
        `})}
      </div>
    `;
  }

  private renderSynthesis(data: any, title: string) {
    let content = "";
    if (typeof data === 'string') {
      content = data;
    } else if (data && typeof data === 'object') {
      content = data.markdownSummary || data.draftSummary || data.report || data.summary || JSON.stringify(data, null, 2);
    }

    return html`
      <div class="artifact-card">
        <div class="artifact-title">🧠 ${title}</div>
        <div class="artifact-content" style="font-size: 16px; line-height: 1.8; white-space: pre-wrap; color: #1f2937;">
          ${content}
        </div>
      </div>
    `;
  }

  private renderFunctions(data: any) {
    const functions = data.functions || [];
    return html`
      <div class="artifact-card">
        <div class="artifact-title">⚙️ Main Contracts & Functions</div>
        <p style="font-size: 13px; color: #6b7280; margin-bottom: 1rem;">${data.summary}</p>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="border-bottom: 2px solid #eee; text-align: left;">
                <th style="padding: 0.75rem;">Function</th>
                <th style="padding: 0.75rem;">Contract</th>
                <th style="padding: 0.75rem;">Visibility</th>
                <th style="padding: 0.75rem;">State</th>
                <th style="padding: 0.75rem;">Description</th>
              </tr>
            </thead>
            <tbody>
              ${functions.map((f: any) => html`
                <tr style="border-bottom: 1px solid #f9f9f9;">
                  <td style="padding: 0.75rem; font-family: monospace; font-weight: 700;">${f.functionName}</td>
                  <td style="padding: 0.75rem;">${f.contract}</td>
                  <td style="padding: 0.75rem;"><span class="pill">${f.visibility}</span></td>
                  <td style="padding: 0.75rem;">${f.isStateModifying ? html`<span class="pill" style="background:#fff7ed; color:#c2410c;">Modify</span>` : html`<span class="pill">View</span>`}</td>
                  <td style="padding: 0.75rem; color: #6b7280;">${f.description}</td>
                </tr>
              `)}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  private renderEntryExit(data: any) {
    const points = data.points || [];
    return html`
      <div class="artifact-card">
        <div class="artifact-title">🚪 Entry & Exit Points</div>
        <p style="font-size: 13px; color: #6b7280; margin-bottom: 1rem;">${data.summary}</p>
        <div class="grid-2">
          ${points.map((p: any) => html`
            <div class="data-value" style="border-left: 4px solid ${p.type === 'entry' ? '#0052ff' : '#ef4444'}; margin-bottom: 1rem;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <strong>${p.functionName}</strong>
                <span class="pill" style="text-transform: uppercase;">${p.type}</span>
              </div>
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 0.5rem;">Contract: ${p.contract} | Access: ${p.accessControl}</div>
              <div style="font-size: 13px;">${p.description}</div>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  private renderInvariants(data: any) {
    const invariants = data.invariants || [];
    return html`
      <div class="artifact-card">
        <div class="artifact-title">🛡️ Protocol Invariants</div>
        <p style="font-size: 13px; color: #6b7280; margin-bottom: 1rem;">${data.summary}</p>
        ${invariants.map((inv: any) => html`
          <div class="data-value" style="margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <strong>${inv.id}: ${inv.title}</strong>
              <div>
                <span class="pill">${inv.category}</span>
                <span class="pill ${inv.priority?.toLowerCase()}">${inv.priority}</span>
              </div>
            </div>
            <div style="font-size: 13px; margin-bottom: 0.5rem;">${inv.description}</div>
            ${inv.suggestedVerification ? html`<div style="font-size: 11px; color: #6b7280;"><strong>Verification:</strong> ${inv.suggestedVerification}</div>` : ''}
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

  private renderVerifiedFindings(data: any) {
    const findings = data.findings || [];
    return html`
      <div class="artifact-card">
        <div class="artifact-title">🚩 Verified Vulnerabilities</div>
        <p style="font-size: 13px; color: #6b7280; margin-bottom: 1.5rem;">${data.summary}</p>
        ${findings.map((f: any) => html`
          <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; background: ${f.severity === 'Critical' || f.severity === 'High' ? '#fff1f2' : '#fefce8'};">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
              <h4 style="margin: 0; font-size: 18px; font-weight: 800;">${f.title}</h4>
              <span class="pill" style="background: ${f.severity === 'Critical' ? '#be123c' : (f.severity === 'High' ? '#e11d48' : '#eab308')}; color: #fff;">${f.severity}</span>
            </div>
            <div style="font-size: 14px; line-height: 1.6; color: #374151; white-space: pre-wrap;">${f.description}</div>
            <div style="margin-top: 1rem; font-size: 12px; font-weight: 600; color: #6b7280;">IMPACT: ${f.impact || "Not specified"}</div>
            <div style="margin-top: 4px; font-size: 12px; font-weight: 600; color: #6b7280;">REMEDIATION: ${f.remediation || "Not specified"}</div>
          </div>
        `)}
      </div>
    `;
  }

  private renderFormalReport(data: any) {
    return html`
      <div class="artifact-card" style="background: #111827; color: #e5e7eb; border: none; padding: 3rem;">
        <div style="color: #60a5fa; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 1rem;">SECURITY PROTOCOL DELIVERABLE</div>
        <h1 style="color: #fff; font-size: 2.5rem; font-weight: 800; margin-bottom: 2rem; letter-spacing: -0.02em;">${data.title || 'Security Audit Report'}</h1>
        <div class="markdown-body" style="font-size: 16px; line-height: 1.8; color: #d1d5db; white-space: pre-wrap; font-family: 'Inter', system-ui, sans-serif;">
          ${data.markdownContent}
        </div>
        <div style="margin-top: 4rem; padding-top: 2rem; border-top: 1px solid #374151; display: flex; justify-content: space-between; font-size: 12px;">
          <span>GENERATED: ${new Date(data.generatedAt).toLocaleString()}</span>
          <span>IDENTIFIED BY: SRP INTELLIGENCE ENGINE</span>
        </div>
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
      "synthesis-functions": "functionMap",
      "synthesis-entry-exit": "entryExitMatrix",
      "synthesis-invariants": "invariantRegistry",
      "visual-flow-map": "protocolDiagram",
      "audit-resolve-input": "discoveryRegistry",
      "audit-setup": "discoveryRegistry",
      "audit-map": "discoveryRegistry",
      "audit-hunt": "hypothesisRegistry",
      "audit-attack": "discoveryRegistry",
      "audit-verify": "findingRegistry",
      "audit-report": "formalReport"
    };
    return map[phase] || "";
  }
}

customElements.define("methodology-view", MethodologyView);
