import { LitElement, html, css } from "lit";
import { BUILD_LANES, BUILD_STAGES } from "@srp/methodology";
import type { BuildRoomProjection, RunManifest } from "@srp/shared-types";
import { gatewayClient } from "../../api/client.js";

export class GStackView extends LitElement {
  static override properties = {
    _projection: { state: true },
    _loading: { state: true },
    _error: { state: true }
  };

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

    .hero-side,
    .source-pack {
      border: 1px solid #e5e7eb;
      border-radius: 22px;
      padding: 1.25rem;
      background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);
    }

    .hero-side-title,
    .source-title,
    .section-header {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 0.8rem;
    }

    .hero-metric,
    .source-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.9rem;
    }

    .metric,
    .source-card,
    .stage-card,
    .lane-card,
    .ops-card {
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

    .metric-label,
    .source-copy,
    .stage-summary,
    .lane-summary,
    .ops-copy {
      margin-top: 0.25rem;
      font-size: 12px;
      color: #64748b;
      line-height: 1.6;
    }

    .section {
      margin-top: 1.5rem;
    }

    .stage-grid,
    .lane-grid,
    .gate-grid,
    .ops-bar {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
    }

    .ops-bar {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .stage-card,
    .lane-card {
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
    }

    .gate-card {
      border: 1px solid #dbe3ef;
      border-radius: 18px;
      padding: 1rem;
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
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
    .lane-tag,
    .stage-status {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 2.4rem;
      height: 2rem;
      padding: 0 0.7rem;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .stage-code,
    .lane-tag {
      background: #eff6ff;
      color: #1d4ed8;
    }

    .stage-status.pending {
      background: #f3f4f6;
      color: #64748b;
    }

    .stage-status.ready {
      background: #eff6ff;
      color: #1d4ed8;
    }

    .stage-status.in_progress {
      background: #fff7ed;
      color: #c2410c;
    }

    .stage-status.completed {
      background: #ecfdf5;
      color: #047857;
    }

    .stage-name,
    .lane-name,
    .source-label,
    .gate-name {
      font-size: 1.1rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: #111827;
    }

    .artifact-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
      margin-top: 0.9rem;
    }

    .artifact-chip {
      display: inline-flex;
      align-items: center;
      padding: 0.26rem 0.55rem;
      border-radius: 999px;
      background: #f3f4f6;
      color: #475569;
      font-size: 11px;
      font-weight: 700;
    }

    .gate-copy,
    .latest-copy {
      margin-top: 0.8rem;
      font-size: 12px;
      line-height: 1.6;
      color: #1d4ed8;
    }

    .ops-card {
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

    .empty-state {
      margin: 3rem auto;
      max-width: 640px;
      border: 1px dashed #cbd5e1;
      border-radius: 22px;
      padding: 2rem;
      background: rgba(255, 255, 255, 0.84);
      text-align: center;
      color: #475569;
      line-height: 1.7;
    }

    .error {
      color: #b91c1c;
    }

    @media (max-width: 1100px) {
      .hero-grid,
      .hero-metric,
      .source-grid,
      .stage-grid,
      .lane-grid,
      .gate-grid,
      .ops-bar {
        grid-template-columns: 1fr;
      }
    }
  `;

  declare _projection: BuildRoomProjection | null;
  declare _loading: boolean;
  declare _error: string | null;
  private _refreshHandle: number | null = null;

  constructor() {
    super();
    this._projection = null;
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
      const runId = runtime.runId ?? (await this.getLatestRunId());
      if (!runId) {
        this._projection = null;
        return;
      }
      this._projection = await gatewayClient.getRunBuildProjection(runId);
    } catch (error) {
      this._error = error instanceof Error ? error.message : String(error);
    } finally {
      this._loading = false;
    }
  }

  private async getLatestRunId(): Promise<string | null> {
    const runs = await gatewayClient.getRuns();
    const latestRun = [...runs].sort((left, right) => {
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    })[0] as RunManifest | undefined;
    return latestRun?.runId ?? null;
  }

  override render() {
    if (this._loading && !this._projection) {
      return html`<div class="shell"><div class="empty-state">Loading Build Room projection...</div></div>`;
    }

    if (this._error && !this._projection) {
      return html`<div class="shell"><div class="empty-state error">Build Room failed to load: ${this._error}</div></div>`;
    }

    if (!this._projection) {
      return html`
        <div class="shell">
          <div class="empty-state">
            Build Room waiting for first run.
            Start audit or synthesis once. Build lane will hydrate from persisted source pack.
          </div>
        </div>
      `;
    }

    return html`
      <div class="shell">
        <section class="hero">
          <div class="eyebrow">SRP Build Room</div>
          <div class="hero-grid">
            <div>
              <h1>Build secure protocol. Ship full product.</h1>
              <p>
                Build Room now hydrates from persisted SRP runs. Intent, architecture, diagram pack,
                and ship packet come from the same event spine as Audit Room.
              </p>
            </div>
            <aside class="hero-side">
              <div class="hero-side-title">Build Targets</div>
              <div class="hero-metric">
                <div class="metric">
                  <div class="metric-value">${this._projection.missionControl.completedStages}/${this._projection.missionControl.totalStages}</div>
                  <div class="metric-label">stages holding real persisted artifacts</div>
                </div>
                <div class="metric">
                  <div class="metric-value">${this._projection.missionControl.runStatus}</div>
                  <div class="metric-label">current run state from shared runtime spine</div>
                </div>
                <div class="metric">
                  <div class="metric-value">${this._projection.missionControl.currentStage ?? "queued"}</div>
                  <div class="metric-label">current build stage mapped from latest room output</div>
                </div>
                <div class="metric">
                  <div class="metric-value">${this._projection.missionControl.readyForBuild ? "ready" : "staging"}</div>
                  <div class="metric-label">build-ready once discover, plan, and design packs exist</div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section class="section">
          <div class="source-pack">
            <div class="source-title">Source Pack</div>
            <div class="source-grid">
              <article class="source-card">
                <div class="source-label">Intent Brief</div>
                <div class="source-copy">${this._projection.sourcePack.intentTitle}</div>
              </article>
              <article class="source-card">
                <div class="source-label">Architecture Outline</div>
                <div class="source-copy">${this._projection.sourcePack.architectureTitle}</div>
              </article>
              <article class="source-card">
                <div class="source-label">Design Pack</div>
                <div class="source-copy">${this._projection.sourcePack.designTitle}</div>
              </article>
              <article class="source-card">
                <div class="source-label">Release Packet</div>
                <div class="source-copy">${this._projection.sourcePack.releaseTitle}</div>
              </article>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="section-header">Stage Flow</div>
          <div class="stage-grid">
            ${this._projection.stages.map((stage) => html`
              <article class="stage-card">
                <div class="stage-top">
                  <div>
                    <div class="stage-name">${stage.name}</div>
                    <div class="stage-summary">${stage.summary}</div>
                  </div>
                  <div>
                    <div class="stage-code">${stage.code}</div>
                    <div class="stage-status ${stage.status}">${stage.status.replace("_", " ")}</div>
                  </div>
                </div>
                <div class="artifact-row">
                  ${stage.requiredOutputs.map((item) => html`<span class="artifact-chip">${item}</span>`)}
                </div>
                <div class="gate-copy">${stage.qualityGate}</div>
                <div class="latest-copy">
                  ${stage.artifactCount} persisted artifact${stage.artifactCount === 1 ? "" : "s"}
                  ${stage.latestArtifactTitle ? html`<br />Latest: ${stage.latestArtifactTitle}` : ""}
                </div>
              </article>
            `)}
          </div>
        </section>

        <section class="section">
          <div class="section-header">Build Lanes</div>
          <div class="lane-grid">
            ${this._projection.lanes.map((lane) => html`
              <article class="lane-card">
                <div class="lane-top">
                  <div class="lane-name">${lane.title}</div>
                  <div class="lane-tag">${lane.tag}</div>
                </div>
                <div class="lane-summary">${lane.body}</div>
                <div class="artifact-row">
                  ${lane.primaryArtifacts.map((item) => html`<span class="artifact-chip">${item}</span>`)}
                </div>
                <div class="latest-copy">
                  ${lane.artifactCount} matched artifact${lane.artifactCount === 1 ? "" : "s"}
                  ${lane.latestArtifactTitle ? html`<br />Latest: ${lane.latestArtifactTitle}` : ""}
                </div>
              </article>
            `)}
          </div>
        </section>

        <section class="section">
          <div class="section-header">First Aid + Delivery Gates</div>
          <div class="gate-grid">
            ${this._projection.deliveryGates.map((gate) => html`
              <article class="gate-card">
                <div class="stage-top">
                  <div>
                    <div class="gate-name">${gate.title}</div>
                    <div class="stage-summary">${gate.summary}</div>
                  </div>
                  <div class="stage-status ${gate.status}">${gate.status.replace("_", " ")}</div>
                </div>
                <div class="latest-copy">Evidence: ${gate.evidenceHint}</div>
              </article>
            `)}
          </div>
        </section>

        <section class="ops-bar">
          ${BUILD_STAGES.slice(0, 3).map((stage) => html`
            <div class="ops-card">
              <div class="ops-title">${stage.name}</div>
              <div class="ops-copy">${stage.qualityGate}</div>
            </div>
          `)}
        </section>

        <section class="ops-bar">
          ${BUILD_LANES.slice(0, 3).map((lane) => html`
            <div class="ops-card">
              <div class="ops-title">${lane.title}</div>
              <div class="ops-copy">${lane.body}</div>
            </div>
          `)}
        </section>
      </div>
    `;
  }
}

customElements.define("gstack-view", GStackView);
