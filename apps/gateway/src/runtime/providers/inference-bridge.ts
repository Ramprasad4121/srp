import type {
  ArchitectureSummary,
  ProviderSelection,
  WorkspaceAnalysis,
  CodebaseContextSummary,
  IntentSummary,
  IntelligenceArtifact,
  DiscoveryRegistry,
  Conversation,
  RuntimeSessionState,
  RuntimeMode,
  ChatCitation,
  ProtocolDiagram,
  ExcalidrawDiagramElement,
  ToolchainExecution
} from "@srp/shared-types";
import type { ChatGroundingContext } from "../chat-grounding.js";
import { callProvider } from "./provider-client.js";
import { getInferenceCache } from "@srp/cache";
import { listSkills } from "../skills-catalog.js";
import * as fs from "fs";
import { join } from "path";

const INFERENCE_CACHE = getInferenceCache(process.cwd());

export interface InferenceContext {
  readonly workspace: WorkspaceAnalysis;
  readonly codebase: CodebaseContextSummary;
  readonly discoveryRegistry?: DiscoveryRegistry;
  readonly intent: IntentSummary;
  readonly architecture?: ArchitectureSummary | undefined;
}

/**
 * Robust JSON parser that handles markdown garbage or leading/trailing text.
 */
function parseJson(text: string): any {
  let searchIndex = 0;
  while (searchIndex < text.length) {
    const startObj = text.indexOf("{", searchIndex);
    const startArr = text.indexOf("[", searchIndex);
    if (startObj === -1 && startArr === -1) break;

    const start = (startObj !== -1 && (startArr === -1 || startObj < startArr)) ? startObj : startArr;
    const stack: string[] = [];
    let end = -1;

    for (let i = start; i < text.length; i++) {
      const char = text[i];
      if (char === "{" || char === "[") {
        stack.push(char === "{" ? "}" : "]");
      } else if (char === "}" || char === "]") {
        if (stack.length > 0 && stack[stack.length - 1] === char) {
          stack.pop();
          if (stack.length === 0) {
            end = i;
            break;
          }
        }
      }
    }

    if (end !== -1) {
      const payload = text.slice(start, end + 1);
      try {
        return JSON.parse(payload);
      } catch {
        searchIndex = start + 1;
        continue;
      }
    } else {
      searchIndex = start + 1;
    }
  }
  throw new Error("Unable to locate valid JSON payload in response");
}

/**
 * High-bypass agentic loop supporting SEARCH, FETCH_CONTENT, READ_FILE, and LIST_FILES.
 */
async function executeAgenticLoop(
  messages: any[],
  activeProvider: ProviderSelection | undefined,
  modelName: string,
  isTestEnvironment: boolean
): Promise<string> {
  let iterations = 0;
  let finalResponse = "";

  while (iterations < 10) {
    iterations++;
    let responseContent = "";

    if (isTestEnvironment) {
      responseContent = "Mock Discovery completed.";
    } else {
      const cacheKey = `agentic:${modelName}:${JSON.stringify(messages)}`;
      const cached = await INFERENCE_CACHE.get<string>(cacheKey);
      if (cached) {
        console.log(`[Cache] Hit: ${cacheKey.substring(0, 50)}...`);
        responseContent = cached;
      } else {
        responseContent = await callProvider(activeProvider!, messages);
        await INFERENCE_CACHE.set(cacheKey, responseContent);
      }
    }

    // 1. Tool: FETCH_CONTENT (Scrapling logic)
    if (responseContent.includes("[TOOL: FETCH_CONTENT]")) {
      const match = responseContent.match(/\\[TOOL: FETCH_CONTENT\\]\\s+(.+)/);
      if (match && match[1]) {
        const url = match[1].trim();
        try {
          console.log(`[Discovery] Scrapling content from: ${url}`);
          const res = await fetch(url, { headers: { "User-Agent": "SRP-Senior-Auditor/1.0" } });
          const html = await res.text();
          const cleanText = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 20000);
          messages.push({ role: "assistant", content: responseContent });
          messages.push({ role: "user", content: `Full Scraped Content from ${url}: \n${cleanText}` });
          continue;
        } catch (e: any) {
          messages.push({ role: "assistant", content: responseContent });
          messages.push({ role: "user", content: `Error scraping ${url}: ${e.message}` });
          continue;
        }
      }
    }

    // 2. Tool: SEARCH
    if (responseContent.includes("[TOOL: SEARCH]")) {
      const match = responseContent.match(/\[TOOL: SEARCH\]\s+(.+)/);
      if (match && match[1]) {
        const query = match[1].trim();
        try {
          console.log(`[Discovery] Searching web: ${query}`);
          const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
          const res = await fetch(searchUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
          const html = await res.text();
          messages.push({ role: "assistant", content: responseContent });
          messages.push({ role: "user", content: `Search Result Snapshot: ${html.substring(0, 5000)}` });
          continue;
        } catch (e: any) {
          messages.push({ role: "assistant", content: responseContent });
          messages.push({ role: "user", content: `Search failed: ${e.message}` });
          continue;
        }
      }
    }

    // 3. Tool: READ_FILE
    if (responseContent.includes("[TOOL: READ_FILE]")) {
      const match = responseContent.match(/\[TOOL: READ_FILE\]\s+(.+)/);
      if (match && match[1]) {
        const filePath = match[1].trim();
        try {
          const data = fs.readFileSync(filePath, "utf-8");
          messages.push({ role: "assistant", content: responseContent });
          messages.push({ role: "user", content: `File Content (${filePath}): \n${data}` });
          continue;
        } catch (e: any) {
          messages.push({ role: "assistant", content: responseContent });
          messages.push({ role: "user", content: `File Error: ${e.message}` });
          continue;
        }
      }
    }

    finalResponse = responseContent;
    break;
  }
  return finalResponse;
}

