import { LitElement, html, css } from "lit";
import { gatewayClient } from "./api/client.js";
import type { AppBootstrapResult, RuntimeSessionState } from "@srp/shared-types";

// Import components
import "./onboarding/setup-view.js";
import "./features/chat/chat-view.js";
import "./features/team/team-view.js";
import "./features/gstack/gstack-view.js";
import "./features/methodology/methodology-view.js";
import "./features/methodology/whiteboard-overlay.js";

export class SrpApp extends LitElement {
  static override properties = {
    _bootstrap: { state: true },
    _runtime: { state: true },
    _loading: { state: true },
    _path: { state: true },
    _error: { state: true },
    _skills: { state: true },
    _sidebarOpen: { state: true },
    _mode: { state: true },
    _whiteboardOpen: { state: true },
  };

  static override styles = css`
    :host {
      --bg-app: #ffffff;
      --bg-sidebar: #f9fafb;
      --border-main: #e5e7eb;
      --text-primary: #111827;
      --text-secondary: #6b7280;
      --text-muted: #9ca3af;
      --accent: #0052FF;
      
      display: block;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: var(--bg-app);
      color: var(--text-primary);
      min-height: 100vh;
    }

    .app-container {
      display: flex;
      height: 100vh;
      overflow: hidden;
    }

    /* Sidebar Refinement */
    .sidebar {
      background: var(--bg-sidebar);
      border-right: 1px solid var(--border-main);
      display: flex;
      flex-direction: column;
      z-index: 10;
      width: 280px;
      flex-shrink: 0;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .sidebar.closed {
      width: 0;
      opacity: 0;
      pointer-events: none;
    }

    .sidebar-header {
      padding: 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .logo {
      font-weight: 800;
      font-size: 1.1rem;
      letter-spacing: -0.02em;
      color: var(--text-primary);
    }

    .logo-badge {
      font-size: 10px;
      background: var(--text-primary);
      color: #fff;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 700;
      letter-spacing: 0.05em;
    }

    .nav-section {
      padding: 0.5rem 0.75rem;
    }

    .section-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 1.5rem 0.75rem 0.5rem 0.75rem;
    }

    .nav-item {
      padding: 0.625rem 0.75rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 0.75rem;
      transition: all 0.15s ease;
    }

    .nav-item:hover {
      background: #f3f4f6;
      color: var(--text-primary);
    }

    .nav-item.active {
      background: #fff;
      color: var(--text-primary);
      box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.02);
      border: 1px solid var(--border-main);
    }

    .nav-icon {
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.7;
    }

    /* Role Switcher */
    .role-switcher {
      margin: 1.5rem 0.75rem;
      background: #f3f4f6;
      padding: 0.25rem;
      border-radius: 8px;
      display: flex;
      gap: 0.25rem;
    }

    .role-btn {
      flex: 1;
      padding: 0.5rem;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
      color: var(--text-secondary);
    }

    .role-btn.active {
      background: #fff;
      color: var(--text-primary);
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }

    /* Main Content Refinement */
    .main-content {
      position: relative;
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #fff;
    }

    .top-bar {
      height: 60px;
      border-bottom: 1px solid var(--border-main);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1.5rem;
      background: #fff;
      z-index: 5;
    }

    .page-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 12px;
      color: var(--text-secondary);
    }

    .pulse-dot {
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }

    .view-container {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .view-container > * {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .hamburger-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.5rem;
      margin-right: 0.5rem;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
    }

    .hamburger-btn:hover {
      color: var(--text-primary);
    }

    /* Skills simplified */
    .skills-footer {
      margin-top: auto;
      padding: 1.5rem;
      border-top: 1px solid var(--border-main);
    }

    .skills-count {
      font-size: 11px;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
    }

    .skills-pills {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
    }

    .skill-pill {
      font-size: 10px;
      background: #f3f4f6;
      color: var(--text-secondary);
      padding: 2px 8px;
      border-radius: 100px;
      white-space: nowrap;
    }

      [hidden] {
        display: none !important;
      }

      .floating-fab {
        position: fixed !important;
        bottom: 32px !important;
        right: 32px !important;
        width: 60px !important;
        height: 60px !important;
        border-radius: 50% !important;
        background: #0052FF !important;
        color: white !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3) !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 9999 !important;
        border: 2px solid white !important;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .floating-fab:hover {
        transform: translateY(-4px) scale(1.05);
        background: #0041cc !important;
      }

      .fab-icon {
        width: 32px;
        height: 32px;
        stroke: white !important;
      }
    `;

