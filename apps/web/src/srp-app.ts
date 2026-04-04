import { LitElement, html, css } from "lit";
import { gatewayClient } from "./api/client.js";
import type { AppBootstrapResult, RuntimeSessionState } from "@srp/shared-types";

// Import components
import "./onboarding/setup-view.js";
import "./features/chat/chat-view.js";

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
  };

  static override styles = css`
    :host {
      display: block;
      font-family: 'Inter', system-ui, sans-serif;
      background: #f7f9fa; /* x402 light background */
      color: #000;
      min-height: 100vh;
    }

    .app-container {
      display: flex;
      height: 100vh;
      overflow: hidden;
    }

    /* Sidebar Styles */
    .sidebar {
      background: #fff;
      border-right: 1px solid #000;
      display: flex;
      flex-direction: column;
      z-index: 10;
      padding: 1.5rem 0;
      width: 260px;
      flex-shrink: 0;
      transition: margin-left 0.3s ease;
    }

    .sidebar.closed {
      margin-left: -260px;
    }

    .sidebar-header {
      padding: 0 1.5rem 1.5rem 1.5rem;
      border-bottom: 1px solid #e1e3e8;
      margin-bottom: 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .logo {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      font-size: 1.25rem;
      letter-spacing: -0.05em;
    }

    .toggle-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1.2rem;
      padding: 0;
    }

    .nav-menu {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0 1rem;
    }

    .nav-item {
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      color: #666;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .nav-item:hover {
      background: #f0f0f0;
      color: #000;
    }

    .nav-item.active {
      background: #000;
      color: #fff;
    }

    .sidebar-section {
      margin-top: 2rem;
      padding: 0 1rem;
    }

    .section-title {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 700;
      color: #999;
      margin-bottom: 0.75rem;
      padding: 0 1rem;
    }

    .mode-options {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0 1rem;
    }

    .mode-item {
      font-size: 0.875rem;
      font-weight: 500;
      padding: 0.5rem 1rem;
      border: 1px solid transparent;
      border-radius: 4px;
      cursor: pointer;
      color: #666;
    }
    
    .mode-item.active {
      border: 1px solid #000;
      background: #f7f9fa;
      color: #000;
    }

    .skills-section {
      flex: 1;
      overflow-y: auto;
      margin-top: 2rem;
      padding: 0 1rem;
    }

    .skill-list {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .skill-item {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      padding: 0.4rem 1rem;
      color: #333;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: default;
    }

    .skill-item::before {
      content: "•";
      margin-right: 0.5rem;
      color: #000;
    }

    .main-content {
      position: relative;
      flex: 1;
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .room-header {
      background: #fff;
      border-bottom: 1px solid #000;
      padding: 1rem 1.5rem;
      font-size: 1.25rem;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
      flex-shrink: 0;
      text-align: center;
    }

    .room-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .room-container.auditor-room {
      /* specific styling for auditor room if needed */
    }

    .room-container.developer-room {
      /* specific styling for developer room if needed */
    }

    .hamburger-btn {
      position: absolute;
      top: 1.5rem;
      left: 1.5rem;
      z-index: 20;
      background: #fff;
      border: 1px solid #000;
      border-radius: 4px;
      padding: 0.5rem;
      cursor: pointer;
      box-shadow: 2px 2px 0 rgba(0,0,0,0.1);
    }
  `;

  declare _bootstrap: AppBootstrapResult | null;
  declare _runtime: RuntimeSessionState | null;
  declare _loading: boolean;
  declare _path: string;
  declare _error: string | null;
  declare _skills: any[];
  declare _sidebarOpen: boolean;
  declare _mode: "auditor" | "developer";

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

    console.log("SRP App initialized");
    
    const boot = document.getElementById("boot-status");
    if (boot) boot.style.display = "none";

    document.body.style.background = "#f7f9fa";
    document.body.style.color = "#000";

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

  async updateMode(mode: "auditor" | "developer") {
    this._mode = mode;
    try {
      await gatewayClient.setRole(mode);
    } catch(e) {
      console.warn("Failed to update role on backend", e);
    }
  }

  override render() {
    if (this._error) {
      return html`
        <div style="border: 1px solid #ff4d4d; margin: 4rem auto; max-width: 800px; padding: 2rem; border-radius: 8px;">
          <h1 style="color: #ff4d4d;">System Error</h1>
          <p>${this._error}</p>
          <button style="background: #ff4d4d; color: white; padding: 0.75rem 1.5rem; border: none; border-radius: 4px;" @click=${() => location.reload()}>Retry Connection</button>
        </div>
      `;
    }

    if (this._loading) {
      return html`<div style="padding: 4rem; text-align: center; color: #000; font-family: 'JetBrains Mono', monospace;">
        <div style="font-size: 2rem; margin-bottom: 1rem;">⚡</div>
        Initializing SRP Protocol...
      </div>`;
    }

    if (this._path === "/setup") {
      return html`<setup-view></setup-view>`;
    }

    if (this._bootstrap?.decision !== "ready") {
      return html`
        <div style="border: 1px solid #000; margin: 4rem auto; max-width: 800px; padding: 2rem; border-radius: 8px;">
          <h1>Onboarding Required</h1>
          <p>Your workspace is not yet ready for a security audit.</p>
          <a href="/setup" style="display:inline-block; margin-top:1rem; padding:0.75rem 1.5rem; background:#000; color:#fff; text-decoration:none; border-radius:4px;" @click=${this.navigate}>Configure in Web UI</a>
        </div>
      `;
    }

    return html`
      <div class="app-container">
        <!-- Persistent Sidebar -->
        <aside class="sidebar ${this._sidebarOpen ? '' : 'closed'}">
          <div class="sidebar-header">
            <div class="logo-container">
              <span class="logo">SRP</span>
              <span style="font-size: 0.75rem; background: #000; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: bold;">WEB</span>
            </div>
            <button class="toggle-btn" @click=${() => this._sidebarOpen = false}>×</button>
          </div>
          
          <nav class="nav-menu">
            <div class="nav-item active">Chat Engine</div>
            <div class="nav-item">Methodology Audit</div>
            <div class="nav-item" @click=${() => { window.history.pushState({}, "", "/setup"); this._path = "/setup"; }}>Settings</div>
          </nav>

          <div class="sidebar-section">
            <div class="section-title">Current Mode</div>
            <div class="mode-options">
              <div class="mode-item ${this._mode === 'auditor' ? 'active' : ''}" @click=${() => this.updateMode('auditor')}>
                Auditor
              </div>
              <div class="mode-item ${this._mode === 'developer' ? 'active' : ''}" @click=${() => this.updateMode('developer')}>
                Developer
              </div>
            </div>
          </div>

          <div class="sidebar-section">
            <div class="section-title">Resources</div>
            <div class="nav-menu" style="padding: 0;">
              <div class="nav-item">Learning Section</div>
              <div class="nav-item">Documentation</div>
            </div>
          </div>

          <div class="skills-section">
            <div class="section-title">Active Skills (${this._skills.length})</div>
            <div class="skill-list">
              ${this._skills.length === 0 
                ? html`<div style="padding: 0 1rem; font-size: 0.75rem; color: #999;">Loading...</div>`
                : this._skills.map(s => html`<div class="skill-item" title=${s.name}>${s.name}</div>`)
              }
            </div>
          </div>
        </aside>

        <!-- Main Chat UI Area -->
        <main class="main-content">
          <div class="room-header">
            ${this._mode === 'auditor' ? 'AUDITOR ROOM' : 'DEVELOPER ROOM'}
          </div>
          ${!this._sidebarOpen ? html`
            <button class="hamburger-btn" @click=${() => this._sidebarOpen = true}>
              ☰
            </button>
          ` : ''}
          <div class="room-container ${this._mode}-room">
            <chat-view .mode=${this._mode}></chat-view>
          </div>
        </main>
      </div>
    `;
  }

  private navigate(e: MouseEvent) {
    e.preventDefault();
    const href = (e.currentTarget as HTMLAnchorElement).href;
    window.history.pushState({}, "", href);
    this._path = window.location.pathname;
  }
}

customElements.define("srp-app", SrpApp);
