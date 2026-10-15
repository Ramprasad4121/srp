import { createHash } from "node:crypto";
import type { AuditReport, Evidence, Finding, ResidualUnknown, Coverage } from "./types.ts";
import { DETECTORS } from "./catalog.ts";
import { SRP_VERSION } from "./capabilities.ts";

export interface EvidenceBundle {
  schemaVersion: "srp.evidence-bundle/v1";
  auditId: string;
  protocol: string;
  chain: string;
  generatedAt: string;
  findings: Array<Pick<Finding, "id" | "title" | "detector" | "severity" | "proposedSeverity" | "status" | "confidence"> & { evidence: Evidence[]; facts: string[] }>;
  unknowns: ResidualUnknown[];
  coverage: Coverage;
  /** sha256 over the canonical JSON of everything above. Import rejects a bundle whose digest does not match. */
  digest: string;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>).sort().filter((key) => (value as Record<string, unknown>)[key] !== undefined).map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function exportEvidenceBundle(report: AuditReport): EvidenceBundle {
  const body = {
    schemaVersion: "srp.evidence-bundle/v1" as const,
    auditId: report.id,
    protocol: report.protocol.name,
    chain: report.protocol.chain,
    generatedAt: report.generatedAt,
    findings: report.findings.map((finding) => ({
      id: finding.id,
      title: finding.title,
      detector: finding.detector,
      severity: finding.severity,
      proposedSeverity: finding.proposedSeverity,
      status: finding.status,
      confidence: finding.confidence,
      evidence: finding.evidence,
      facts: finding.context?.facts ?? []
    })),
    unknowns: report.unknowns ?? [],
    coverage: report.coverage
  };
  return { ...body, digest: createHash("sha256").update(canonical(body)).digest("hex") };
}

/** Validates a bundle (schema and digest) and returns it, or throws with the reason. */
export function verifyEvidenceBundle(input: unknown): EvidenceBundle {
  const bundle = input as EvidenceBundle;
  if (!bundle || bundle.schemaVersion !== "srp.evidence-bundle/v1") throw new Error("Not an srp.evidence-bundle/v1 document");
  if (!Array.isArray(bundle.findings) || !Array.isArray(bundle.unknowns)) throw new Error("Bundle is missing findings or unknowns");
  const { digest, ...body } = bundle;
  const expected = createHash("sha256").update(canonical(body)).digest("hex");
  if (digest !== expected) throw new Error("Bundle digest does not match its content");
  return bundle;
}

const SARIF_LEVEL: Record<string, "error" | "warning" | "note"> = { critical: "error", high: "error", medium: "warning", low: "note", informational: "note" };

/** SARIF 2.1.0 for GitHub code scanning. Level follows proposedSeverity so unproven criticals are not hidden. */
export function toSarif(report: AuditReport): object {
  const used = new Set(report.findings.map((finding) => finding.detector));
  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [{
      tool: {
        driver: {
          name: "SRP",
          informationUri: "https://github.com/Ramprasad4121/srp",
          version: SRP_VERSION,
          rules: DETECTORS.filter((detector) => used.has(detector.id)).map((detector) => ({
            id: detector.id,
            shortDescription: { text: detector.summary },
            properties: { analyzer: detector.analyzer, "security-severity": { critical: "9.5", high: "8.0", medium: "5.5", low: "3.0" }[detector.severity] ?? "5.0" }
          }))
        }
      },
      results: report.findings.map((finding) => ({
        ruleId: finding.detector,
        level: SARIF_LEVEL[finding.proposedSeverity ?? finding.severity] ?? "warning",
        message: { text: `${finding.title}. ${finding.remediation} (status: ${finding.status}, confidence ${finding.confidence})` },
        locations: finding.evidence.slice(0, 1).map((evidence) => ({
          physicalLocation: { artifactLocation: { uri: evidence.file }, region: { startLine: evidence.startLine, endLine: evidence.endLine } }
        })),
        relatedLocations: finding.evidence.slice(1).map((evidence, index) => ({
          id: index + 1,
          message: { text: evidence.rationale },
          physicalLocation: { artifactLocation: { uri: evidence.file }, region: { startLine: evidence.startLine, endLine: evidence.endLine } }
        })),
        partialFingerprints: { srpFindingId: finding.id }
      }))
    }]
  };
}
