export type Chain =
  | "ethereum"
  | "arbitrum"
  | "optimism"
  | "base"
  | "polygon"
  | "avalanche"
  | "solana";

export type Severity = "critical" | "high" | "medium" | "low" | "informational";

export type ConfidenceBand = "low" | "medium" | "high" | "verified";

export interface ProtocolDocument {
  path: string;
  kind: "README" | "WHITEPAPER" | "DOCS" | "GOVERNANCE" | "NATSPEC" | "SOURCE";
  content: string;
}

export interface SourceFile {
  path: string;
  language: "solidity" | "rust" | "move" | "typescript" | "markdown" | "unknown";
  content: string;
}

export interface ProtocolInput {
  name: string;
  chain: Chain;
  documents: ProtocolDocument[];
  sources: SourceFile[];
  /** Locally executed PoC or test results to attach to findings. */
  proofs?: ProofRecord[];
}

export type EvidenceKind = "observed" | "derived" | "inferred";

export interface Evidence {
  /** sha256-derived id over file, lines, excerpt, provider, and operation. Same claim, same id. */
  evidenceId?: string;
  file: string;
  startLine: number;
  endLine: number;
  /** Raw source text of the cited lines (trimmed, capped at 240 chars). */
  excerpt: string;
  rationale: string;
  /** Which analyzer produced the record, e.g. "srp-structural" or "srp-pattern". */
  provider?: string;
  /** The detector or step that made the observation. */
  operation?: string;
  /** observed: text matched in source. derived: concluded from several observations. inferred: a guess a human must check. */
  kind?: EvidenceKind;
}

/** Something SRP could not analyze. Silence is not safety, so gaps are reported. */
export interface ResidualUnknown {
  unknownId: string;
  file: string;
  question: string;
  reason: string;
  severity: "low" | "medium" | "high";
}

export interface Coverage {
  /** Source files given to the audit. */
  files: number;
  /** Files at least one analyzer could parse. */
  analyzedFiles: number;
  /** Functions or instructions the structural analyzers indexed. */
  functions: number;
  /** analyzedFiles / files, 0 to 1. */
  ratio: number;
  analyzers: string[];
}

export interface FindingContext {
  function?: string;
  visibility?: string;
  modifiers?: string[];
  /** Structural facts the detector established, each citing a line. Debate argues over these. */
  facts: string[];
}

/** A result from running a PoC or test locally, attached to a finding. The only way a finding becomes proven. */
export interface ProofRecord {
  findingId: string;
  command: string;
  passed: boolean;
  /** What the test asserted, e.g. "attacker balance grows by 10 ETH". */
  assertion: string;
  output?: string;
  recordedAt?: string;
}

export interface ProtocolIntent {
  assumptions: string[];
  securityGuarantees: string[];
  trustBoundaries: string[];
  attackSurfaces: string[];
  invariants: string[];
  knowledgeGraph: KnowledgeGraph;
  threatModel: ThreatModel;
}

export interface KnowledgeGraph {
  nodes: Array<{ id: string; type: string; label: string }>;
  edges: Array<{ from: string; to: string; relation: string }>;
}

export interface ThreatModel {
  assets: string[];
  actors: string[];
  entrypoints: string[];
  abuseCases: string[];
}

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  impact: string;
  likelihood: string;
  attackPath: string[];
  exploitability: string;
  proofOfConcept: string;
  remediation: string;
  confidence: number;
  confidenceBand: ConfidenceBand;
  evidence: Evidence[];
  status: "candidate" | "debated" | "proven" | "partial" | "failed";
  detector: string;
  mitigations?: string[];
  context?: FindingContext;
  /** Severity the detector proposed before validation policy was applied. */
  proposedSeverity?: Severity;
}

export interface DebateTranscript {
  findingId: string;
  rounds: Array<{
    attacker: string;
    defender: string;
    judge: string;
    confidenceDelta: number;
  }>;
  finalConfidence: number;
  decision: "exploit_proven" | "exploit_disproven" | "threshold_reached" | "inconclusive";
}

export interface PocResult {
  findingId: string;
  classification: "proven" | "partial" | "failed";
  /** False unless a real PoC or test run was attached via proofs. */
  executed: boolean;
  /** Generated Foundry or program-test harness to run locally, when SRP can write one. */
  harness?: string;
  command: string;
  evidence: string[];
  stateAssertions: string[];
}

export interface AuditReport {
  /** Bumped on any breaking change to this shape. Agents should check it. */
  schemaVersion: "srp.audit/v1";
  id: string;
  protocol: ProtocolInput;
  intent: ProtocolIntent;
  findings: Finding[];
  debates: DebateTranscript[];
  pocResults: PocResult[];
  unknowns: ResidualUnknown[];
  coverage: Coverage;
  generatedAt: string;
}

export interface RuntimeSignal {
  protocol: string;
  chain: Chain;
  source: "mempool" | "governance" | "treasury" | "liquidity" | "bridge" | "staking" | "invariant";
  metric: string;
  value: number;
  threshold: number;
}

export interface Incident {
  id: string;
  protocol: string;
  severity: Severity;
  title: string;
  evidence: string[];
  createdAt: string;
  status: "open" | "acknowledged" | "resolved";
}
