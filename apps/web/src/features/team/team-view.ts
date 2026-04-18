import { LitElement, html, css } from "lit";
import type {
  AuditRoomProjection,
  BuildRoomProjection,
  RuntimeSessionState,
  TeamMember,
  TeamRoom
} from "@srp/shared-types";
import { gatewayClient } from "../../api/client.js";

interface TeamQueueItem {
  readonly title: string;
  readonly detail: string;
  readonly owner: string;
  readonly status: "active" | "queued" | "blocked";
}

interface TeamReviewItem {
  readonly title: string;
  readonly detail: string;
  readonly status: "ready" | "waiting";
}

type TeamRoomState = TeamRoom & {
  readonly assignments: readonly TeamQueueItem[];
  readonly approvals: readonly TeamReviewItem[];
};

function relativeTime(timestamp: string): string {
  const deltaMinutes = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000));
  if (deltaMinutes < 1) return "now";
  if (deltaMinutes < 60) return `${deltaMinutes}m ago`;
  const deltaHours = Math.floor(deltaMinutes / 60);
  return `${deltaHours}h ago`;
}

function deriveMembers(runtime: RuntimeSessionState, buildRoom: BuildRoomProjection | null): readonly TeamMember[] {
  const active = runtime.agentRegistry?.activeInstances ?? [];
  const seen = new Set<string>();
  const members: TeamMember[] = active.map((instance) => {
    seen.add(instance.instanceId);
    return {
      id: instance.instanceId,
      name: instance.activeTask ? `${instance.definitionId} / ${instance.activeTask}` : instance.definitionId,
      role: instance.definitionId.toLowerCase().includes("developer") ? "developer" : "auditor",
      status:
        instance.status === "busy"
          ? "active"
          : instance.status === "idle"
            ? "idle"
            : "offline",
      lastActiveAt: new Date().toISOString()
    };
  });

  if (!seen.has("srp-lead")) {
    members.unshift({
      id: "srp-lead",
      name: "SRP Lead",
      role: buildRoom?.missionControl.currentStage ? "developer" : "auditor",
      status: runtime.isRunning ? "active" : "idle",
      lastActiveAt: new Date().toISOString()
    });
  }

  if (!members.some((member) => member.role === "developer") && buildRoom) {
    members.push({
      id: "build-lane",
      name: "Build Lane",
      role: "developer",
      status: buildRoom.missionControl.runStatus === "running" ? "active" : "idle",
      lastActiveAt: new Date().toISOString()
    });
  }

  return members;
}

function deriveAssignments(
  runtime: RuntimeSessionState,
  auditRoom: AuditRoomProjection | null,
  buildRoom: BuildRoomProjection | null
): readonly TeamQueueItem[] {
  const items: TeamQueueItem[] = [];

  if (runtime.currentPhase) {
    items.push({
      title: `Audit phase: ${runtime.currentPhase}`,
      detail: `${auditRoom?.missionControl.completedPhases ?? 0}/${auditRoom?.missionControl.totalPhases ?? 18} phases closed`,
      owner: "SRP Lead",
      status: runtime.isRunning ? "active" : "queued"
    });
  }

  if (buildRoom?.missionControl.currentStage) {
    items.push({
      title: `Build stage: ${buildRoom.missionControl.currentStage}`,
      detail: `${buildRoom.missionControl.completedStages}/${buildRoom.missionControl.totalStages} stages holding artifacts`,
      owner: "Build Lane",
      status: buildRoom.missionControl.runStatus === "failed" ? "blocked" : "active"
    });
  }

  if (runtime.knowledgeBus?.nodes.length) {
    items.push({
      title: "Knowledge sync",
      detail: `${runtime.knowledgeBus.nodes.length} graph nodes ready for handoff`,
      owner: "Research Bus",
      status: "queued"
    });
  }

  if (auditRoom?.findings.length) {
    items.push({
      title: "Finding review queue",
      detail: `${auditRoom.findings.length} findings in registry`,
      owner: "Verifier Lane",
      status: auditRoom.findings.some((finding) => finding.status === "Draft") ? "active" : "queued"
    });
  }

  return items;
}

function deriveApprovals(
  runtime: RuntimeSessionState,
  auditRoom: AuditRoomProjection | null,
  buildRoom: BuildRoomProjection | null
): readonly TeamReviewItem[] {
  const approvals: TeamReviewItem[] = [];

  if (auditRoom?.missionControl.lastFailure) {
    approvals.push({
      title: "Run failure needs rescue",
      detail: auditRoom.missionControl.lastFailure,
      status: "ready"
    });
  }

  if (buildRoom) {
    for (const gate of buildRoom.deliveryGates) {
      if (gate.status === "ready") {
        approvals.push({
          title: `${gate.title} gate`,
          detail: gate.summary,
          status: "ready"
        });
      }
    }
  }

  if (!approvals.length) {
    approvals.push({
      title: "Approval lane clear",
      detail: runtime.isRunning ? "Next gate opens when new artifact lands." : "Start or resume run to populate lane.",
      status: "waiting"
    });
  }

  return approvals;
}