  declare _bootstrap: AppBootstrapResult | null;
  declare _runtime: RuntimeSessionState | null;
  declare _loading: boolean;
  declare _path: string;
  declare _error: string | null;
  declare _skills: any[];
  declare _sidebarOpen: boolean;
  declare _chatPanelOpen: boolean;
  declare _mode: "auditor" | "developer";
  declare _whiteboardOpen: boolean;

  constructor() {
    super();
    this._bootstrap = null;
    this._runtime = null;
    this._loading = true;
    this._path = window.location.pathname;
    this._error = null;
    this._skills = [];
    this._sidebarOpen = true;
    this._mode = "auditor";
    this._whiteboardOpen = false;

    console.log("SRP Senior App initialized");
    
    const boot = document.getElementById("boot-status");
    if (boot) boot.style.display = "none";

    document.body.style.background = "#ffffff";
    document.body.style.color = "#111827";

    window.addEventListener("error", (e) => {
      this._error = e.message;
      console.error("Global JS Error:", e);
    });
  }

  override async firstUpdated() {
    await this.refresh();
    
    window.addEventListener("popstate", () => {
      this._path = window.location.pathname;
    });

    setInterval(() => this.poll(), 5000);
  }

  override updated(changedProps: Map<string, any>) {
    if (changedProps.has("_whiteboardOpen")) {
      console.log("WhiteboardOverlay: _whiteboardOpen =", this._whiteboardOpen);
    }
  }

  async refresh() {
    try {
      const bs = await gatewayClient.getBootstrap();
      this._bootstrap = bs;
      
      if (bs.decision === "ready") {
        this._runtime = await gatewayClient.getRuntime();
        
        try {
          const skillsRes = await gatewayClient.getSkills();
          if (skillsRes.ok) {
            this._skills = skillsRes.data;
          }
        } catch (e) {
          console.warn("Could not fetch skills", e);
        }
      }
    } catch (err) {
      this._error = "Failed to connect to SRP Gateway. Is it running?";
      console.error(err);
    } finally {
      this._loading = false;
    }
  }

  async poll() {
    if (this._bootstrap?.decision === "ready") {
      try {
        const rt = await gatewayClient.getRuntime();
        this._runtime = rt;
      } catch {
        // Ignore polling errors
      }
    }
  }

