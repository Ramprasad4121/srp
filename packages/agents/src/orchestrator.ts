import type { MethodologyPhase } from "@srp/shared-types";
import { METHODOLOGY_PHASES, areDependenciesMet } from "@srp/methodology";
import type { PhaseAgent, PhaseAgentContext, PhaseAgentResult, PhaseArtifactOutput } from "./phase-agent.js";
import { AgentRegistry } from "./agent-registry.js";

/**
 * Orchestration result from a full audit run.
 */
export interface OrchestratorRunResult {
  readonly success: boolean;
  readonly phaseResults: readonly PhaseAgentResult[];
  readonly failedPhase?: MethodologyPhase;
  readonly totalArtifacts: number;
  readonly totalDurationMs: number;
}

/**
 * Orchestrates the execution of all phase agents in dependency order.
 */
export class PhaseOrchestrator {
  constructor(private readonly registry: AgentRegistry) {}

  async executeAll(context: Omit<PhaseAgentContext, "previousArtifacts">): Promise<OrchestratorRunResult> {
    const results: PhaseAgentResult[] = [];
    const allArtifacts = new Map<MethodologyPhase, readonly PhaseArtifactOutput[]>();
    const completedPhases = new Set<MethodologyPhase>();
    const overallStart = performance.now();

    for (const phase of METHODOLOGY_PHASES) {
      if (!areDependenciesMet(phase, completedPhases)) {
        results.push({
          phase,
          success: false,
          artifacts: [],
          errorMessage: "Dependencies not met — skipped",
          durationMs: 0
        });
        continue;
      }

      const agent = this.registry.get(phase);
      if (!agent) {
        // No agent registered for this phase — skip with note
        results.push({
          phase,
          success: true,
          artifacts: [],
          errorMessage: "No agent registered — skipped",
          durationMs: 0
        });
        completedPhases.add(phase);
        continue;
      }

      const fullContext: PhaseAgentContext = {
        ...context,
        previousArtifacts: allArtifacts
      };

      const result = await agent.execute(fullContext);
      results.push(result);

      if (result.success) {
        completedPhases.add(phase);
        allArtifacts.set(phase, result.artifacts);
      } else {
        return {
          success: false,
          phaseResults: results,
          failedPhase: phase,
          totalArtifacts: results.reduce((sum, r) => sum + r.artifacts.length, 0),
          totalDurationMs: performance.now() - overallStart
        };
      }
    }

    return {
      success: true,
      phaseResults: results,
      totalArtifacts: results.reduce((sum, r) => sum + r.artifacts.length, 0),
      totalDurationMs: performance.now() - overallStart
    };
  }
}
