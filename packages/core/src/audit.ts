import type { AuditReport, ProtocolInput } from "./types.ts";
import { buildProtocolIntent } from "./intent.ts";
import { discoverVulnerabilities } from "./discovery.ts";
import { runDynaDebate } from "./debate.ts";
import { validateFindings } from "./poc.ts";
import { stableId } from "./utils.ts";

export function runAudit(input: ProtocolInput): AuditReport {
  validateInput(input);
  const intent = buildProtocolIntent(input);
  const candidates = discoverVulnerabilities(input);
  const debated = runDynaDebate(candidates);
  const validated = validateFindings(debated.findings);
  return {
    id: stableId("audit", `${input.name}:${input.chain}:${Date.now()}:${input.sources.length}`),
    protocol: input,
    intent,
    findings: validated.findings,
    debates: debated.debates,
    pocResults: validated.pocResults,
    generatedAt: new Date().toISOString()
  };
}

function validateInput(input: ProtocolInput): void {
  if (!input.name.trim()) throw new Error("Protocol name is required");
  if (!input.sources.length && !input.documents.length) throw new Error("At least one document or source file is required");
  for (const source of input.sources) {
    if (!source.path.trim()) throw new Error("Source path is required");
    if (!source.content.trim()) throw new Error(`Source content is empty for ${source.path}`);
  }
}
