# SRP Configuration Setup Plan
user run this command `srp configure` then following should happen

## 1. Goal

SRP should have a first-time setup experience like OpenClaw.

The user should not feel like they are manually wiring random environment variables and guessing what to do.

SRP should feel like:

- a real product
- guided
- clear
- role-aware
- provider-aware
- mode-aware

This setup flow must work for:

- auditors
- developers
- solo users
- team users later

And it must be visible in the localhost UI.

## 2. Rename/Scope Decision

This file replaces the narrower idea of only a multi-provider API key plan.

That was too small.

The real need is a full **configuration setup plan** covering:

- first-time onboarding
- provider setup
- project setup
- mode selection
- role-specific defaults
- localhost UI setup experience

## 3. Core Product Decision

SRP should require a **first-time setup flow** before serious usage.

Not because setup is fun.

Because SRP is a serious system and needs to know:

- who the user is
- what they want to do
- what providers they have
- what models to use
- what tools are available
- whether they are using SRP for audit or dev or both
- what kind of projects they work on

## 4. What SRP Setup Should Feel Like

It should feel like:

- OpenClaw-style guided onboarding
- but specialized for smart contract security and development

The user should feel:

- “SRP understood my role”
- “SRP knows my tooling”
- “SRP is ready for my projects”

Not:

- “I guess I need to export some env vars and pray”

## 5. The Two Major User Modes

SRP should understand two primary modes from setup:

## 5.1 Auditor mode

This is for users who mainly want:

- audits
- findings
- invariants
- exploit paths
- PoCs
- methodology workbench

## 5.2 Developer mode

This is for users who mainly want:

- NatSpec
- docs
- comments
- contract generation
- test generation
- architecture help
- code review before audit

## 5.3 Hybrid mode

Many users will want both.

SRP should support:

- `Auditor`
- `Developer`
- `Both`

This should be one of the first onboarding decisions.

## 6. First-Time Setup Flow

SRP setup should be a guided wizard with these steps.

## Step 1: Welcome and mode selection

Ask:

- are you an auditor, developer, or both?
- what kind of protocols do you work on most?

Choices:

- Auditor
- Developer
- Both

Protocol focus examples:

- AMM
- lending
- bridge
- staking
- governance
- perpetuals
- general EVM

### Why this matters

It lets SRP:

- choose default skills
- choose default UI layout
- choose default model routing
- choose default commands

## Step 2: Provider and model setup

This should borrow from OpenClaw’s provider setup pattern.

The user should be able to:

- add provider
- choose auth method
- enter credential
- test provider
- choose default models
- assign models by task class
- define fallback order

Supported providers should include:

- NVIDIA
- Anthropic
- OpenAI
- OpenRouter
- Hugging Face
- Ollama
- LiteLLM
- self-hosted OpenAI-compatible endpoints

## Step 3: Toolchain detection

SRP should detect:

- Foundry
- Anvil
- Hardhat
- Slither
- Aderyn
- Echidna
- Docker

And show:

- installed
- missing
- optional
- recommended

## Step 4: Workspace and project defaults

Ask or detect:

- default projects directory
- where SRP stores outputs
- whether to use Dockerized toolchains
- whether to use read-only target mounts by default

## Step 5: Skill setup

The user should see:

- bundled skills
- recommended skills based on role and protocol focus
- enabled default skills

And they should be able to:

- accept defaults
- customize

## Step 6: UI setup

Let the user choose:

- default mode
  - auditor workbench
  - developer workbench
  - balanced
- theme
- teaching mode on/off
- dense/comfortable layout

## Step 7: Final health check

Before finishing, SRP should run:

- provider check
- toolchain check
- workspace check
- sample request check

Then show:

- ready
- warnings
- missing setup items

## 7. Localhost UI Setup Experience

The first-time setup should be fully available in localhost UI.

Recommended top-level screens:

- `Welcome`
- `Choose Role`
- `Models & Providers`
- `Toolchain Check`
- `Skills`
- `Workspace`
- `UI Preferences`
- `Ready`

## 8. How SRP Should Present Itself To Auditors vs Developers

This is important.

SRP should not show the same homepage to everyone.

## 8.1 Auditor homepage

Show:

- Audit Flow
- Protocol Map
- Invariants
- Hypotheses
- Findings
- PoCs

## 8.2 Developer homepage

Show:

- Dev Tasks
- Codebase Docs
- NatSpec
- Test Generation
- Contract Builder
- Review

## 8.3 Hybrid homepage

Show:

- recent projects
- audit tasks
- dev tasks
- findings in progress
- generated docs/tests in progress

## 9. Recommended Setup Outputs

When setup completes, SRP should produce a config snapshot that stores:

- selected role mode
- provider profiles
- model routing
- workspace paths
- toolchain availability
- enabled skills
- UI defaults

## 10. Recommended Config Categories

SRP config should be grouped like this:

### User config

- role mode
- UI preferences
- preferred models

### Provider config

- provider profiles
- auth methods
- fallback chains

### Toolchain config

- Foundry
- Hardhat
- Slither
- Aderyn
- Docker usage

### Skills config

- enabled skills
- disabled skills
- recommended skills

### Workspace config

- output paths
- cache paths
- default projects

## 11. Recommended Localhost UI Sections After Setup

Once setup is complete, localhost UI should have:

- `Overview`
- `Audit`
- `Dev`
- `Skills`
- `Models & Providers`
- `Toolchain`
- `Projects`
- `Settings`

This gives the user a clear mental model.

## 12. Recommended UX For Role-Specific Presentation

## Auditor presentation

Language should emphasize:

- scope
- invariants
- hypotheses
- findings
- proof
- report

## Developer presentation

Language should emphasize:

- write
- explain
- document
- test
- review
- improve

This matters a lot.

## 13. Final Recommendation

SRP should absolutely have a first-time setup flow like OpenClaw.

The setup system should:

1. identify whether the user is an auditor, developer, or both
2. configure providers and models
3. check toolchains
4. set up skills
5. set up workspace defaults
6. choose the right localhost UI presentation mode

That is the right setup/configuration direction for SRP.