/**
 * Force-research discovery artifacts. 
 * This is a deterministic multi-step flow:
 * 1. LLM generates specific search queries.
 * 2. System executes searches and provides URLs.
 * 3. LLM picks top URLs.
 * 4. System executes FETCH_CONTENT for each.
 * 5. LLM generates final summaries.
 */
export async function generateDiscoveryArtifacts(
  domain: string,
  context: Partial<InferenceContext>,
  provider: ProviderSelection | undefined
): Promise<IntelligenceArtifact[]> {
  const modelName = provider?.model || "unknown";
  const workspace = context.workspace;
  const project = workspace?.rootDirectory?.split('/').pop() || "this protocol";
  
  console.log(`[Discovery:${domain}] Starting deep research for ${project}...`);

  // Step 1: Force search queries
  const searchPrompt = `You are a Senior Security Researcher. Generate 3 specific search queries to find ${domain.toUpperCase()} for the protocol "${project}".
Queries should target: Whitepapers, Gitbooks, Audit Reports (C4, Sherlock), Governance Forums, or Etherscan.
Return ONLY a JSON array of strings.`;
  
  const searchQueriesRaw = await callProvider(provider!, [{ role: "user", content: searchPrompt }]);
  const searchQueries = parseJson(searchQueriesRaw);
  const allLinks: string[] = [];

  // Step 2: Execute Searches
  for (const query of searchQueries) {
    console.log(`[Discovery:${domain}] Searching: ${query}`);
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    try {
      const res = await fetch(searchUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
      const html = await res.text();
      const links = Array.from(html.matchAll(/<a class="result__a" href="([^"]*)">/g))
        .map(m => m[1])
        .filter(url => !url.includes("duckduckgo.com"))
        .slice(0, 3);
      allLinks.push(...links);
    } catch (err) {
      console.warn(`Search failed for ${query}`, err);
    }
  }

  const uniqueLinks = Array.from(new Set(allLinks)).slice(0, 5);
  const artifacts: IntelligenceArtifact[] = [];

  // Step 3: Fetch and Summarize each link
  for (const url of uniqueLinks) {
    console.log(`[Discovery:${domain}] Scrapling: ${url}`);
    try {
      const res = await fetch(url, { 
        headers: { 
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36" 
        } 
      });
      const html = await res.text();
      const cleanText = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 12000);

      const summaryPrompt = `Analyze this document from ${url}. 
Domain: ${domain.toUpperCase()}
Content: ${cleanText.substring(0, 8000)}

Provide:
1. Clear Title for this document.
2. Senior Auditor Digest (3-5 sentences summary of security relevance).

Return ONLY JSON: { "title": "...", "summary": "..." }`;

      const summaryRaw = await callProvider(provider!, [{ role: "user", content: summaryPrompt }]);
      const summaryJson = parseJson(summaryRaw);

      artifacts.push({
        id: `discovery-${domain}-${Math.random().toString(36).substring(2, 7)}`,
        domain: domain as any,
        title: summaryJson.title || url,
        url: url,
        rawContent: cleanText,
        summary: summaryJson.summary || "Summary generation failed.",
        metadata: {},
        analyzedAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn(`Failed to scrape/summarize ${url}`, err);
    }
  }

  return artifacts;
}



/**
 * Intent Synthesis.
 */
export async function generateIntentSummary(
  context: Partial<InferenceContext>,
  activeProvider?: ProviderSelection
): Promise<IntentSummary> {
  const modelName = activeProvider ? activeProvider.model : "unknown";
  const discovery = context.discoveryRegistry;
  const prompt = `Synthesize protocol intent from these discovery sources:
${discovery?.artifacts.map(a => `[${a.title}] ${a.summary}`).join("\n\n")}
Provide core value prop, intended flow, and main contracts. 
Output JSON: draftSummary, mainContracts, interfaceCount.`;

  const response = await callProvider(activeProvider!, [{ role: "user", content: prompt }]);
  const json = parseJson(response);
  return {
    draftSummary: json.draftSummary || "Synthesis completed.",
    mainContracts: json.mainContracts || [],
    interfaceCount: json.interfaceCount || 0
  };
}

/**
 * Actor & Architecture Synthesis.
 */
export async function generateArchitectureSummary(
  context: InferenceContext,
  activeProvider?: ProviderSelection
): Promise<ArchitectureSummary> {
  const modelName = activeProvider ? activeProvider.model : "unknown";
  const prompt = `Map Actor Model and trust boundaries based on:
${context.intent.draftSummary}
Identify Trusted, Adversarial, and Economic actors.
Output JSON: markdownSummary, keyComponents (name, description).`;

  const response = await callProvider(activeProvider!, [{ role: "user", content: prompt }]);
  const json = parseJson(response);
  return {
    markdownSummary: json.markdownSummary || "",
    keyComponents: json.keyComponents || [],
    generatedByModel: modelName
  };
}

/**
 * Visual Flow Mapping.
 */
export async function generateProtocolDiagram(
  context: InferenceContext,
  activeProvider?: ProviderSelection
): Promise<ProtocolDiagram> {
  const modelName = activeProvider ? activeProvider.model : "unknown";
  const prompt = `Generate an Excalidraw-compatible Protocol Flow Map.
Money Flows: ${context.intent.draftSummary}
Actors: ${context.architecture?.markdownSummary}
Output JSON: title, summary, elements (Excalidraw schema v2 array).`;

  const response = await callProvider(activeProvider!, [{ role: "user", content: prompt }]);
  const json = parseJson(response);
  return {
    type: "excalidraw",
    version: 2,
    source: "srp",
    title: json.title || "Protocol Flow Map",
    summary: json.summary || "Interactive value flow diagram.",
    elements: json.elements || [],
    generatedByModel: modelName
  };
}

/**
 * Chat reasoning loop.
 */
export async function generateChatResponse(
  conversation: Conversation,
  sessionState: RuntimeSessionState,
  role: RuntimeMode,
  grounding: ChatGroundingContext,
  activeProvider?: ProviderSelection
): Promise<{ readonly content: string; readonly citations: readonly ChatCitation[] }> {
  const modelName = activeProvider ? activeProvider.model : "fallback-mock-model";
  const systemPrompt = `You are SRP Senior Security Intelligence Engine. Current Mode: ${role}.
Use [TOOL: SEARCH], [TOOL: FETCH_CONTENT], [TOOL: READ_FILE] to answer.`;

  const messages: any[] = [
    { role: "system" as const, content: systemPrompt },
    ...conversation.messages.map(m => ({ role: m.role, content: m.content }))
  ];

  const finalResponse = await executeAgenticLoop(messages, activeProvider, modelName, false);
  return { content: finalResponse, citations: [] };
}
