import { PhaseAgentBase, BaseAgent, type AgentContext } from "./base-agent.js";

export class PreparationAgent extends PhaseAgentBase {
  constructor() {
    super("agent_prep", "Preparation Agent", "phase-0-preparation");
  }

  async run(context: AgentContext, input: unknown): Promise<unknown> {
    console.log(`[${this.name}] Running for project ${context.projectId}...`);
    return { status: "completed", artifacts: ["scope_map", "actor_list"] };
  }
}

export class ReconAgent extends PhaseAgentBase {
  constructor() {
    super("agent_recon", "Reconnaissance Agent", "phase-1-intent");
  }

  async run(context: AgentContext, input: unknown): Promise<unknown> {
    console.log(`[${this.name}] Analyzing intent for project ${context.projectId}...`);
    return { status: "completed", artifacts: ["intent_statement"] };
  }
}

export class ArchitectureAgent extends PhaseAgentBase {
  constructor() {
    super("agent_arch", "Architecture Agent", "phase-2-architecture");
  }

  async run(context: AgentContext, input: unknown): Promise<unknown> {
    console.log(`[${this.name}] Mapping architecture for project ${context.projectId}...`);
    return { status: "completed", artifacts: ["trust_boundary_map", "value_flow_map"] };
  }
}

// ---------------------------------------------------------------------------
// Dev Agents (Phase 8)
// ---------------------------------------------------------------------------

export class NatSpecAgent extends BaseAgent {
  constructor() {
    super("agent_natspec", "NatSpec Agent");
  }

  async run(context: AgentContext, input: { file: string }): Promise<unknown> {
    console.log(`[${this.name}] Generating NatSpec for ${input.file}...`);
    return [
      {
        file: input.file,
        functionName: "transfer",
        suggestedNatSpec: "/** @notice Transfers tokens to a recipient. */",
        status: "pending"
      }
    ];
  }
}

export class TestGenerationAgent extends BaseAgent {
  constructor() {
    super("agent_testgen", "Test Generation Agent");
  }

  async run(context: AgentContext, input: { file: string; testType: string }): Promise<unknown> {
    console.log(`[${this.name}] Generating ${input.testType} tests for ${input.file}...`);
    return {
      testType: input.testType,
      file: `${input.file}.t.sol`,
      content: "// Generated test content",
      coverageGoal: "80%"
    };
  }
}

export class ExplainAgent extends BaseAgent {
  constructor() {
    super("agent_explain", "Explain Agent");
  }

  async run(context: AgentContext, input: { file: string }): Promise<unknown> {
    console.log(`[${this.name}] Explaining ${input.file}...`);
    return {
      file: input.file,
      summary: "This contract handles the core logic for the protocol.",
      details: "It uses a state machine to track the lifecycle of assets."
    };
  }
}
