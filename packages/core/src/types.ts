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
}

export interface Evidence {
  file: string;
  startLine: number;
  endLine: number;
  excerpt: string;
  rationale: string;
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
  decision: "exploit_proven" | "exploit_disproven" | "threshold_reached";
}

export interface PocResult {
  findingId: string;
  classification: "proven" | "partial" | "failed";
  command: string;
  evidence: string[];
  stateAssertions: string[];
}

export interface AuditReport {
  id: string;
  protocol: ProtocolInput;
  intent: ProtocolIntent;
  findings: Finding[];
  debates: DebateTranscript[];
  pocResults: PocResult[];
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
