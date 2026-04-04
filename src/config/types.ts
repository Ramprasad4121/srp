// SRP Configuration Types
// This file defines the TypeScript types for SRP configuration

export interface UserConfig {
  roleMode: "auditor" | "developer" | "both";
  preferredModels: {
    audit: string;
    development: string;
    general: string;
  };
  ui: {
    theme: "light" | "dark" | "auto";
    layout: "compact" | "balanced" | "comfortable";
    teachingMode: boolean;
  };
  workspace: {
    projectsDir: string;
    outputsDir: string;
    cacheDir: string;
  };
}

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  auth: "api-key" | "aws-sdk" | "oauth" | "token";
  models: Record<string, ModelDefinition>;
}

export interface ModelDefinition {
  id: string;
  name: string;
  api: "openai-completions" | "anthropic-messages" | "openai-responses";
  reasoning: boolean;
  input: Array<"text" | "image">;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  contextWindow: number;
  maxTokens: number;
}

export interface ToolchainConfig {
  foundry: {
    installed: boolean;
    version: string;
    path: string;
  };
  slither: {
    installed: boolean;
    version: string;
    path: string;
  };
  echidna: {
    installed: boolean;
    version: string;
    path: string;
  };
  docker: {
    installed: boolean;
    version: string;
  };
}

export interface SkillsConfig {
  enabled: string[];
  disabled: string[];
}

export interface ProtocolFocus {
  focus: "amm" | "lending" | "bridge" | "staking" | "governance" | "perpetuals" | "general";
  expertiseLevel: "beginner" | "intermediate" | "advanced";
}

export interface HealthStatus {
  lastCheck: string;
  status: "healthy" | "degraded" | "unhealthy";
  warnings: string[];
  errors: string[];
}

export interface SRPConfig {
  version: string;
  user: UserConfig;
  providers: Record<string, ProviderConfig>;
  toolchain: ToolchainConfig;
  skills: SkillsConfig;
  protocolFocus: ProtocolFocus;
  health: HealthStatus;
}

export interface ConfigOptions {
  configPath?: string;
  envPath?: string;
  validate?: boolean;
}

export interface ConfigValidationError {
  field: string;
  message: string;
  value: any;
}

export interface ProviderTest {
  provider: string;
  model: string;
  success: boolean;
  latency: number;
  error?: string;
}