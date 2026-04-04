var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { gatewayClient } from "./api/client.js";
// Import components
import "./onboarding/setup-view.js";
let SrpApp = class SrpApp extends LitElement {
    static styles = css `
    :host {
      display: block;
      font-family: 'Inter', system-ui, sans-serif;
      background: #08090a;
      color: #e4e6eb;
      min-height: 100vh;
    }

    .app-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    header {
      padding: 1rem 2rem;
      border-bottom: 1px solid #262a33;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #111318;
    }

    .logo {
      font-weight: 700;
      color: #00f5a0;
      font-family: 'JetBrains Mono', monospace;
      font-size: 1.25rem;
    }

    main {
      flex: 1;
      padding: 2rem;
      overflow-y: auto;
    }

    .card {
      background: #111318;
      border: 1px solid #262a33;
      border-radius: 8px;
      padding: 2rem;
      max-width: 600px;
      margin: 2rem auto;
    }

    h1 { color: #00f5a0; margin-top: 0; }
    
    .status-badge {
      background: #004d32;
      color: #00f5a0;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      text-transform: uppercase;
      font-weight: 600;
    }

    .phase-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-top: 1rem;
    }

    .phase-item {
      padding: 0.75rem;
      background: #1a1d23;
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .btn {
      background: #00f5a0;
      color: #08090a;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }

    .btn:hover { background: #00d98b; }

    code {
      background: #000;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      color: #00f5a0;
    }
  `;
    _bootstrap = null;
    _runtime = null;
    _loading = true;
    _path = window.location.pathname;
    _error = null;
    constructor() {
        super();
        console.log("SRP App constructor");
        // Hide boot status from index.html if it exists
        const boot = document.getElementById("boot-status");
        if (boot)
            boot.style.display = "none";
        window.addEventListener("error", (e) => {
            this._error = e.message;
            console.error("Global JS Error:", e);
        });
    }
    async firstUpdated() {
        console.log("SRP App firstUpdated");
        await this.refresh();
        // Basic router
        window.addEventListener("popstate", () => {
            this._path = window.location.pathname;
        });
        // Poll if ready
        setInterval(() => this.poll(), 5000);
    }
    async refresh() {
        try {
            console.log("[SrpApp] Refreshing app state...");
            this._loading = true; // Ensure loading is reset during refresh
            console.log("[SrpApp] Fetching bootstrap...");
            const bs = await gatewayClient.getBootstrap();
            this._bootstrap = bs;
            console.log("[SrpApp] Bootstrap received:", bs.decision);
            if (bs.decision === "ready") {
                console.log("[SrpApp] Fetching runtime...");
                this._runtime = await gatewayClient.getRuntime();
                console.log("[SrpApp] Runtime received:", this._runtime.isRunning ? "running" : "idle");
            }
            else {
                console.log("[SrpApp] Bootstrap not ready, skipping runtime fetch.");
            }
        }
        catch (err) {
            console.error("[SrpApp] Refresh failed:", err);
            this._error = "Failed to connect to SRP Gateway. Is it running?";
        }
        finally {
            console.log("[SrpApp] Refresh complete, setting loading=false");
            this._loading = false;
        }
    }
    async poll() {
        if (this._bootstrap?.decision === "ready") {
            try {
                this._runtime = await gatewayClient.getRuntime();
            }
            catch {
                // Ignore polling errors
            }
        }
    }
    render() {
        if (this._error) {
            return html `
        <div class="card" style="border-color: #ff4d4d;">
          <h1 style="color: #ff4d4d;">System Error</h1>
          <p>${this._error}</p>
          <button class="btn" style="background: #ff4d4d; color: white;" @click=${() => location.reload()}>Retry</button>
        </div>
      `;
        }
        if (this._loading) {
            return html `<div style="padding: 4rem; text-align: center; color: #00f5a0;">
        <div style="font-size: 2rem; margin-bottom: 1rem;">⚡</div>
        Initializing SRP Protocol...
      </div>`;
        }
        // Route to Setup
        if (this._path === "/setup") {
            return html `<setup-view></setup-view>`;
        }
        // Force setup if not ready
        if (this._bootstrap?.decision !== "ready") {
            return this.renderSetupRedirect();
        }
        return html `
      <div class="app-container">
        <header>
          <div class="logo">SRP</div>
          <div class="status-badge">Live Audit</div>
        </header>
        <main>
          ${this._runtime?.isRunning ? this.renderActiveAudit() : this.renderOverview()}
        </main>
      </div>
    `;
    }
    renderSetupRedirect() {
        return html `
      <div class="card">
        <h1>Onboarding Required</h1>
        <p>Your workspace is not yet ready for a security audit.</p>
        <p>Status: <strong>${this._bootstrap?.decision}</strong></p>
        <div style="margin-top: 2rem; display: flex; gap: 1rem;">
          <a href="/setup" class="btn" style="text-decoration: none; display: inline-block;" @click=${this.navigate}>
            Configure in Web UI
          </a>
          <button class="btn" style="background: #1a1d23; color: #e4e6eb;" @click=${this.refresh}>Check Again</button>
        </div>
        <p style="margin-top: 1.5rem; font-size: 0.875rem; color: #9499ab;">
          Pro-tip: Run <code>srp onboard</code> in your terminal.
        </p>
      </div>
    `;
    }
    navigate(e) {
        e.preventDefault();
        const href = e.currentTarget.href;
        window.history.pushState({}, "", href);
        this._path = window.location.pathname;
    }
    renderOverview() {
        return html `
      <div class="card">
        <h1>Project Overview</h1>
        <p>Welcome to the SRP Methodology Dashboard.</p>
        <p><strong>Role:</strong> <code>${this._bootstrap?.role}</code></p>
        <p><strong>Provider:</strong> <code>${this._bootstrap?.providers.healthyKinds.join(", ") || "None"}</code></p>
        
        <div style="margin-top: 2rem;">
          <button class="btn" @click=${this.startAudit}>Start Methodology Audit</button>
        </div>
      </div>
    `;
    }
    renderActiveAudit() {
        const phases = this._runtime?.phases || [];
        return html `
      <div class="card">
        <h1>Audit in Progress</h1>
        <div class="phase-list">
          ${phases.map(p => html `
            <div class="phase-item">
              <span>${p.phase}</span>
              <span style="color: ${p.status === 'completed' ? '#00f5a0' : p.status === 'running' ? '#fbbf24' : '#5c6079'}">
                ${p.status}
              </span>
            </div>
          `)}
        </div>
      </div>
    `;
    }
    async startAudit() {
        if (!this._bootstrap)
            return;
        try {
            await gatewayClient.startRuntime(this._bootstrap.role);
            await this.refresh();
        }
        catch (err) {
            this._error = "Failed to start audit: " + err;
        }
    }
};
__decorate([
    state(),
    __metadata("design:type", Object)
], SrpApp.prototype, "_bootstrap", void 0);
__decorate([
    state(),
    __metadata("design:type", Object)
], SrpApp.prototype, "_runtime", void 0);
__decorate([
    state(),
    __metadata("design:type", Object)
], SrpApp.prototype, "_loading", void 0);
__decorate([
    state(),
    __metadata("design:type", Object)
], SrpApp.prototype, "_path", void 0);
__decorate([
    state(),
    __metadata("design:type", Object)
], SrpApp.prototype, "_error", void 0);
SrpApp = __decorate([
    customElement("srp-app"),
    __metadata("design:paramtypes", [])
], SrpApp);
export { SrpApp };
//# sourceMappingURL=srp-app.js.map