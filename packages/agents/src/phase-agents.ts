import { PhaseAgentBase, BaseAgent, type AgentContext } from "./base-agent.js";

/**
 * Phase 0: Pre-Audit Preparation Agent
 */
export class PreparationAgent extends PhaseAgentBase {
  constructor() {
    super("agent_prep", "Preparation Agent", "phase-0-preparation");
  }

  async run(context: AgentContext, input: unknown): Promise<unknown> {
    console.log(`[${this.name}] Analyzing project structure and core value prop...`);
    return {
      valueProposition: "Protocol-specific core promise",
      moneyFlow: "Money-in and money-out pathways",
      adversarialActors: ["External Attacker", "Malicious Admin", "MEV Bot"],
      worstCaseOutcome: "Total loss of funds",
      initialThreatModel: "Initial high-level threat landscape"
    };
  }
}

/**
 * Phase 1: Reconnaissance Agent
 */
export class ReconAgent extends PhaseAgentBase {
  constructor() {
    super("agent_recon", "Reconnaissance Agent", "phase-1-recon");
  }

  async run(context: AgentContext, input: unknown): Promise<unknown> {
    console.log(`[${this.name}] Gathering external signals and security guarantees...`);
    return {
      sources: ["README.md", "Docs", "Previous Audits"],
      securityGuarantees: ["Users can always withdraw", "No single-block manipulation"],
      candidateInvariants: ["sum(balances) <= totalAssets"]
    };
  }
}

/**
 * Phase 2: Architecture Agent
 */
export class ArchitectureAgent extends PhaseAgentBase {
  constructor() {
    super("agent_arch", "Architecture Agent", "phase-2-architecture");
  }

  async run(context: AgentContext, input: unknown): Promise<unknown> {
    console.log(`[${this.name}] Mapping trust boundaries and value flows...`);
    return {
      summary: "Architecture Overview",
      trustBoundaries: ["Chainlink", "Uniswap V3"],
      valueFlows: ["Entry: deposit", "Exit: withdraw"],
      stateVariables: ["balances", "totalDeposited"]
    };
  }
}

/**
 * Phase 3: Invariant Agent
 */
export class InvariantAgent extends PhaseAgentBase {
  constructor() {
    super("agent_invariants", "Invariant Agent", "phase-3-invariants");
  }

  async run(context: AgentContext, input: unknown): Promise<unknown> {
    console.log(`[${this.name}] Extracting global, function, and economic invariants...`);
    return {
      invariants: [
        { id: "G-01", title: "Solvency", category: "Global" },
        { id: "F-01", title: "Withdraw consistency", category: "Function" },
        { id: "E-01", title: "No free profit", category: "Economic" }
      ]
    };
  }
}

/**
 * Phase 4: Hypothesis Agent
 */
export class HypothesisAgent extends PhaseAgentBase {
  constructor() {
    super("agent_hypothesis", "Hypothesis Agent", "phase-4-hypotheses");
  }

  async run(context: AgentContext, input: unknown): Promise<unknown> {
    console.log(`[${this.name}] Generating specific attack hypotheses...`);
    return {
      hypotheses: [
        { id: "HYP-001", who: "Attacker", action: "Drain", method: "Reentrancy", impact: "High" }
      ]
    };
  }
}

/**
 * Phase 5: Code Reading Agent
 */
export class CodeReadingAgent extends PhaseAgentBase {
  constructor() {
    super("agent_reading", "Code Reading Agent", "phase-5-code-reading");
  }

  async run(context: AgentContext, input: unknown): Promise<unknown> {
    console.log(`[${this.name}] Performing non-linear code reading and annotation...`);
    return {
      annotations: [
        { function: "liquidate", access: "external", stateChanges: ["balanceUpdate"] }
      ]
    };
  }
}

/**
 * Phase 6: Note Agent
 */
export class NoteAgent extends PhaseAgentBase {
  constructor() {
    super("agent_notes", "Note Agent", "phase-6-notes");
  }

  async run(context: AgentContext, input: unknown): Promise<unknown> {
    console.log(`[${this.name}] Managing question logs and evidence...`);
    return {
      questions: [
        { id: "Q-001", text: "Why is totalVested calculated twice?", status: "pending" }
      ]
    };
  }
}

/**
 * Phase 7: Simulation Agent
 */
export class SimulationAgent extends PhaseAgentBase {
  constructor() {
    super("agent_simulation", "Simulation Agent", "phase-7-simulations");
  }

  async run(context: AgentContext, input: unknown): Promise<unknown> {
    console.log(`[${this.name}] Running 'What-If' simulations...`);
    return {
      findings: [
        { title: "Input control risk in transfer", severity: "Medium" }
      ]
    };
  }
}

/**
 * Phase 8: Interaction Agent
 */
export class InteractionAgent extends PhaseAgentBase {
  constructor() {
    super("agent_interaction", "Interaction Agent", "phase-8-interaction-matrix");
  }

  async run(context: AgentContext, input: unknown): Promise<unknown> {
    console.log(`[${this.name}] Computing interaction matrix...`);
    return {
      matrix: [
        { from: "Core", to: "Vault", type: "write" }
      ]
    };
  }
}

/**
 * Phase 9: Economic Agent
 */
export class EconomicAgent extends PhaseAgentBase {
  constructor() {
    super("agent_economic", "Economic Agent", "phase-9-economic-modeling");
  }

  async run(context: AgentContext, input: unknown): Promise<unknown> {
    console.log(`[${this.name}] Modeling economic and flash loan risks...`);
    return {
      scenarios: [
        { id: "ECO-01", title: "Oracle price manipulation", profitability: "High" }
      ]
    };
  }
}

/**
 * Phase 10: Cross-Contract Agent
 */
export class CrossContractAgent extends PhaseAgentBase {
  constructor() {
    super("agent_cross", "Cross-Contract Agent", "phase-10-cross-contract-paths");
  }

  async run(context: AgentContext, input: unknown): Promise<unknown> {
    console.log(`[${this.name}] Analyzing call chains and callbacks...`);
    return {
      paths: [
        { id: "PATH-01", sequence: "A -> B -> Callback -> A" }
      ]
    };
  }
}

/**
 * Phase 11: Report Agent
 */
export class ReportAgent extends PhaseAgentBase {
  constructor() {
    super("agent_report", "Report Agent", "phase-11-reporting");
  }

  async run(context: AgentContext, input: unknown): Promise<unknown> {
    console.log(`[${this.name}] Compiling formal audit report...`);
    return {
      reportId: "REP-001",
      content: "# Security Audit Report"
    };
  }
}

/**
 * Phase 12: Remediation Agent
 */
export class RemediationAgent extends PhaseAgentBase {
  constructor() {
    super("agent_remediation", "Remediation Agent", "phase-12-remediation");
  }

  async run(context: AgentContext, input: unknown): Promise<unknown> {
    console.log(`[${this.name}] Creating remediation roadmap...`);
    return {
      roadmap: [
        { action: "Apply CEI in Vault.withdraw", priority: "High" }
      ]
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
