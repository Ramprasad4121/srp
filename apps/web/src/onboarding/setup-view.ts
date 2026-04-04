import { LitElement, html, css } from "lit";
import { gatewayClient } from "../api/client.js"; 
import type { RuntimeMode } from "@srp/shared-types";

export class SetupView extends LitElement {
  static override properties = {
    _role: { state: true },
    _step: { state: true },
  };

  static override styles = css`
    :host {
      display: block;
      max-width: 800px;
      margin: 4rem auto;
      padding: 2rem;
      background: #111318;
      border: 1px solid #262a33;
      border-radius: 8px;
    }

    h1 { color: #00f5a0; margin-bottom: 2rem; }
    
    .step {
      margin-bottom: 3rem;
    }

    .options {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-top: 1rem;
    }

    .option-card {
      padding: 1.5rem;
      background: #1a1d23;
      border: 1px solid #262a33;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .option-card:hover { border-color: #00f5a0; }
    .option-card.selected { border-color: #00f5a0; background: #004d32; }

    .option-title { font-weight: 600; margin-bottom: 0.5rem; display: block; }
    .option-hint { font-size: 0.875rem; color: #9499ab; }

    .btn-primary {
      background: #00f5a0;
      color: #08090a;
      border: none;
      padding: 1rem 2rem;
      border-radius: 4px;
      font-weight: 700;
      cursor: pointer;
      width: 100%;
      font-size: 1rem;
    }
  `;

  declare _role: RuntimeMode;
  declare _step: number;

  constructor() {
    super();
    this._role = "auditor";
    this._step = 1;
  }

  override render() {
    return html`
      <h1>SRP Onboarding</h1>
      
      ${this._step === 1 ? this.renderRoleStep() : this.renderFinalStep()}
    `;
  }

  private renderRoleStep() {
    return html`
      <div class="step">
        <p>Choose your primary methodology focus:</p>
        <div class="options">
          <div class="option-card ${this._role === 'auditor' ? 'selected' : ''}" 
               @click=${() => this._role = 'auditor'}>
            <span class="option-title">Auditor</span>
            <span class="option-hint">Deep security reasoning, invariant extraction, and exploit proving.</span>
          </div>
          <div class="option-card ${this._role === 'developer' ? 'selected' : ''}" 
               @click=${() => this._role = 'developer'}>
            <span class="option-title">Developer</span>
            <span class="option-hint">NatSpec generation, test suite expansion, and secure build feedback.</span>
          </div>
        </div>
      </div>
      <button class="btn-primary" @click=${this.saveRole}>Continue</button>
    `;
  }

  private renderFinalStep() {
    return html`
      <div class="step">
        <p>Your role has been set to <strong>${this._role}</strong>.</p>
        <p>To finalize provider keys and workspace settings, please use the CLI:</p>
        <pre style="background: #000; padding: 1rem; border-radius: 4px; color: #00f5a0;">srp onboard</pre>
      </div>
      <button class="btn-primary" @click=${() => window.location.href = "/"}>Back to Dashboard</button>
    `;
  }

  private async saveRole() {
    try {
      await gatewayClient.startRuntime(this._role); 
      this._step = 2;
    } catch (err) {
      alert("Failed to save role: " + err);
    }
  }
}

customElements.define("setup-view", SetupView);
