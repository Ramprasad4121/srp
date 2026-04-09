import { randomUUID } from "node:crypto";
import type {
  AgentDefinition,
  AgentInstance,
  AgentRegistryState,
  KnowledgeBusState,
  KnowledgeKind,
  KnowledgeNode
} from "@srp/shared-types";

export class KnowledgeBus {
  private nodes: KnowledgeNode[] = [];
  private lastUpdate = new Date().toISOString();

  addNode(kind: KnowledgeKind, title: string, data: unknown, sourceAgentId: string): void {
    const node: KnowledgeNode = {
      id: `node_${randomUUID()}`,
      kind,
      title,
      data,
      sourceAgentId,
      discoveredAt: new Date().toISOString()
    };
    this.nodes.push(node);
    this.lastUpdate = node.discoveredAt;
  }

  getState(): KnowledgeBusState {
    return {
      nodes: [...this.nodes],
      lastUpdateAt: this.lastUpdate
    };
  }

  clear(): void {
    this.nodes = [];
    this.lastUpdate = new Date().toISOString();
  }
}

export class AgentRegistry {
  private definitions: AgentDefinition[] = [
    { id: "discovery-agent", name: "Discovery Agent", role: "researcher", skills: ["web-search", "fetch-content"], toolAccess: ["SEARCH", "FETCH_CONTENT"] },
    { id: "synthesis-agent", name: "Synthesis Agent", role: "architect", skills: ["logic-synthesis", "actor-mapping"], toolAccess: ["READ_FILE", "LIST_FILES"] },
    { id: "visual-agent", name: "Visual Agent", role: "architect", skills: ["diagram-generation"], toolAccess: [] },
    { id: "fuzzer-agent", name: "Fuzzer Agent", role: "developer", skills: ["poc-generation"], toolAccess: ["BASH", "READ_FILE"] },
    { id: "audit-agent", name: "Audit Agent", role: "auditor", skills: ["security-auditor"], toolAccess: ["READ_FILE", "LIST_FILES", "BASH", "mcp__sc-auditor__run-slither", "mcp__sc-auditor__run-aderyn", "mcp__sc-auditor__get_checklist", "mcp__sc-auditor__search_findings"] },
    { id: "exploit-agent", name: "Exploit Agent", role: "developer", skills: ["exploit-generation"], toolAccess: ["READ_FILE", "LIST_FILES", "BASH", "mcp__sc-auditor__generate-foundry-poc", "mcp__sc-auditor__run-echidna", "mcp__sc-auditor__run-medusa", "mcp__sc-auditor__run-halmos"] }
  ];
  private activeInstances: AgentInstance[] = [];

  spawnInstance(definitionId: string): string {
    const definition = this.definitions.find((candidate) => candidate.id === definitionId);
    if (!definition) throw new Error(`Unknown agent definition: ${definitionId}`);

    const instanceId = `inst_${randomUUID()}`;
    this.activeInstances.push({
      instanceId,
      definitionId,
      status: "idle"
    });
    return instanceId;
  }

  updateInstanceStatus(
    instanceId: string,
    status: AgentInstance["status"],
    lastThought?: string,
    activeTask?: string
  ): void {
    const index = this.activeInstances.findIndex((candidate) => candidate.instanceId === instanceId);
    if (index === -1) return;
    this.activeInstances[index] = {
      ...this.activeInstances[index],
      status,
      lastThought,
      activeTask
    } as AgentInstance;
  }

  getState(): AgentRegistryState {
    return {
      definitions: [...this.definitions],
      activeInstances: [...this.activeInstances]
    };
  }

  clear(): void {
    this.activeInstances = [];
  }
}

