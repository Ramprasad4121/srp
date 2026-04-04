import type { MethodologyPhase } from "@srp/shared-types";
import type { PhaseAgent } from "./phase-agent.js";

/**
 * Registry for phase agents. Allows registration and lookup by phase.
 */
export class AgentRegistry {
  private readonly agents: Map<MethodologyPhase, PhaseAgent> = new Map();

  register(agent: PhaseAgent): void {
    this.agents.set(agent.phase, agent);
  }

  get(phase: MethodologyPhase): PhaseAgent | undefined {
    return this.agents.get(phase);
  }

  has(phase: MethodologyPhase): boolean {
    return this.agents.has(phase);
  }

  list(): readonly PhaseAgent[] {
    return Array.from(this.agents.values());
  }

  registeredPhases(): readonly MethodologyPhase[] {
    return Array.from(this.agents.keys());
  }
}
