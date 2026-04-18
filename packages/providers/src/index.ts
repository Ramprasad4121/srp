import type { ProviderDefinition, ProviderKind, ProviderSelection } from "@srp/shared-types";

export const providerCatalog: readonly ProviderDefinition[] = [
  {
    kind: "anthropic",
    label: "Anthropic",
    authStrategy: "api-key",
    supportsStreaming: true,
    supportsTools: true,
    supportsReasoning: true,
    defaultModel: "claude-sonnet-4-0",
    credentialProfiles: [{ envVar: "ANTHROPIC_API_KEY", required: true }]
  },
  {
    kind: "hugging-face",
    label: "Hugging Face",
    authStrategy: "api-key",
    supportsStreaming: true,
    supportsTools: false,
    supportsReasoning: false,
    defaultModel: "meta-llama/Meta-Llama-3.1-70B-Instruct",
    credentialProfiles: [{ envVar: "HUGGINGFACE_API_KEY", required: true }]
  },
  {
    kind: "nvidia",
    label: "NVIDIA",
    authStrategy: "api-key",
    supportsStreaming: true,
    supportsTools: false,
    supportsReasoning: true,
    defaultModel: "NVIDIA llama-3.3-nemotron-super-49b-v1.5",
    credentialProfiles: [{ envVar: "NVIDIA_API_KEY", required: true }]
  },
  {
    kind: "ollama",
    label: "Ollama",
    authStrategy: "local",
    supportsStreaming: true,
    supportsTools: false,
    supportsReasoning: false,
    defaultModel: "llama3.1:8b",
    credentialProfiles: []
  },
  {
    kind: "openai",
    label: "OpenAI",
    authStrategy: "api-key",
    supportsStreaming: true,
    supportsTools: true,
    supportsReasoning: true,
    defaultModel: "gpt-4.1",
    credentialProfiles: [{ envVar: "OPENAI_API_KEY", required: true }]
  },
  {
    kind: "openrouter",
    label: "OpenRouter",
    authStrategy: "api-key",
    supportsStreaming: true,
    supportsTools: false,
    supportsReasoning: true,
    defaultModel: "openai/gpt-4.1-mini",
    credentialProfiles: [{ envVar: "OPENROUTER_API_KEY", required: true }]
  },
  {
    kind: "openai-compatible",
    label: "OpenAI Compatible",
    authStrategy: "base-url",
    supportsStreaming: true,
    supportsTools: true,
    supportsReasoning: true,
    defaultModel: "gpt-4.1-mini",
    credentialProfiles: [
      { envVar: "OPENAI_COMPATIBLE_BASE_URL", required: true },
      { envVar: "OPENAI_COMPATIBLE_API_KEY", required: false }
    ]
  }
] as const;

export function getProviderDefinition(kind: ProviderKind): ProviderDefinition {
  const provider = providerCatalog.find((entry) => entry.kind === kind);
  if (!provider) {
    throw new Error(`Unknown provider kind: ${kind}`);
  }
  return provider;
}

export function createDefaultProviderSelection(kind: ProviderKind): ProviderSelection {
  const definition = getProviderDefinition(kind);

  return {
    kind,
    label: definition.label,
    model: definition.defaultModel,
    enabled: true
  };
}

export function createRecommendedProviderSelections(
  kinds: readonly ProviderKind[]
): readonly ProviderSelection[] {
  return kinds.map((kind) => createDefaultProviderSelection(kind));
}

export interface ProviderHealthSnapshot {
  readonly kind: ProviderKind;
  readonly enabled: boolean;
  readonly configured: boolean;
  readonly healthy: boolean;
  readonly missingEnvVars: readonly string[];
}

export interface ProviderHealthSummary {
  readonly total: number;
  readonly enabled: number;
  readonly configured: number;
  readonly healthy: number;
  readonly failingKinds: readonly ProviderKind[];
}

export function evaluateProviderHealth(
  selection: ProviderSelection,
  environment: NodeJS.ProcessEnv
): ProviderHealthSnapshot {
  const definition = getProviderDefinition(selection.kind);
  const missingEnvVars = definition.credentialProfiles
    .filter((profile) => profile.required && !environment[profile.envVar])
    .map((profile) => profile.envVar);

  return {
    kind: selection.kind,
    enabled: selection.enabled,
    configured: missingEnvVars.length === 0,
    healthy: selection.enabled ? missingEnvVars.length === 0 : true,
    missingEnvVars
  };
}

export function evaluateProviderSetHealth(
  selections: readonly ProviderSelection[],
  environment: NodeJS.ProcessEnv
): readonly ProviderHealthSnapshot[] {
  return selections.map((selection) => evaluateProviderHealth(selection, environment));
}

