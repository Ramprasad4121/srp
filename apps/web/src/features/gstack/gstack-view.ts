import { LitElement, html, css } from "lit";

const BUILD_STAGES = [
  {
    name: "Discover",
    code: "01",
    summary: "Turn rough intent into scope, threat model, and concrete success criteria."
  },
  {
    name: "Plan",
    code: "02",
    summary: "Lock architecture, contracts, frontend slices, and delivery checkpoints."
  },
  {
    name: "Design",
    code: "03",
    summary: "Prepare contract interfaces, NatSpec structure, UX flow, and system diagrams."
  },
  {
    name: "Build",
    code: "04",
    summary: "Generate contracts, docs, tests, and dapp slices with secure defaults."
  },
  {
    name: "QA",
    code: "05",
    summary: "Run bug hunts, regression checks, and first-aid repair loops."
  },
  {
    name: "Ship",
    code: "06",
    summary: "Prepare CI/CD, ship-readiness evidence, and release gates."
  }
] as const;

const BUILD_LANES = [
  {
    title: "Protocol Build",
    tag: "Core",
    body: "Intent-to-contract lane for production smart contracts, NatSpec, tests, and deployment prep."
  },
  {
    title: "Dapp Build",
    tag: "Frontend",
    body: "Wallet flows, dashboards, admin paths, and audit-aware UX tied to contract state."
  },
  {
    title: "Hackathon Sprint",
    tag: "Fast",
    body: "Compressed build lane for prototypes, demos, and submission-ready project packaging."
  },
  {
    title: "First Aid",
    tag: "Repair",
    body: "Reproduce, patch, verify, and prepare promotion-safe fixes instead of blind auto-edits."
  }
] as const;

export class GStackView extends LitElement {
  static override styles = css`
    :host {
      display: block;
      height: 100%;
      overflow-y: auto;
      background:
        radial-gradient(circle at top right, rgba(0, 82, 255, 0.08), transparent 28%),
        linear-gradient(180deg, #fcfcfd 0%, #ffffff 48%, #f8fafc 100%);
      color: #111827;
      font-family: "Assistant", "Inter", system-ui, sans-serif;
    }

    .shell {
      max-width: 1320px;
      margin: 0 auto;
      padding: 2rem 1.5rem 3rem;
    }

    .hero {
      border: 1px solid #e5e7eb;
      border-radius: 28px;
      padding: 2rem;
      background: rgba(255, 255, 255, 0.86);
      box-shadow: 0 20px 50px rgba(15, 23, 42, 0.06);
      backdrop-filter: blur(10px);
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 0.7rem;
      border-radius: 999px;
      background: #111827;
      color: white;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .hero-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.25fr) minmax(340px, 0.75fr);
      gap: 1.5rem;
      margin-top: 1.25rem;
    }

    .hero h1 {
      margin: 0 0 1rem 0;
      font-size: clamp(2.5rem, 5vw, 4.8rem);
      line-height: 0.95;
      letter-spacing: -0.06em;
      font-weight: 800;
    }

    .hero p {
      margin: 0;
      max-width: 760px;
      font-size: 1rem;
      line-height: 1.7;
      color: #475569;
    }

    .hero-side {
      border: 1px solid #e5e7eb;
      border-radius: 22px;
      padding: 1.25rem;
      background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);
    }

    .hero-side-title {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 0.8rem;
    }

    .hero-metric {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.9rem;
    }

    .metric {
      border: 1px solid #dbe3ef;
      border-radius: 16px;
      padding: 0.95rem;
      background: white;
    }

    .metric-value {
      font-size: 1.65rem;
      font-weight: 800;
      letter-spacing: -0.04em;
      color: #0f172a;
    }

    .metric-label {
      margin-top: 0.25rem;
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }

    .section {
      margin-top: 1.5rem;
    }

    .section-header {
      margin-bottom: 0.9rem;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #64748b;
    }

    .stage-grid,
    .lane-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
    }

    .stage-card,
    .lane-card {
      border: 1px solid #e5e7eb;
      border-radius: 22px;
      padding: 1.25rem;
      background: rgba(255, 255, 255, 0.95);
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
    }

    .stage-top,
    .lane-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 0.85rem;
    }

    .stage-code,
    .lane-tag {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 2.4rem;
      height: 2rem;
      padding: 0 0.7rem;
      border-radius: 999px;
      background: #eff6ff;
      color: #1d4ed8;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .stage-name,
    .lane-name {
      font-size: 1.1rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: #111827;
    }

    .stage-summary,
    .lane-summary {
      font-size: 14px;
      line-height: 1.7;
      color: #475569;
    }

    .ops-bar {
      margin-top: 1.5rem;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
    }

    .ops-card {
      border: 1px solid #e5e7eb;
      border-radius: 18px;
      padding: 1rem 1.1rem;
      background: #111827;
      color: white;
    }

    .ops-title {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.7);
      margin-bottom: 0.55rem;
    }

    .ops-copy {
      font-size: 13px;
      line-height: 1.6;
      color: rgba(255,255,255,0.92);
    }

    @media (max-width: 1100px) {
      .hero-grid,
      .stage-grid,
      .lane-grid,
      .ops-bar {
        grid-template-columns: 1fr;
      }
    }
  `;