function deriveActivity(
  runtime: RuntimeSessionState,
  auditRoom: AuditRoomProjection | null,
  buildRoom: BuildRoomProjection | null
): readonly string[] {
  const items: string[] = [];

  for (const entry of auditRoom?.timeline.slice(0, 5) ?? []) {
    items.push(`${relativeTime(entry.at)} :: ${entry.title}${entry.detail ? ` :: ${entry.detail}` : ""}`);
  }

  if (buildRoom) {
    for (const stage of buildRoom.stages.slice(0, 3)) {
      items.push(`build :: ${stage.name} :: ${stage.artifactCount} artifact(s) :: ${stage.status}`);
    }
  }

  for (const node of runtime.knowledgeBus?.nodes.slice(-3) ?? []) {
    items.push(`knowledge :: ${node.kind} :: ${node.title}`);
  }

  return items.slice(0, 10);
}

function deriveRoom(
  runtime: RuntimeSessionState,
  auditRoom: AuditRoomProjection | null,
  buildRoom: BuildRoomProjection | null
): TeamRoomState {
  const members = deriveMembers(runtime, buildRoom);
  return {
    id: runtime.sessionId ?? "team-room",
    name: "SRP Virtual Room",
    members,
    activeAuditors: members.filter((member) => member.role === "auditor" && member.status === "active").length,
    activeDevelopers: members.filter((member) => member.role === "developer" && member.status === "active").length,
    sharedActivity: deriveActivity(runtime, auditRoom, buildRoom),
    assignments: deriveAssignments(runtime, auditRoom, buildRoom),
    approvals: deriveApprovals(runtime, auditRoom, buildRoom)
  };
}

export class TeamView extends LitElement {
  static override properties = {
    _room: { state: true },
    _loading: { state: true },
    _error: { state: true }
  };

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background:
        radial-gradient(circle at top left, rgba(0, 82, 255, 0.08), transparent 24%),
        linear-gradient(180deg, #fcfcfd 0%, #ffffff 48%, #f8fafc 100%);
      font-family: "Assistant", "Inter", system-ui, sans-serif;
      color: #111827;
      overflow: hidden;
    }

    .stats-bar {
      padding: 1rem 1.5rem;
      background: rgba(255, 255, 255, 0.9);
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      flex-shrink: 0;
    }

    .stat-item {
      min-width: 180px;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      padding: 0.85rem 1rem;
      background: white;
    }

    .stat-item span {
      display: block;
      font-size: 1.35rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: #0f172a;
    }

    .stat-label {
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-top: 0.2rem;
    }

    .team-container {
      flex: 1;
      display: grid;
      grid-template-columns: 300px minmax(0, 1fr) 320px;
      overflow: hidden;
    }

    .panel {
      overflow-y: auto;
      padding: 1.5rem;
    }

    .panel + .panel {
      border-left: 1px solid #e5e7eb;
    }

