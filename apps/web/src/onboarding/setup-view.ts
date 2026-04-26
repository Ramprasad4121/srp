import { LitElement, css, html } from "lit";

import type { Department, SetupIdentity, UserGoal, UserProfile } from "@srp/shared-types";

import { gatewayClient } from "../api/client.js";

const PROFILE_OPTIONS: ReadonlyArray<{
  readonly value: UserProfile;
  readonly title: string;
  readonly hint: string;
}> = [
  { value: "builder", title: "Builder", hint: "Turning Web3 ideas into working product slices." },
  { value: "auditor", title: "Auditor", hint: "Driving verification, findings, and evidence." },
  { value: "founder", title: "Founder", hint: "Coordinating the whole company workflow." },
  { value: "learner", title: "Learner", hint: "Using the teaching desk to get oriented quickly." }
];

const GOAL_OPTIONS: ReadonlyArray<{
  readonly value: UserGoal;
  readonly title: string;
  readonly hint: string;
}> = [
  { value: "learn", title: "Learn", hint: "Start with guided context and examples." },
  { value: "build", title: "Build", hint: "Focus on shipping a dapp or protocol artifact." },
  { value: "audit", title: "Audit", hint: "Jump into review, risk mapping, and evidence." }
];

const DEPARTMENT_OPTIONS: ReadonlyArray<{
  readonly value: Department;
  readonly title: string;
  readonly hint: string;
}> = [
  { value: "teaching", title: "Teaching", hint: "Explain the work, terms, and next moves." },
  { value: "build", title: "Build", hint: "Turn intent into implementation and QA." },
  { value: "audit", title: "Audit", hint: "Inspect contracts, risks, and reports." }
];

export class SetupView extends LitElement {
  static override properties = {
    _identity: { state: true },
    _step: { state: true }
  };

  static override styles = css`
    :host {
      display: block;
      max-width: 920px;
      margin: 4rem auto;
      padding: 2rem;
      background: #111318;
      border: 1px solid #262a33;
      border-radius: 12px;
    }

    h1 {
      color: #00f5a0;
      margin-bottom: 0.5rem;
    }

    p {
      color: #c9d1dd;
    }

    .group {
      margin-top: 2rem;
    }

    .group-label {
      font-size: 0.8rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #7e8796;
      margin-bottom: 0.75rem;
    }

    .options {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }

    .option-card {
      padding: 1rem;
      background: #1a1d23;
      border: 1px solid #262a33;
      border-radius: 8px;
      cursor: pointer;
      transition: border-color 0.2s ease, transform 0.2s ease;
    }

    .option-card:hover {
      border-color: #00f5a0;
      transform: translateY(-1px);
    }

    .option-card.selected {
      border-color: #00f5a0;
      background: linear-gradient(180deg, #123228 0%, #0f1d18 100%);
    }

    .option-title {
      display: block;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }

    .option-hint {
      font-size: 0.92rem;
      color: #9aa3b2;
    }

    .summary {
      margin-top: 2rem;
      padding: 1rem;
      border-radius: 8px;
      background: #0d1014;
      border: 1px solid #262a33;
      color: #d9fbe9;
    }

    .btn-primary {
      margin-top: 1.5rem;
      width: 100%;
      background: #00f5a0;
      color: #08090a;
      border: none;
      padding: 1rem 2rem;
      border-radius: 8px;
      font-weight: 700;
      cursor: pointer;
      font-size: 1rem;
    }
  `;

  declare _identity: SetupIdentity;
  declare _step: number;

  constructor() {
    super();
    this._identity = {
      userProfile: "builder",
      goal: "build",
      department: "build"
    };
    this._step = 1;
  }

  override render() {
    return html`
      <h1>SRP Company Onboarding</h1>
      <p>Pick the person entering the system, the job they need done, and the department that should lead first.</p>

      ${this._step === 1 ? this.renderIdentityStep() : this.renderFinalStep()}
    `;
  }

  private renderIdentityStep() {
    return html`
      ${this.renderGroup("User Profile", PROFILE_OPTIONS, this._identity.userProfile, (value) => {
        this._identity = { ...this._identity, userProfile: value as UserProfile };
      })}
      ${this.renderGroup("Goal", GOAL_OPTIONS, this._identity.goal, (value) => {
        this._identity = { ...this._identity, goal: value as UserGoal };
      })}
      ${this.renderGroup("Department", DEPARTMENT_OPTIONS, this._identity.department, (value) => {
        this._identity = { ...this._identity, department: value as Department };
      })}

      <div class="summary">
        Active journey: <strong>${this._identity.userProfile}</strong> entering for
        <strong>${this._identity.goal}</strong>, led by <strong>${this._identity.department}</strong>.
      </div>

      <button class="btn-primary" @click=${this.saveIdentity}>Continue</button>
    `;
  }

  private renderGroup(
    label: string,
    options: ReadonlyArray<{ readonly value: string; readonly title: string; readonly hint: string }>,
    selected: string,
    onSelect: (value: string) => void
  ) {
    return html`
      <div class="group">
        <div class="group-label">${label}</div>
        <div class="options">
          ${options.map((option) => html`
            <div
              class="option-card ${selected === option.value ? "selected" : ""}"
              @click=${() => onSelect(option.value)}
            >
              <span class="option-title">${option.title}</span>
              <span class="option-hint">${option.hint}</span>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  private renderFinalStep() {
    return html`
      <div class="summary">
        The workspace is now keyed to <strong>${this._identity.department}</strong> with a
        <strong>${this._identity.goal}</strong> goal. Provider keys and workspace settings can still be refined in setup.
      </div>
      <button class="btn-primary" @click=${() => (window.location.href = "/")}>Back to Dashboard</button>
    `;
  }

  private async saveIdentity() {
    const result = await gatewayClient.setIdentity(this._identity);
    if (!result.ok) {
      alert(`Failed to save identity: ${result.error}`);
      return;
    }

    try {
      await gatewayClient.startRuntime();
      this._step = 2;
    } catch (err) {
      alert(`Failed to start runtime: ${err}`);
    }
  }
}

customElements.define("setup-view", SetupView);
