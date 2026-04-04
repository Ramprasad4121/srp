import OpenAI from "openai";
import type { ProviderSelection } from "@srp/shared-types";

interface ChatMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export async function callProvider(
  provider: ProviderSelection,
  messages: readonly ChatMessage[]
): Promise<string> {
  if (!provider.enabled) {
    throw new Error(`Provider ${provider.kind} is disabled`);
  }

  switch (provider.kind) {
    case "openai":
    case "openai-compatible":
    case "openrouter":
    case "nvidia":
    case "hugging-face":
      return callOpenAICompatible(provider, messages);
    case "anthropic":
      return callAnthropicViaMessages(provider, messages);
    case "ollama":
      return callOllama(provider, messages);
    default:
      throw new Error(`Provider ${provider.kind} is not supported yet`);
  }
}

function getOpenAIKey(): string | undefined {
  return process.env["OPENAI_API_KEY"] || process.env["OPENAI_COMPATIBLE_API_KEY"];
}

async function callOpenAICompatible(
  provider: ProviderSelection,
  messages: readonly ChatMessage[]
): Promise<string> {
  const apiKey = getOpenAIKey();
  const baseURL = process.env["OPENAI_COMPATIBLE_BASE_URL"];

  if (!apiKey && provider.kind !== "openai-compatible" && provider.kind !== "openrouter") {
    throw new Error("OPENAI_API_KEY is required for OpenAI-compatible providers");
  }

  const clientConfig: Record<string, unknown> = {};
  if (apiKey) clientConfig["apiKey"] = apiKey;
  if (baseURL) clientConfig["baseURL"] = baseURL;

  const client = new OpenAI(clientConfig as ConstructorParameters<typeof OpenAI>[0]);

  const completion = await client.chat.completions.create({
    model: provider.model,
    messages: messages.map((message) => ({
      role: message.role,
      content: message.content
    })),
    temperature: 0.2,
    max_tokens: 800
  });

  return completion.choices[0]?.message?.content?.trim() ?? "";
}

/**
 * Use the modern Anthropic Messages API via the @anthropic-ai/sdk.
 * Dynamically imports the SDK to avoid breaking builds when the module
 * is not installed (e.g. in CI with only OpenAI configured).
 */
async function callAnthropicViaMessages(
  provider: ProviderSelection,
  messages: readonly ChatMessage[]
): Promise<string> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is required for Anthropic providers");
  }

  // Dynamic import avoids compile-time coupling to the SDK
  // The package exports { Client, HUMAN_PROMPT, AI_PROMPT }
  const AnthropicModule = await import("@anthropic-ai/sdk") as Record<string, unknown>;
  const AnthropicClient = (AnthropicModule["Client"] ?? AnthropicModule["default"]) as new (config: Record<string, unknown>) => {
    messages: {
      create(params: Record<string, unknown>): Promise<{ content: Array<{ type: string; text?: string }> }>;
    };
  };

  const clientConfig: Record<string, unknown> = { apiKey };
  const baseURL = process.env["ANTHROPIC_BASE_URL"];
  if (baseURL) clientConfig["baseURL"] = baseURL;

  const client = new AnthropicClient(clientConfig);

  // Separate system message from the rest
  const systemMessages = messages.filter((m) => m.role === "system");
  const nonSystemMessages = messages.filter((m) => m.role !== "system");

  const systemPrompt = systemMessages.map((m) => m.content).join("\n") || undefined;
  const anthropicMessages = nonSystemMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content
  }));

  // Ensure messages alternate and start with "user"
  if (anthropicMessages.length === 0 || anthropicMessages[0]?.role !== "user") {
    anthropicMessages.unshift({ role: "user", content: "Please respond." });
  }

  const response = await client.messages.create({
    model: provider.model,
    max_tokens: 1024,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: anthropicMessages
  });

  // Extract text from content blocks
  const textBlocks = (response.content as Array<{ type: string; text?: string }>)
    .filter((block: { type: string }) => block.type === "text")
    .map((block: { text?: string }) => block.text ?? "");

  return textBlocks.join("\n").trim();
}

/**
 * Call a local Ollama instance via its OpenAI-compatible endpoint.
 */
async function callOllama(
  provider: ProviderSelection,
  messages: readonly ChatMessage[]
): Promise<string> {
  const baseURL = process.env["OLLAMA_BASE_URL"] || "http://localhost:11434/v1";

  const client = new OpenAI({
    apiKey: "ollama",
    baseURL
  });

  const completion = await client.chat.completions.create({
    model: provider.model,
    messages: messages.map((message) => ({
      role: message.role,
      content: message.content
    })),
    temperature: 0.2,
    max_tokens: 800
  });

  return completion.choices[0]?.message?.content?.trim() ?? "";
}
