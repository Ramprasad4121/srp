import { LitElement, html, css } from "lit";

export class GStackView extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #fff;
      font-family: 'JetBrains Mono', monospace;
      color: #000;
      overflow-y: auto;
    }

    .hero-section {
      padding: 4rem 2rem;
      border-bottom: 1px solid #eee;
      text-align: center;
      background: #fcfcfc;
    }

    .hero-title {
      font-size: 2.5rem;
      font-weight: 800;
      letter-spacing: -0.05em;
      margin-bottom: 1rem;
    }

    .hero-subtitle {
      font-size: 1rem;
      color: #666;
      max-width: 600px;
      margin: 0 auto;
      line-height: 1.6;
    }

    .grid-container {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 2rem;
      padding: 3rem 2rem;
    }

    .card {
      border: 1px solid #eee;
      padding: 2rem;
      transition: all 0.2s;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .card:hover {
      border-color: #000;
      box-shadow: 4px 4px 0 rgba(0,0,0,0.05);
    }

    .card-title {
      font-size: 1.25rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .card-title span {
      font-size: 0.75rem;
      background: #000;
      color: #fff;
      padding: 2px 6px;
      text-transform: uppercase;
    }

    .card-description {
      font-size: 0.875rem;
      color: #666;
      line-height: 1.5;
    }

    .btn-action {
      margin-top: auto;
      background: #000;
      color: #fff;
      border: none;
      padding: 0.75rem;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      cursor: pointer;
    }

    .btn-action:hover {
      background: #333;
    }

    .section-header {
      padding: 2rem 2rem 0 2rem;
      font-size: 0.75rem;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 2px;
    }

    .command-list {
      padding: 2rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .command-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      background: #f9f9f9;
      border: 1px solid #eee;
    }

    .command-code {
      font-weight: 700;
      color: #0052FF;
    }

    .command-desc {
      font-size: 0.875rem;
      color: #666;
    }
  `;

  override render() {
    return html`
      <div class="hero-section">
        <div class="hero-title">BUILD FROM SCRATCH</div>
        <p class="hero-subtitle">
          Powered by <strong>.gstack</strong>. Turn SRP into a virtual engineering team. 
          Initialize new protocols, design architectures, and ship production-ready code with an army of agents.
        </p>
      </div>

      <div class="section-header">Core GSTACK Agents</div>
      <div class="grid-container">
        <div class="card">
          <div class="card-title">CEO Agent <span>Product</span></div>
          <p class="card-description">Rethinks product requirements and aligns technical goals with business vision.</p>
          <button class="btn-action">Run /plan-ceo-review</button>
        </div>
        <div class="card">
          <div class="card-title">EM Agent <span>Arch</span></div>
          <p class="card-description">Locks down system architecture and ensures modular, scalable design patterns.</p>
          <button class="btn-action">Run /plan-eng-review</button>
        </div>
        <div class="card">
          <div class="card-title">QA Agent <span>Browser</span></div>
          <p class="card-description">Automates browser-based testing and functional verification of your protocol.</p>
          <button class="btn-action">Run /qa</button>
        </div>
        <div class="card">
          <div class="card-title">Ship Agent <span>Deploy</span></div>
          <p class="card-description">Handles CI/CD pipelines, land-and-deploy sequences, and production releases.</p>
          <button class="btn-action">Run /ship</button>
        </div>
      </div>

      <div class="section-header">Direct Command Interface</div>
      <div class="command-list">
        <div class="command-item">
          <span class="command-code">/office-hours</span>
          <span class="command-desc">Describe what you want to build from scratch.</span>
        </div>
        <div class="command-item">
          <span class="command-code">/autoplan</span>
          <span class="command-desc">Generate a multi-phase implementation roadmap.</span>
        </div>
        <div class="command-item">
          <span class="command-code">/codex</span>
          <span class="command-desc">Access the deep knowledge base of protocol patterns.</span>
        </div>
      </div>
    `;
  }
}

customElements.define("gstack-view", GStackView);
