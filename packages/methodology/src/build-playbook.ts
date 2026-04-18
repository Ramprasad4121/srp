export type BuildStageId = "discover" | "plan" | "design" | "build" | "qa" | "ship";

export interface BuildStageDefinition {
  readonly id: BuildStageId;
  readonly code: string;
  readonly name: string;
  readonly summary: string;
  readonly requiredOutputs: readonly string[];
  readonly qualityGate: string;
}

export interface BuildLaneDefinition {
  readonly id: "protocol" | "dapp" | "hackathon" | "first-aid";
  readonly title: string;
  readonly tag: string;
  readonly body: string;
  readonly primaryArtifacts: readonly string[];
}

export const BUILD_STAGES: readonly BuildStageDefinition[] = [
  {
    id: "discover",
    code: "01",
    name: "Discover",
    summary: "Turn rough intent into scope, threat model, and concrete success criteria.",
    requiredOutputs: ["intent brief", "threat model", "success criteria"],
    qualityGate: "Scope and trust boundary understood before design starts."
  },
  {
    id: "plan",
    code: "02",
    name: "Plan",
    summary: "Lock architecture, contracts, frontend slices, and delivery checkpoints.",
    requiredOutputs: ["architecture outline", "contract slice plan", "delivery checkpoints"],
    qualityGate: "Major modules, risks, and dependencies accounted for."
  },
  {
    id: "design",
    code: "03",
    name: "Design",
    summary: "Prepare contract interfaces, NatSpec structure, UX flow, and system diagrams.",
    requiredOutputs: ["interface draft", "NatSpec plan", "UX flow", "system diagram"],
    qualityGate: "Interfaces and product flow stable enough for implementation."
  },
  {
    id: "build",
    code: "04",
    name: "Build",
    summary: "Generate contracts, docs, tests, and dapp slices with secure defaults.",
    requiredOutputs: ["contracts", "NatSpec", "docs", "tests", "frontend slices"],
    qualityGate: "Implementation exists with baseline tests and documentation."
  },
  {
    id: "qa",
    code: "05",
    name: "QA",
    summary: "Run bug hunts, regression checks, and first-aid repair loops.",
    requiredOutputs: ["bug list", "regression evidence", "repair patches"],
    qualityGate: "Known critical issues resolved or explicitly blocked."
  },
  {
    id: "ship",
    code: "06",
    name: "Ship",
    summary: "Prepare CI/CD, ship-readiness evidence, and release gates.",
    requiredOutputs: ["ship checklist", "CI evidence", "release notes", "rollback notes"],
    qualityGate: "Release gate passed with rollback-aware delivery proof."
  }
] as const;

export const BUILD_LANES: readonly BuildLaneDefinition[] = [
  {
    id: "protocol",
    title: "Protocol Build",
    tag: "Core",
    body: "Intent-to-contract lane for production smart contracts, NatSpec, tests, and deployment prep.",
    primaryArtifacts: ["contracts", "NatSpec", "tests", "deployment plan"]
  },
  {
    id: "dapp",
    title: "Dapp Build",
    tag: "Frontend",
    body: "Wallet flows, dashboards, admin paths, and audit-aware UX tied to contract state.",
    primaryArtifacts: ["wallet UX", "dashboard views", "admin screens", "state sync checks"]
  },
  {
    id: "hackathon",
    title: "Hackathon Sprint",
    tag: "Fast",
    body: "Compressed build lane for prototypes, demos, and submission-ready project packaging.",
    primaryArtifacts: ["demo scope", "submission checklist", "pitch-ready build"]
  },
  {
    id: "first-aid",
    title: "First Aid",
    tag: "Repair",
    body: "Reproduce, patch, verify, and prepare promotion-safe fixes instead of blind auto-edits.",
    primaryArtifacts: ["repro steps", "patch", "verification logs", "promotion notes"]
  }
] as const;
