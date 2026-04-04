import { PhaseAgentBase, BaseAgent, type AgentContext } from "./base-agent.js";

/**
 * Redefined agents for the Discovery-First Intelligence Engine.
 */

export class DiscoveryAgent extends PhaseAgentBase {
  constructor(domain: string, phase: any) {
    super(`discovery_${domain}`, `Discovery Agent: ${domain}`, phase);
  }

  async run(context: AgentContext, input: any): Promise<unknown> {
    console.log(`[${this.name}] Executing discovery...`);
    return {
      artifacts: [],
      totalSources: 0
    };
  }
}

export class SynthesisAgent extends PhaseAgentBase {
  constructor(id: string, name: string, phase: any) {
    super(id, name, phase);
  }

  async run(context: AgentContext, input: any): Promise<unknown> {
    console.log(`[${this.name}] Synthesizing intelligence...`);
    return {
      draftSummary: "Discovery-based synthesis",
      mainContracts: [],
      interfaceCount: 0
    };
  }
}

export class VisualAgent extends PhaseAgentBase {
  constructor() {
    super("agent_visual", "Visual Flow Agent", "visual-flow-map");
  }

  async run(context: AgentContext, input: any): Promise<unknown> {
    console.log(`[${this.name}] Generating protocol flow map...`);
    return {
      type: "excalidraw",
      version: 2,
      elements: []
    };
  }
}

// ---------------------------------------------------------------------------
// Dev Agents
// ---------------------------------------------------------------------------

export class NatSpecAgent extends BaseAgent {
  constructor() {
    super("agent_natspec", "NatSpec Agent");
  }

  async run(context: AgentContext, input: { file: string }): Promise<unknown> {
    return [];
  }
}

export class TestGenerationAgent extends BaseAgent {
  constructor() {
    super("agent_testgen", "Test Generation Agent");
  }

  async run(context: AgentContext, input: { file: string; testType: string }): Promise<unknown> {
    return {};
  }
}

export class ExplainAgent extends BaseAgent {
  constructor() {
    super("agent_explain", "Explain Agent");
  }

  async run(context: AgentContext, input: { file: string }): Promise<unknown> {
    return {};
  }
}