export function summarizeProviderHealth(
  snapshots: readonly ProviderHealthSnapshot[]
): ProviderHealthSummary {
  return {
    total: snapshots.length,
    enabled: snapshots.filter((snapshot) => snapshot.enabled).length,
    configured: snapshots.filter((snapshot) => snapshot.configured).length,
    healthy: snapshots.filter((snapshot) => snapshot.healthy).length,
    failingKinds: snapshots.filter((snapshot) => !snapshot.healthy).map((snapshot) => snapshot.kind)
  };
}

// ---------------------------------------------------------------------------
// Typed ProviderHealthBundle — matches the AppBootstrapResult contract
// ---------------------------------------------------------------------------

export interface ProviderHealthBundle {
  readonly healthyKinds: readonly ProviderKind[];
  readonly failingKinds: readonly ProviderKind[];
  readonly anyHealthy: boolean;
  readonly total: number;
  readonly healthy: number;
  readonly configured: number;
}

export function buildProviderHealthBundle(
  selections: readonly ProviderSelection[],
  environment: NodeJS.ProcessEnv
): ProviderHealthBundle {
  const snapshots = evaluateProviderSetHealth(selections, environment);
  const healthyKinds = snapshots
    .filter((s) => s.healthy)
    .map((s) => s.kind);
  const failingKinds = snapshots
    .filter((s) => !s.healthy)
    .map((s) => s.kind);

  return {
    healthyKinds,
    failingKinds,
    anyHealthy: healthyKinds.length > 0,
    total: snapshots.length,
    healthy: healthyKinds.length,
    configured: snapshots.filter((s) => s.configured).length
  };
}

export * from "./web-research.js";

/**
 * Task categories that drive model selection.
 */
export type ModelTaskCategory =
  | "architecture-analysis"
  | "invariant-extraction"
  | "hypothesis-formulation"
  | "finding-verification"
  | "report-generation"
  | "chat-response"
  | "code-reading"
  | "economic-modeling"
  | "general";

/**
 * Describes a routing rule: what provider+model to use for a given task.
 */
export interface ModelRoutingRule {
  readonly task: ModelTaskCategory;
  readonly preferredProviderKind: ProviderKind;
  readonly preferredModel: string;
  readonly fallbackChain: readonly FallbackEntry[];
  readonly maxTokens: number;
  readonly temperature: number;
}

/**
 * A single fallback entry in a routing chain.
 */
export interface FallbackEntry {
  readonly providerKind: ProviderKind;
  readonly model: string;
}

/**
 * Default routing table based on task capabilities.
 */
export const DEFAULT_ROUTING_TABLE: readonly ModelRoutingRule[] = [
  {
    task: "architecture-analysis",
    preferredProviderKind: "anthropic",
    preferredModel: "claude-sonnet-4-0",
    fallbackChain: [
      { providerKind: "openai", model: "gpt-4.1" },
      { providerKind: "openrouter", model: "openai/gpt-4.1-mini" }
    ],
    maxTokens: 2048,
    temperature: 0.2
  },
  {
    task: "invariant-extraction",
    preferredProviderKind: "anthropic",
    preferredModel: "claude-sonnet-4-0",
    fallbackChain: [
      { providerKind: "openai", model: "gpt-4.1" },
      { providerKind: "openai-compatible", model: "gpt-4.1-mini" }
    ],
    maxTokens: 2048,
    temperature: 0.1
  },
  {
    task: "hypothesis-formulation",
    preferredProviderKind: "openai",
    preferredModel: "gpt-4.1",
    fallbackChain: [
      { providerKind: "anthropic", model: "claude-sonnet-4-0" },
      { providerKind: "openrouter", model: "openai/gpt-4.1-mini" }
    ],
    maxTokens: 1536,
    temperature: 0.3
  },
  {
    task: "finding-verification",
    preferredProviderKind: "anthropic",
    preferredModel: "claude-sonnet-4-0",
    fallbackChain: [
      { providerKind: "openai", model: "gpt-4.1" }
    ],
    maxTokens: 2048,
    temperature: 0.1
  },
  {
    task: "report-generation",
    preferredProviderKind: "anthropic",
    preferredModel: "claude-sonnet-4-0",
    fallbackChain: [
      { providerKind: "openai", model: "gpt-4.1" }
    ],
    maxTokens: 4096,
    temperature: 0.2
  },
  {
    task: "chat-response",
    preferredProviderKind: "openai",
    preferredModel: "gpt-4.1-mini",
    fallbackChain: [
      { providerKind: "anthropic", model: "claude-sonnet-4-0" },
      { providerKind: "ollama", model: "llama3.1:8b" }
    ],
    maxTokens: 1024,
    temperature: 0.4
  },
  {
    task: "code-reading",
    preferredProviderKind: "anthropic",
    preferredModel: "claude-sonnet-4-0",
    fallbackChain: [
      { providerKind: "openai", model: "gpt-4.1" }
    ],
    maxTokens: 4096,
    temperature: 0.1
  },
  {
    task: "economic-modeling",
    preferredProviderKind: "openai",
    preferredModel: "gpt-4.1",
    fallbackChain: [
      { providerKind: "anthropic", model: "claude-sonnet-4-0" }
    ],
    maxTokens: 2048,
    temperature: 0.2
  },
  {
    task: "general",
    preferredProviderKind: "openai",
    preferredModel: "gpt-4.1-mini",
    fallbackChain: [
      { providerKind: "anthropic", model: "claude-sonnet-4-0" },
      { providerKind: "ollama", model: "llama3.1:8b" }
    ],
    maxTokens: 1024,
    temperature: 0.3
  }
];

