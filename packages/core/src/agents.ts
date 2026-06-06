export type AgentRole = "intent" | "discovery" | "attacker" | "defender" | "judge" | "poc" | "watch" | "report";
export type ExecutionMode = "sequential" | "parallel" | "debate" | "verification";

export interface Agent<I = unknown, O = unknown> {
  id: string;
  role: AgentRole;
  description: string;
  execute(input: I): Promise<O> | O;
}

export class AgentRegistry {
  private readonly agents = new Map<string, Agent>();

  register(agent: Agent): void {
    if (this.agents.has(agent.id)) throw new Error(`Agent already registered: ${agent.id}`);
    this.agents.set(agent.id, agent);
  }

  get(id: string): Agent {
    const agent = this.agents.get(id);
    if (!agent) throw new Error(`Unknown agent: ${id}`);
    return agent;
  }

  list(): Agent[] {
    return [...this.agents.values()];
  }
}

export class SharedMemory {
  private readonly entries: Array<{ key: string; value: unknown; createdAt: string }> = [];

  write(key: string, value: unknown): void {
    this.entries.push({ key, value, createdAt: new Date().toISOString() });
  }

  read<T>(key: string): T | undefined {
    const entry = [...this.entries].reverse().find((item) => item.key === key);
    return entry?.value as T | undefined;
  }

  timeline(): Array<{ key: string; value: unknown; createdAt: string }> {
    return [...this.entries];
  }
}

export class OrchestrationEngine {
  private readonly registry: AgentRegistry;
  private readonly memory: SharedMemory;

  constructor(registry: AgentRegistry, memory: SharedMemory) {
    this.registry = registry;
    this.memory = memory;
  }

  async execute(mode: ExecutionMode, agentIds: string[], input: unknown, onProgress?: (agentId: string, status: string) => void): Promise<unknown[]> {
    if (mode === "parallel") {
      const results = await Promise.all(agentIds.map(async (id) => {
        onProgress?.(id, "started");
        const res = await this.runWithRetry(id, input);
        onProgress?.(id, "completed");
        return res;
      }));
      this.memory.write(`parallel:${agentIds.join(",")}`, results);
      return results;
    }
    
    if (mode === "debate") {
      const results = [];
      let currentInput = input;
      for (let round = 0; round < 5; round++) {
        for (const id of agentIds) {
          onProgress?.(id, `debating round ${round + 1}`);
          const result = await this.runWithRetry(id, currentInput);
          results.push(result);
          currentInput = result;
        }
      }
      return results;
    }
    
    if (mode === "verification") {
      const results = [];
      for (const id of agentIds) {
        onProgress?.(id, "verifying");
        const result = await this.runWithRetry(id, input);
        results.push(result);
      }
      return results;
    }

    const results = [];
    let nextInput = input;
    for (const id of agentIds) {
      onProgress?.(id, "started");
      const result = await this.runWithRetry(id, nextInput);
      onProgress?.(id, "completed");
      results.push(result);
      nextInput = result;
      this.memory.write(`sequential:${id}`, result);
    }
    return results;
  }

  private async runWithRetry(id: string, input: unknown, attempts = 2): Promise<unknown> {
    let lastError: unknown;
    for (let index = 0; index < attempts; index += 1) {
      try {
        return await this.registry.get(id).execute(input);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }
}
