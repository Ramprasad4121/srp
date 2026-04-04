import { LitElement, html, css } from "lit";
import type { TeamMember, TeamRoom } from "@srp/shared-types";

export class TeamView extends LitElement {
  static override properties = {
    _room: { state: true }
  };

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #fff;
      font-family: 'JetBrains Mono', monospace;
      color: #000;
      overflow: hidden;
    }

    .stats-bar {
      padding: 1rem 2rem;
      background: #fcfcfc;
      border-bottom: 1px solid #eee;
      display: flex;
      gap: 3rem;
      font-size: 11px;
      color: #999;
      letter-spacing: 1px;
      flex-shrink: 0;
    }

    .stat-item span {
      color: #000;
      font-weight: 700;
      margin-right: 0.5rem;
    }

    .team-container {
      flex: 1;
      display: grid;
      grid-template-columns: 320px 1fr;
      overflow: hidden;
    }

    /* Members Sidebar */
    .members-sidebar {
      border-right: 1px solid #eee;
      padding: 2rem;
      background: #fff;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }

    .section-title {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #ccc;
      margin-bottom: 2rem;
      font-weight: 700;
    }

    .member-item {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      margin-bottom: 1.5rem;
      padding: 0.5rem 0;
    }

    .avatar {
      width: 36px;
      height: 36px;
      background: #000;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 12px;
      flex-shrink: 0;
    }

    .member-info {
      flex: 1;
      min-width: 0;
    }

    .member-name {
      font-size: 13px;
      font-weight: 700;
      color: #000;
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .member-role {
      font-size: 10px;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .status-active { background: #0052FF; box-shadow: 0 0 8px rgba(0, 82, 255, 0.5); }
    .status-idle { background: #f59e0b; }
    .status-offline { background: #eee; }

    /* Activity Feed */
    .activity-feed {
      display: flex;
      flex-direction: column;
      padding: 2rem 3rem;
      overflow-y: auto;
      background: #fff;
    }

    .activity-item {
      padding: 1rem 0;
      border-bottom: 1px solid #f9f9f9;
      font-size: 13px;
      display: flex;
      gap: 1.5rem;
      line-height: 1.6;
    }

    .timestamp {
      color: #ccc;
      min-width: 80px;
      font-size: 11px;
    }

    .activity-text {
      color: #666;
    }

    .highlight {
      color: #000;
      font-weight: 700;
    }

    .btn-invite {
      margin-top: auto;
      background: #000;
      color: #fff;
      border: none;
      padding: 1rem;
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      text-transform: uppercase;
      letter-spacing: 1px;
      cursor: pointer;
      font-weight: 700;
    }

    .btn-invite:hover {
      background: #333;
    }
  `;

  declare _room: TeamRoom;

  constructor() {
    super();
    this._room = {
      id: "room-01",
      name: "Main Protocol Audit Room",
      activeAuditors: 4,
      activeDevelopers: 2,
      members: [
        { id: "m1", name: "Alice (Lead)", role: "auditor", status: "active", lastActiveAt: new Date().toISOString() },
        { id: "m2", name: "Bob", role: "auditor", status: "active", lastActiveAt: new Date().toISOString() },
        { id: "m3", name: "Charlie", role: "auditor", status: "idle", lastActiveAt: new Date().toISOString() },
        { id: "m4", name: "Dave", role: "auditor", status: "offline", lastActiveAt: new Date().toISOString() },
        { id: "d1", name: "Eve (Dev)", role: "developer", status: "active", lastActiveAt: new Date().toISOString() },
        { id: "d2", name: "Frank (Dev)", role: "developer", status: "active", lastActiveAt: new Date().toISOString() }
      ],
      sharedActivity: [
        "Alice uploaded a new finding: REENTRANCY_IN_VAULT",
        "Bob started reviewing phase: ARCHITECTURE_ANALYSIS",
        "Eve merged PR: FIX_SLIPPAGE_CHECKS",
        "System: New invariant identified by SRP_AGENT: VAULT_SOLVENCY",
        "Frank connected to the room",
        "Alice: Team, let's focus on the economic modeling phase next.",
        "Charlie marked invariant INV-04 as verified",
        "System: Audit coverage reached 85%"
      ]
    };
  }

  override render() {
    return html`
      <div class="stats-bar">
        <div class="stat-item"><span>${this._room.activeAuditors}</span> AUDITORS_ONLINE</div>
        <div class="stat-item"><span>${this._room.activeDevelopers}</span> DEVELOPERS_CONNECTED</div>
        <div class="stat-item">PROTOCOL_V1.0_SHARING_ACTIVE</div>
      </div>

      <div class="team-container">
        <aside class="members-sidebar">
          <div class="section-title">Active Team</div>
          ${this._room.members.map(m => html`
            <div class="member-item">
              <div class="avatar">${m.name[0]}</div>
              <div class="member-info">
                <div class="member-name">${m.name}</div>
                <div class="member-role">${m.role}</div>
              </div>
              <div class="status-dot status-${m.status}"></div>
            </div>
          `)}
          <button class="btn-invite">+ Invite Member</button>
        </aside>

        <main class="activity-feed">
          <div class="section-title">Real-time Collaboration Log</div>
          ${this._room.sharedActivity.map((act, i) => html`
            <div class="activity-item">
              <span class="timestamp">[${new Date(Date.now() - (i * 300000)).toLocaleTimeString([], {hour12:false})}]</span>
              <span class="activity-text">${this.formatActivity(act)}</span>
            </div>
          `)}
        </main>
      </div>
    `;
  }

  private formatActivity(text: string) {
    const parts = text.split(':');
    if (parts.length > 1) {
      return html`<span class="highlight">${parts[0]}:</span> ${parts[1]}`;
    }
    return text;
  }
}

customElements.define("team-view", TeamView);