  private _handleNavigate(e: Event, path: string) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    console.log(`Navigating to: ${path}`);
    window.history.pushState({}, "", path);
    this._path = path;
  }

  override render() {
    if (this._error) {
      return html`
        <div style="padding: 4rem; max-width: 600px; margin: auto; text-align: center;">
          <h1 style="font-size: 1.5rem; margin-bottom: 1rem;">Connection Error</h1>
          <p style="color: var(--text-secondary); margin-bottom: 2rem;">${this._error}</p>
          <button style="background: var(--text-primary); color: #fff; padding: 0.75rem 1.5rem; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;" @click=${() => location.reload()}>Reconnect</button>
        </div>
      `;
    }

    if (this._loading) {
      return html`<div style="height: 100vh; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 500; color: var(--text-secondary);">
        <div class="pulse-dot" style="margin-right: 1rem;"></div>
        Initializing SRP Protocol...
      </div>`;
    }

    if (this._path === "/setup") {
      return html`<setup-view></setup-view>`;
    }

    if (this._bootstrap?.decision !== "ready") {
      return html`
        <div style="padding: 4rem; max-width: 600px; margin: auto; text-align: center;">
          <h1 style="font-size: 1.5rem; margin-bottom: 1rem;">Welcome to SRP</h1>
          <p style="color: var(--text-secondary); margin-bottom: 2rem;">Your local environment is not yet configured for security auditing.</p>
          <a href="/setup" style="background: var(--text-primary); color: #fff; padding: 0.75rem 1.5rem; text-decoration: none; border-radius: 6px; font-weight: 600;" @click=${(e: Event) => this._handleNavigate(e, "/setup")}>Configure Environment</a>
        </div>
      `;
    }

    return html`
      <!-- Floating Audit Tools -->
      <button 
        class="floating-fab" 
        @click=${() => { 
          this._whiteboardOpen = !this._whiteboardOpen;
          console.log("FAB Click: _whiteboardOpen =", this._whiteboardOpen);
        }} 
        title="Open Audit Drawing Whiteboard"
      >
        <svg class="fab-icon" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
        </svg>
      </button>

      <whiteboard-overlay 
        ?open=${this._whiteboardOpen}
        @close-whiteboard=${() => { console.log("Closing whiteboard"); this._whiteboardOpen = false; }}
      ></whiteboard-overlay>

      <div class="app-container">
        <!-- Minimal Sidebar -->
        <aside class="sidebar ${this._sidebarOpen ? '' : 'closed'}">
          <div class="sidebar-header">
            <div class="logo-container">
              <span class="logo">SRP Protocol</span>
              <span class="logo-badge">v1.0</span>
            </div>
            <button class="toggle-btn" style="background:none; border:none; cursor:pointer; color:var(--text-muted);" @click=${() => { console.log("Sidebar toggled"); this._sidebarOpen = false; }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/></svg>
            </button>
          </div>

          <div class="role-switcher">
            <div class="role-btn ${this._mode === 'auditor' ? 'active' : ''}" @click=${() => this.updateMode('auditor')}>Auditor</div>
            <div class="role-btn ${this._mode === 'developer' ? 'active' : ''}" @click=${() => this.updateMode('developer')}>Developer</div>
          </div>
          
          <div class="section-label">${this._mode.toUpperCase()} WORKSPACE</div>
          <nav class="nav-section">
            <div class="nav-item ${this._path === '/' ? 'active' : ''}" @click=${(e: Event) => this._handleNavigate(e, "/")}>
              <div class="nav-icon">◈</div> Chat Engine
            </div>
            
            ${this._mode === 'auditor' ? html`
              <div class="nav-item ${this._path === '/audit' ? 'active' : ''}" @click=${(e: Event) => this._handleNavigate(e, "/audit")}>
                <div class="nav-icon">🛡️</div> Start Methodology Audit
              </div>
            ` : html`
              <div class="nav-item ${this._path === '/build' ? 'active' : ''}" @click=${(e: Event) => this._handleNavigate(e, "/build")}>
                <div class="nav-icon">⌬</div> Build from Scratch
              </div>
            `}

            <div class="nav-item ${this._path === '/team' ? 'active' : ''}" @click=${(e: Event) => this._handleNavigate(e, "/team")}>
              <div class="nav-icon">◎</div> Virtual Room
            </div>
          </nav>

          <div class="section-label">System</div>
          <nav class="nav-section">
            <div class="nav-item ${this._path === '/setup' ? 'active' : ''}" @click=${(e: Event) => this._handleNavigate(e, "/setup")}>
              <div class="nav-icon">⚙</div> Settings
            </div>
          </nav>

          <div class="skills-footer">
            <div class="skills-count">Active Agents: ${this._skills.length}</div>
            <div class="skills-pills">
              ${this._skills.slice(0, 6).map(s => html`<div class="skill-pill">${s.name}</div>`)}
              ${this._skills.length > 6 ? html`<div class="skill-pill">+${this._skills.length - 6}</div>` : ''}
            </div>
          </div>
        </aside>

        <!-- Main Workspace Area -->
        <main class="main-content">
          <header class="top-bar">
            <div class="page-title">
              ${!this._sidebarOpen ? html`
                <button class="hamburger-btn" @click=${() => this._sidebarOpen = true}>
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
                </button>
              ` : ''}
              ${this._path === '/audit' ? 'Methodology Pipeline' : (this._path === '/build' ? 'Build Workflow' : (this._path === '/team' ? 'Collaboration' : 'Security Chat'))}
            </div>
            <div class="status-indicator">
              <div class="pulse-dot"></div>
              <span>Protocol Active</span>
            </div>
          </header>

          <div class="view-container">
            <methodology-view ?hidden=${this._path !== '/audit'}></methodology-view>
            <gstack-view ?hidden=${this._path !== '/build'}></gstack-view>
            <team-view ?hidden=${this._path !== '/team'}></team-view>
            <chat-view ?hidden=${this._path !== '/' && this._path !== ''} .mode=${this._mode}></chat-view>
          </div>
        </main>
      </div>
    `;
  }

  async updateMode(mode: "auditor" | "developer") {
    this._mode = mode;
    try {
      await gatewayClient.setRole(mode);
    } catch(e) {
      console.warn("Failed to update role on backend", e);
    }
  }
}

customElements.define("srp-app", SrpApp);
