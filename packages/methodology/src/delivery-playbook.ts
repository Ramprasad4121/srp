export interface DeliveryGateDefinition {
  readonly id: "repro" | "patch" | "regression" | "approval" | "release";
  readonly title: string;
  readonly summary: string;
  readonly evidenceHint: string;
}

export const DELIVERY_GATES: readonly DeliveryGateDefinition[] = [
  {
    id: "repro",
    title: "Reproduce",
    summary: "Pin failure before touching code so First Aid has a concrete target.",
    evidenceHint: "finding or hypothesis trail"
  },
  {
    id: "patch",
    title: "Patch",
    summary: "Draft the repair or implementation delta with explicit artifact output.",
    evidenceHint: "test or implementation artifact"
  },
  {
    id: "regression",
    title: "Regression",
    summary: "Run checks that prove the patch did not just move the bug elsewhere.",
    evidenceHint: "verification test evidence"
  },
  {
    id: "approval",
    title: "Approval",
    summary: "Surface a review lane before merge or release promotion.",
    evidenceHint: "finding review or report packet"
  },
  {
    id: "release",
    title: "Release",
    summary: "Ship only with rollback-aware notes and final promotion proof.",
    evidenceHint: "report or release packet"
  }
] as const;