  override render() {
    return html`
      <div class="shell">
        <section class="hero">
          <div class="eyebrow">SRP Build Room</div>
          <div class="hero-grid">
            <div>
              <h1>Build secure protocol. Ship full product.</h1>
              <p>
                SRP Build Room turns rough intent into contracts, NatSpec, tests, frontend flows,
                bug fixes, and ship-readiness evidence. Same factory spine as Audit Room. Different lane.
              </p>
            </div>
            <aside class="hero-side">
              <div class="hero-side-title">Build Targets</div>
              <div class="hero-metric">
                <div class="metric">
                  <div class="metric-value">6</div>
                  <div class="metric-label">native build stages from intent to ship</div>
                </div>
                <div class="metric">
                  <div class="metric-value">4</div>
                  <div class="metric-label">active lanes for protocol, dapp, hackathon, repair</div>
                </div>
                <div class="metric">
                  <div class="metric-value">NatSpec</div>
                  <div class="metric-label">contract docs and comments built into flow</div>
                </div>
                <div class="metric">
                  <div class="metric-value">CI/CD</div>
                  <div class="metric-label">delivery gates and release proof sit in room, not outside it</div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section class="section">
          <div class="section-header">Stage Flow</div>
          <div class="stage-grid">
            ${BUILD_STAGES.map((stage) => html`
              <article class="stage-card">
                <div class="stage-top">
                  <div class="stage-name">${stage.name}</div>
                  <div class="stage-code">${stage.code}</div>
                </div>
                <div class="stage-summary">${stage.summary}</div>
              </article>
            `)}
          </div>
        </section>

        <section class="section">
          <div class="section-header">Build Lanes</div>
          <div class="lane-grid">
            ${BUILD_LANES.map((lane) => html`
              <article class="lane-card">
                <div class="lane-top">
                  <div class="lane-name">${lane.title}</div>
                  <div class="lane-tag">${lane.tag}</div>
                </div>
                <div class="lane-summary">${lane.body}</div>
              </article>
            `)}
          </div>
        </section>

        <section class="ops-bar">
          <div class="ops-card">
            <div class="ops-title">Contract Lane</div>
            <div class="ops-copy">Intent, threat model, interfaces, NatSpec, tests, remediation, release notes.</div>
          </div>
          <div class="ops-card">
            <div class="ops-title">Dapp Lane</div>
            <div class="ops-copy">Wallet connect, transaction UX, admin paths, error handling, state sync, QA.</div>
          </div>
          <div class="ops-card">
            <div class="ops-title">Delivery Lane</div>
            <div class="ops-copy">Regression checks, first-aid repair loop, ship gates, rollback-aware promotion.</div>
          </div>
        </section>
      </div>
    `;
  }
}

customElements.define("gstack-view", GStackView);