    .section-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
      margin-bottom: 1rem;
      font-weight: 800;
    }

    .member-item,
    .queue-item,
    .activity-item,
    .approval-item {
      border: 1px solid #e5e7eb;
      border-radius: 18px;
      padding: 0.95rem 1rem;
      background: rgba(255, 255, 255, 0.96);
      margin-bottom: 0.9rem;
    }

    .member-item {
      display: flex;
      align-items: center;
      gap: 0.9rem;
    }

    .avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #111827;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 13px;
      flex-shrink: 0;
    }

    .member-name,
    .queue-title,
    .approval-title {
      font-size: 14px;
      font-weight: 800;
      color: #111827;
    }

    .member-role,
    .queue-detail,
    .approval-detail,
    .activity-text {
      font-size: 12px;
      color: #64748b;
      line-height: 1.55;
      margin-top: 0.22rem;
    }

    .member-meta,
    .queue-meta {
      margin-left: auto;
      text-align: right;
      flex-shrink: 0;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
      margin-right: 0.35rem;
    }

    .status-active { background: #10b981; }
    .status-idle { background: #f59e0b; }
    .status-offline { background: #cbd5e1; }
    .status-pill {
      display: inline-flex;
      align-items: center;
      padding: 0.22rem 0.55rem;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .active { background: #ecfdf5; color: #047857; }
    .queued,
    .waiting { background: #eff6ff; color: #1d4ed8; }
    .blocked,
    .ready { background: #fff7ed; color: #c2410c; }

    .activity-item {
      display: grid;
      grid-template-columns: 84px 1fr;
      gap: 0.85rem;
    }

    .timestamp {
      font-size: 11px;
      color: #94a3b8;
    }

    .empty {
      border: 1px dashed #cbd5e1;
      border-radius: 16px;
      padding: 1rem;
      color: #64748b;
      background: rgba(255,255,255,0.88);
    }

    @media (max-width: 1180px) {
      .team-container {
        grid-template-columns: 1fr;
      }

      .panel + .panel {
        border-left: none;
        border-top: 1px solid #e5e7eb;
      }
    }
  `;

  declare _room: TeamRoomState | null;
  declare _loading: boolean;
  declare _error: string | null;
  private _refreshHandle: number | null = null;

  constructor() {
    super();
    this._room = null;
    this._loading = true;
    this._error = null;
  }

  override async firstUpdated() {
    await this.refresh();
    this._refreshHandle = window.setInterval(() => void this.refresh(), 4000);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._refreshHandle !== null) {
      window.clearInterval(this._refreshHandle);
    }
  }

  async refresh() {
    try {
      this._loading = true;
      this._error = null;
      const runtime = await gatewayClient.getRuntime();
      const runs = await gatewayClient.getRuns();
      const runId = runtime.runId ?? runs[0]?.runId ?? null;
      const auditRoom =
        runtime.auditRoom ??
        (runId ? await gatewayClient.getRunProjection(runId) : null);
      const buildRoom = runId ? await gatewayClient.getRunBuildProjection(runId) : null;
      this._room = deriveRoom(runtime, auditRoom, buildRoom);
    } catch (error) {
      this._error = error instanceof Error ? error.message : String(error);
    } finally {
      this._loading = false;
    }
  }

  override render() {
    if (this._loading && !this._room) {
      return html`<div class="panel"><div class="empty">Loading Team Room...</div></div>`;
    }

    if (this._error && !this._room) {
      return html`<div class="panel"><div class="empty">Team Room failed: ${this._error}</div></div>`;
    }

    if (!this._room) {
      return html`<div class="panel"><div class="empty">Team Room idle. Start run to hydrate collaboration state.</div></div>`;
    }

    return html`
      <div class="stats-bar">
        <div class="stat-item">
          <span>${this._room.activeAuditors}</span>
          <div class="stat-label">auditors active</div>
        </div>
        <div class="stat-item">
          <span>${this._room.activeDevelopers}</span>
          <div class="stat-label">developers active</div>
        </div>
        <div class="stat-item">
          <span>${this._room.assignments.length}</span>
          <div class="stat-label">assignment lanes</div>
        </div>
        <div class="stat-item">
          <span>${this._room.approvals.filter((item) => item.status === "ready").length}</span>
          <div class="stat-label">approvals ready</div>
        </div>
      </div>

      <div class="team-container">
        <aside class="panel">
          <div class="section-title">Live Members</div>
          ${this._room.members.map((member) => html`
            <div class="member-item">
              <div class="avatar">${member.name[0]}</div>
              <div>
                <div class="member-name">${member.name}</div>
                <div class="member-role">${member.role} · ${relativeTime(member.lastActiveAt)}</div>
              </div>
              <div class="member-meta">
                <div><span class="status-dot status-${member.status}"></span>${member.status}</div>
              </div>
            </div>
          `)}
        </aside>

        <main class="panel">
          <div class="section-title">Assignments + Handoffs</div>
          ${this._room.assignments.length
            ? this._room.assignments.map((item) => html`
              <div class="queue-item">
                <div class="queue-title">${item.title}</div>
                <div class="queue-detail">${item.detail}</div>
                <div class="queue-meta">
                  <div class="status-pill ${item.status}">${item.status}</div>
                  <div class="queue-detail">owner: ${item.owner}</div>
                </div>
              </div>
            `)
            : html`<div class="empty">No active assignment lanes yet.</div>`}

          <div class="section-title" style="margin-top:1.4rem;">Activity Timeline</div>
          ${this._room.sharedActivity.length
            ? this._room.sharedActivity.map((entry) => {
              const parts = entry.split("::").map((part) => part.trim());
              return html`
                <div class="activity-item">
                  <div class="timestamp">${parts[0] ?? "event"}</div>
                  <div class="activity-text">${parts.slice(1).join(" · ") || entry}</div>
                </div>
              `;
            })
            : html`<div class="empty">No shared activity yet.</div>`}
        </main>

        <aside class="panel">
          <div class="section-title">Approval Lane</div>
          ${this._room.approvals.map((item) => html`
            <div class="approval-item">
              <div class="approval-title">${item.title}</div>
              <div class="approval-detail">${item.detail}</div>
              <div class="status-pill ${item.status}" style="margin-top:0.7rem;">${item.status}</div>
            </div>
          `)}
        </aside>
      </div>
    `;
  }
}

customElements.define("team-view", TeamView);