/**
 * Result of resolving a model route.
 */
export interface ResolvedRoute {
  readonly task: ModelTaskCategory;
  readonly provider: ProviderSelection;
  readonly maxTokens: number;
  readonly temperature: number;
  readonly resolvedVia: "preferred" | "fallback" | "mock";
  readonly fallbackIndex?: number;
}

/**
 * Resolves the best available provider for a given task.
 * Checks health of preferred provider, then walks the fallback chain.
 */
export function resolveModelRoute(
  task: ModelTaskCategory,
  availableProviders: readonly ProviderSelection[],
  environment: NodeJS.ProcessEnv,
  routingTable: readonly ModelRoutingRule[] = DEFAULT_ROUTING_TABLE
): ResolvedRoute | null {
  const rule = routingTable.find((r) => r.task === task) ?? routingTable.find((r) => r.task === "general");
  if (!rule) return null;

  const healthMap = new Map<ProviderKind, ProviderHealthSnapshot>();
  for (const provider of availableProviders) {
    healthMap.set(provider.kind, evaluateProviderHealth(provider, environment));
  }

  // Try preferred provider
  const preferredHealth = healthMap.get(rule.preferredProviderKind);
  if (preferredHealth?.healthy) {
    const provider = availableProviders.find((p) => p.kind === rule.preferredProviderKind);
    if (provider) {
      return {
        task,
        provider: { ...provider, model: rule.preferredModel },
        maxTokens: rule.maxTokens,
        temperature: rule.temperature,
        resolvedVia: "preferred"
      };
    }
  }

  // Walk fallback chain
  for (let i = 0; i < rule.fallbackChain.length; i++) {
    const fallback = rule.fallbackChain[i]!;
    const fallbackHealth = healthMap.get(fallback.providerKind);
    if (fallbackHealth?.healthy) {
      const provider = availableProviders.find((p) => p.kind === fallback.providerKind);
      if (provider) {
        return {
          task,
          provider: { ...provider, model: fallback.model },
          maxTokens: rule.maxTokens,
          temperature: rule.temperature,
          resolvedVia: "fallback",
          fallbackIndex: i
        };
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Request/Response Logging
// ---------------------------------------------------------------------------

/**
 * Log entry for model routing decisions.
 */
export interface ModelRequestLogEntry {
  readonly timestamp: string;
  readonly task: ModelTaskCategory;
  readonly providerKind: ProviderKind;
  readonly model: string;
  readonly resolvedVia: "preferred" | "fallback" | "mock";
  readonly durationMs?: number;
  readonly success?: boolean;
  readonly errorMessage?: string;
}

/**
 * In-memory model request log.
 */
export class ModelRequestLogger {
  private readonly entries: ModelRequestLogEntry[] = [];
  private readonly maxEntries: number;

  constructor(maxEntries: number = 1000) {
    this.maxEntries = maxEntries;
  }

  log(entry: ModelRequestLogEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
  }

  getEntries(): readonly ModelRequestLogEntry[] {
    return [...this.entries];
  }

  getEntriesByTask(task: ModelTaskCategory): readonly ModelRequestLogEntry[] {
    return this.entries.filter((e) => e.task === task);
  }

  clear(): void {
    this.entries.length = 0;
  }

  /**
   * Summarizes model usage statistics.
   */
  summarize(): ModelUsageSummary {
    const byProvider: Record<string, number> = {};
    const byTask: Record<string, number> = {};
    let totalRequests = 0;
    let successCount = 0;
    let failureCount = 0;

    for (const entry of this.entries) {
      totalRequests++;
      byProvider[entry.providerKind] = (byProvider[entry.providerKind] ?? 0) + 1;
      byTask[entry.task] = (byTask[entry.task] ?? 0) + 1;
      if (entry.success === true) successCount++;
      if (entry.success === false) failureCount++;
    }

    return {
      totalRequests,
      successCount,
      failureCount,
      requestsByProvider: byProvider,
      requestsByTask: byTask
    };
  }
}

export interface ModelUsageSummary {
  readonly totalRequests: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly requestsByProvider: Readonly<Record<string, number>>;
  readonly requestsByTask: Readonly<Record<string, number>>;
}
