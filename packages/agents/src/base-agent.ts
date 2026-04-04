import type { MethodologyPhase, ProviderSelection, RuntimeMode } from "@srp/shared-types";

export interface AgentContext {
  readonly projectId: string;
  readonly runId: string;
  readonly role: RuntimeMode;
  readonly providers: readonly ProviderSelection[];
}

export abstract class BaseAgent {
  constructor(
    public readonly id: string,
    public readonly name: string
  ) {}

  abstract run(context: AgentContext, input: unknown): Promise<unknown>;
}

export abstract class PhaseAgentBase extends BaseAgent {
  constructor(
    id: string,
    name: string,
    public readonly phase: MethodologyPhase
  ) {
    super(id, name);
  }
}

export abstract class SpecialistWorker extends BaseAgent {
  constructor(
    id: string,
    name: string
  ) {
    super(id, name);
  }
}
