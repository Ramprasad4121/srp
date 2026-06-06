import type { AuditReport, ProtocolInput, Finding } from "./types.ts";
import { buildProtocolIntent } from "./intent.ts";
import { discoverVulnerabilities } from "./discovery.ts";
import { runDynaDebate } from "./debate.ts";
import { validateFindings } from "./poc.ts";
import { stableId } from "./utils.ts";
import { AgentRegistry, OrchestrationEngine, SharedMemory } from "./agents.ts";

export type AuditEventEmitter = (event: string, data: any) => void;

export async function runAudit(input: ProtocolInput, emit?: AuditEventEmitter): Promise<AuditReport> {
  validateInput(input);
  
  const registry = new AgentRegistry();
  const memory = new SharedMemory();
  const engine = new OrchestrationEngine(registry, memory);
  
  registry.register({
    id: "intent-extractor",
    role: "intent",
    description: "Extracts architectural intent from docs/code",
    execute: (inp: ProtocolInput) => buildProtocolIntent(inp)
  });
  
  registry.register({
    id: "vuln-discovery",
    role: "discovery",
    description: "Discovers vulnerabilities via pattern matching",
    execute: (inp: ProtocolInput) => discoverVulnerabilities(inp)
  });

  registry.register({
    id: "dynadebate-engine",
    role: "debate",
    description: "Multi-round risk assessment debate",
    execute: (findings: Finding[]) => runDynaDebate(findings)
  });

  registry.register({
    id: "poc-validator",
    role: "poc",
    description: "Validates findings with PoC exploits",
    execute: (findings: Finding[]) => validateFindings(findings)
  });

  const onProgress = (agentId: string, status: string) => {
    emit?.("agent.progress", { agent: agentId, status });
  };

  const [intent] = await engine.execute("sequential", ["intent-extractor"], input, onProgress) as [any];
  const [candidates] = await engine.execute("sequential", ["vuln-discovery"], input, onProgress) as [any];
  const [debated] = await engine.execute("sequential", ["dynadebate-engine"], candidates, onProgress) as [any];
  const [validated] = await engine.execute("sequential", ["poc-validator"], debated.findings, onProgress) as [any];

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
