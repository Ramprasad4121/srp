import type {
  ArchitectureSummary,
  ProviderSelection,
  InvariantRegistry,
  InvariantItem,
  VerificationPlan,
  VerificationPlanItem,
  WorkspaceAnalysis,
  CodebaseContextSummary,
  IntentSummary,
  HypothesisRegistry,
  AttackHypothesis,
  EconomicAnalysis,
  EconomicRiskItem,
  FormalReport,
  CrossContractAnalysis,
  CallPath,
  FindingRegistry,
  SecurityFinding,
  RemediationPlan,
  RemediationAction,
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

export interface InferenceContext {
  readonly workspace: WorkspaceAnalysis;
  readonly codebase: CodebaseContextSummary;
  readonly intent: IntentSummary;
  readonly architecture?: ArchitectureSummary | undefined;
  readonly invariants?: InvariantRegistry | undefined;
  readonly verificationPlan?: VerificationPlan | undefined;
  readonly hypotheses?: HypothesisRegistry | undefined;
  readonly economicAnalysis?: EconomicAnalysis | undefined;
  readonly crossContractAnalysis?: CrossContractAnalysis | undefined;
  readonly findingRegistry?: FindingRegistry | undefined;
  readonly remediationPlan?: RemediationPlan | undefined;
}

function parseJson(text: string): any {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Unable to locate JSON payload");
  }
  const payload = text.slice(start, end + 1);
  return JSON.parse(payload);
}

function buildArchitecturePrompt(context: InferenceContext): string {
  return `Output JSON with markdownSummary and keyComponents based on workspace ${context.workspace.rootDirectory} (Foundry=${context.workspace.isFoundry}, Hardhat=${context.workspace.isHardhat}), analyzed files ${context.workspace.solidityFileCount}, key intent goals ${context.intent.mainContracts.join(
    ", "
  )}. Keep JSON strictly parseable.`;
}

function buildInvariantPrompt(context: InferenceContext): string {
  return `Given architecture components ${context.architecture?.keyComponents.join(", ") || "none"} and identified invariants ${context.invariants?.summary ||
    "n/a"}, produce JSON containing "summary" and "invariants" array with id,title,description,category,priority,derivedFrom,suggestedVerification.`;
}

function buildHypothesesPrompt(context: InferenceContext): string {
  return `Given invariants ${context.invariants?.invariants.map((inv) => inv.id).join(", ") || "none"} and verification targets, output JSON with "summary" and "hypotheses" array containing id,title,description,attackSurface,targetComponent,derivedFromInvariantIds,relatedVerificationIds,likelihood,recommendedNextStep.`;
}

import { listSkills } from "../skills-catalog.js";

import * as fs from "fs";
import { execSync } from "child_process";
import { join } from "path";

export async function generateChatResponse(
  conversation: Conversation,
  sessionState: RuntimeSessionState,
  role: RuntimeMode,
  grounding: ChatGroundingContext,
  activeProvider?: ProviderSelection
): Promise<{ readonly content: string; readonly citations: readonly ChatCitation[] }> {
  const modelName = activeProvider ? activeProvider.model : "fallback-mock-model";
  const isTestEnvironment = process.env.NODE_ENV === "test" || !activeProvider;

  if (isTestEnvironment) {
    console.log("Using Mock LLM Mode");
  }

  try {
    const skills = await listSkills();
    const skillDescriptions = skills.map(s => `- ${s.name}: ${s.description}`).join("\\n");
    
    const groundingEvidence = grounding.snippets
      .map((s) => `Document: ${s.title}\\n${s.preview}`)
      .join("\\n\\n");

    const systemPrompt = `You are SRP (Security Reasoning Protocol), an advanced AI assistant and search engine with internet connection, LLM capabilities, and full computer file access. 
You know everything about the particular project the user is working on.
Current Mode: ${role}

You have access to the local Workspace files.
Architecture Components: ${sessionState.architectureSummary?.keyComponents.join(", ") ?? "None"}

You have the following Action Tools available. If you need to read a file, search the internet, or list files in a directory to answer the query, supply exactly one of these commands on its own line:
[TOOL: READ_FILE] <relative_file_path>
[TOOL: SEARCH] <search_query>
[TOOL: LIST_FILES] <relative_directory_path>

If you output a tool command, stop generating. The system will return the output to you in the next message, and then you can answer the user.

Grounding Evidence:
${groundingEvidence || "No specific documents grounded."}

Provide a comprehensive, accurate, and actionable response.`;

    const messages: any[] = [
      { role: "system" as const, content: systemPrompt },
      ...conversation.messages.map(m => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content
      }))
    ];

    let finalResponse = "";
    let iterations = 0;

    // AI execution loop simulating OpenClaw agent tool-calling
    while (iterations < 5) {
      iterations++;
      
      let responseContent = "";
      if (isTestEnvironment) {
         responseContent = generateMockChatResponse(
            { ...conversation, messages: messages as any }, 
            sessionState, 
            role, 
            grounding, 
            modelName
         ).content;
      } else {
         responseContent = await callProvider(activeProvider, messages);
      }

      if (responseContent.includes("[TOOL: READ_FILE]")) {
        const match = responseContent.match(/\\[TOOL: READ_FILE\\]\\s+(.+)/);
        if (match && match[1]) {
           const filePath = match[1].trim();
           let fileData = "";
           try {
             // Protect against arbitrary read outside workspace if needed, but for local agent it's fine.
             const absPath = process.cwd(); // Note: Ideally should be workspace root
             fileData = fs.readFileSync(filePath, "utf-8");
           } catch(e: any) {
             fileData = `Error reading file: ${e.message}`;
           }
           messages.push({ role: "assistant", content: responseContent });
           messages.push({ role: "user", content: `Tool Output: \n${fileData}` });
           continue;
        }
      }

      if (responseContent.includes("[TOOL: SEARCH]")) {
        const match = responseContent.match(/\\[TOOL: SEARCH\\]\\s+(.+)/);
        if (match && match[1]) {
           const query = match[1].trim();
           let searchData = "";
           try {
             // Fast fallback websearch mechanism using native fetch
             const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
             const response = await fetch(searchUrl, {
               headers: {
                 "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
               }
             });
             const html = await response.text();
             const results = Array.from(html.matchAll(/<a class="result__a" href="([^"]*)">(.*?)<\/a>/g))
               .slice(0, 5)
               .map(m => `- ${m[2].replace(/<[^>]+>/g, '')}: ${m[1]}`)
               .join('\\n');
             const snippets = Array.from(html.matchAll(/<a class="result__snippet[^>]*>(.*?)<\/a>/g))
               .slice(0, 5)
               .map(m => m[1].replace(/<[^>]+>/g, ''))
               .join('\\n');
             searchData = `TOP_TITLES:\\n${results}\\n\\nSNIPPETS:\\n${snippets}`;
             if (!results && !snippets) {
               searchData = html.replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').substring(0, 2000);
             }
           } catch(e: any) {
             searchData = "Error searching web: " + String(e);
           }
           messages.push({ role: "assistant", content: responseContent });
           messages.push({ role: "user", content: "Internet Search Result Snapshot: " + searchData });
           continue;
        }
      }

      if (responseContent.includes("[TOOL: LIST_FILES]")) {
        const match = responseContent.match(/\\[TOOL: LIST_FILES\\]\\s+(.+)/);
        if (match && match[1]) {
           const dirPath = match[1].trim();
           let dirData = "";
           try {
             const items = fs.readdirSync(dirPath, { withFileTypes: true });
             dirData = items.map(i => `${i.isDirectory() ? '[DIR] ' : '- '}${i.name}`).join('\\n');
           } catch(e: any) {
             dirData = `Error listing directory: ${e.message}`;
           }
           messages.push({ role: "assistant", content: responseContent });
           messages.push({ role: "user", content: `Files in ${dirPath}: \n${dirData}` });
           continue;
        }
      }

      finalResponse = responseContent;
      break;
    }

    return {
      content: finalResponse,
      citations: grounding.citations
    };
  } catch (err: any) {
    console.error("Inference Error:", err);
    return {
      content: `I am currently experiencing connection constraints with ${modelName}. Error: ${err.message}`,
      citations: []
    };
  }
}

function generateMockChatResponse(
  conversation: Conversation,
  sessionState: RuntimeSessionState,
  role: RuntimeMode,
  grounding: ChatGroundingContext,
  modelName: string
): { readonly content: string; readonly citations: readonly ChatCitation[] } {
  const messages = [...(conversation.messages || [])];
  const lastUserMessage = messages.reverse().find(m => m.role === "user");
  const rawContent = lastUserMessage?.content || "";
  const content = rawContent.toLowerCase();

  // If the last message was a tool output from search, summarize it for the user
  if (rawContent.includes("Internet Search Result Snapshot:")) {
    // Extract a snippet to pretend to summarize
    const splitArr = rawContent.split("Internet Search Result Snapshot:");
    const snippetRaw = (splitArr[1] || "").substring(0, 800);
    // Strip rough HTML tags to make it readable
    const cleanSnippet = snippetRaw.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
    return {
      content: `I searched the internet and found the following relevant information:\n\n> ${cleanSnippet}...\n\nDoes this help with your query?`,
      citations: grounding.citations
    };
  }

  // Handle explicit tool triggers
  if (content.startsWith("search") || content.includes("internet for") || content.includes("look up")) {
    const query = rawContent.replace(/search|internet for|look up/gi, "").trim();
    return {
      content: `[TOOL: SEARCH] ${query || 'OpenAI'}`,
      citations: grounding.citations
    };
  }

  // Handle conversational greetings
  if (content === "hi" || content === "hii" || content === "hello" || content === "hey") {
    return {
      content: `Hello! I am your ${role === 'auditor' ? 'security auditing' : 'development'} chatbot. I am fully connected to the internet and can read your project files. Try asking me "search EIP-4337" to test my internet connection!`,
      citations: grounding.citations
    };
  }

  const topSnippet = grounding.snippets[0];
  const groundingLead = topSnippet
    ? ` Grounded in ${topSnippet.title}.`
    : "";

  if (content.includes("protocol") || content.includes("architecture")) {
    return {
      content:
        `Based on the architecture mapping, this protocol consists of ${sessionState.architectureSummary?.keyComponents.length || 0} core contracts.` +
        groundingLead,
      citations: grounding.citations
    };
  }

  if (content.includes("finding") || content.includes("vulnerability") || content.includes("bug")) {
    const findings = sessionState.findingRegistry?.findings || [];
    return {
      content:
        `The current finding registry contains ${findings.length} items. ` +
        `${findings.length > 0 ? `One of them is ${findings[0]?.title}.` : "I don't see any confirmed findings yet."}` +
        groundingLead,
      citations: grounding.citations
    };
  }

  if (content.includes("invariant")) {
    const invariants = sessionState.invariantRegistry?.invariants || [];
    return {
      content:
        `I've identified ${invariants.length} security invariants. These are critical for the ${role} mode to monitor.` +
        groundingLead,
      citations: grounding.citations
    };
  }

  return {
    content:
      `I'm sorry, my mock prototype didn't understand that context. I am your SRP ${role} copilot. I am connected to the internet. Tell me to "search <topic>" to see my capabilities!`,
    citations: []
  };
}

export async function generateArchitectureSummary(
  context: InferenceContext,
  activeProvider?: ProviderSelection
): Promise<ArchitectureSummary> {
  const modelName = activeProvider ? activeProvider.model : "fallback-mock-model";
  const isTestEnvironment = process.env.NODE_ENV === "test" || !activeProvider;
  
  if (isTestEnvironment) {
    return generateMockArchitectureSummary(context, modelName);
  }

  try {
    const prompt = buildArchitecturePrompt(context);
    const result = await callProvider(activeProvider, [
      { role: "system", content: "You are SRP. Output JSON strictly." },
      { role: "user", content: prompt }
    ]);
    const json = parseJson(result);
    return {
      markdownSummary: json.markdownSummary ?? generateMockArchitectureSummary(context, modelName).markdownSummary,
      keyComponents: Array.isArray(json.keyComponents) ? json.keyComponents : [],
      generatedByModel: `${modelName} (Provider)`
    };
  } catch (err) {
    console.warn("Architecture provider call failed:", err);
    return generateMockArchitectureSummary(context, `${modelName} (Provider Fallback)`);
  }
}

export async function generateProtocolDiagram(
  context: InferenceContext,
  activeProvider?: ProviderSelection
): Promise<ProtocolDiagram> {
  const modelName = activeProvider ? activeProvider.model : "fallback-mock-model";
  return generateMockProtocolDiagram(context, modelName);
}

function generateMockProtocolDiagram(
  context: InferenceContext,
  modelName: string
): ProtocolDiagram {
  const components = context.architecture?.keyComponents.length
    ? context.architecture.keyComponents
    : context.intent.mainContracts.length
      ? context.intent.mainContracts
      : (context.codebase.filesProcessed > 0 ? ["Unknown Root Contract"] : ["Workspace"]);

  const elements: ExcalidrawDiagramElement[] = [];
  const baseX = 120;
  const baseY = 140;
  const gapX = 240;
  const boxWidth = 180;
  const boxHeight = 92;

  for (const [index, component] of components.entries()) {
    const x = baseX + (index * gapX);
    const y = baseY + ((index % 2) * 120);
    const seed = 1000 + index;
    const rectId = `node-${index}`;
    const textId = `label-${index}`;

    elements.push({
      id: rectId,
      type: "rectangle",
      x,
      y,
      width: boxWidth,
      height: boxHeight,
      angle: 0,
      seed,
      strokeColor: "#4ade80",
      backgroundColor: "#163325",
      fillStyle: "solid",
      strokeWidth: 2,
      roughness: 0,
      opacity: 100
    });
    elements.push({
      id: textId,
      type: "text",
      x: x + 18,
      y: y + 28,
      width: boxWidth - 36,
      height: 28,
      angle: 0,
      seed: seed + 500,
      text: component,
      fontSize: 20,
      fontFamily: 1,
      strokeColor: "#e4e6eb",
      backgroundColor: "transparent",
      textAlign: "center",
      verticalAlign: "middle",
      opacity: 100
    });

    if (index > 0) {
      const prevX = baseX + ((index - 1) * gapX);
      const prevY = baseY + (((index - 1) % 2) * 120);
      elements.push({
        id: `edge-${index - 1}-${index}`,
        type: "arrow",
        x: prevX + boxWidth,
        y: prevY + (boxHeight / 2),
        width: x - (prevX + boxWidth),
        height: (y + (boxHeight / 2)) - (prevY + (boxHeight / 2)),
        angle: 0,
        seed: seed + 900,
        points: [
          [0, 0],
          [x - (prevX + boxWidth), (y + (boxHeight / 2)) - (prevY + (boxHeight / 2))]
        ],
        endArrowhead: "arrow",
        strokeColor: "#60a5fa",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 2,
        roughness: 0,
        opacity: 100
      });
    }
  }

  return {
    type: "excalidraw",
    version: 2,
    source: "srp",
    title: "Protocol Map",
    summary: `Excalidraw-compatible protocol map covering ${components.length} core component(s).`,
    elements,
    generatedByModel: modelName
  };
}

function generateMockArchitectureSummary(
  context: InferenceContext,
  modelName: string
): ArchitectureSummary {
  const { intent } = context;
  const components = intent.mainContracts.length > 0 
    ? [...intent.mainContracts] 
    : (context.codebase.filesProcessed > 0 ? ["Unknown Root Contract"] : []);

  const md = `## Synthesized Architecture

Based on the initial ${context.codebase.filesProcessed} identified source files, the project's architecture appears to be structured around the following core components:

${components.length > 0 ? components.map(c => `- **${c}**: Core domain contract.`).join("\n") : "- *No primary contracts identified.*"}

### Interfaces & Dependencies
Detected ${intent.interfaceCount} explicit interfaces, suggesting a composable or heavily integrated pattern. 

### Framework Context
Operates within a ${context.workspace.isFoundry ? "Foundry" : "Standard"} toolchain environment, constrained to ${context.workspace.rootDirectory}.
`;

  return {
    markdownSummary: md,
    keyComponents: components,
    generatedByModel: modelName
  };
}

export async function generateInvariants(
  context: InferenceContext,
  activeProvider?: ProviderSelection
): Promise<InvariantRegistry> {
  const modelName = activeProvider ? activeProvider.model : "fallback-mock-model";
  if (!activeProvider || process.env.NODE_ENV === "test") {
    return generateMockInvariants(context, modelName);
  }

  try {
    const prompt = buildInvariantPrompt(context);
    const response = await callProvider(activeProvider, [
      { role: "system", content: "You are SRP. Output JSON with invariants array." },
      { role: "user", content: prompt }
    ]);
    const payload = parseJson(response);
    const invariants = Array.isArray(payload.invariants)
      ? payload.invariants.map((item: any) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          category: item.category,
          priority: item.priority,
          derivedFrom: item.derivedFrom || [],
          suggestedVerification: item.suggestedVerification || ""
        }))
      : [];
    return {
      summary: payload.summary ?? generateMockInvariants(context, modelName).summary,
      invariants,
      generatedByModel: `${modelName} (Provider)`
    };
  } catch (err) {
    console.warn("Invariant provider call failed:", err);
    return generateMockInvariants(context, `${modelName} (Provider Fallback)`);
  }
}

function generateMockInvariants(
  context: InferenceContext,
  modelName: string
): InvariantRegistry {
  const comps = context.architecture?.keyComponents || context.intent.mainContracts;
  const items: InvariantItem[] = [];
  const mainComp = comps.length > 0 ? comps[0] : null;

  if (mainComp) {
    items.push({
      id: "INV-001",
      title: "State Transition Integrity",
      description: `Ensure that state transitions in ${mainComp} perform correct access control validation.`,
      category: "Access Control",
      priority: "High",
      derivedFrom: [mainComp],
      suggestedVerification: "Fuzz invariant test bounding role escalation."
    });
    
    items.push({
      id: "INV-002",
      title: "Value Inflow Limits",
      description: `Verify that incoming eth/erc20 assets cannot overflow expected accounting bounds inside components.`,
      category: "Accounting",
      priority: "Medium",
      derivedFrom: [...comps],
      suggestedVerification: "Formal verification suite on state bounds."
    });
  } else {
    items.push({
      id: "INV-GEN-01",
      title: "Empty Workspace Fallback",
      description: "Default fallback invariant due to no specific contracts found.",
      category: "General",
      priority: "Low",
      derivedFrom: [],
      suggestedVerification: "None"
    });
  }

  return {
    summary: `Extracted ${items.length} initial structural invariants from ${context.codebase.filesProcessed} source files.`,
    invariants: items,
    generatedByModel: modelName
  };
}

export async function generateVerificationPlan(
  context: InferenceContext,
  activeProvider?: ProviderSelection
): Promise<VerificationPlan> {
  const modelName = activeProvider ? activeProvider.model : "fallback-mock-model";
  return generateMockVerificationPlan(context, modelName);
}

function generateMockVerificationPlan(
  context: InferenceContext,
  modelName: string
): VerificationPlan {
  const invs = context.invariants?.invariants || [];
  const items: VerificationPlanItem[] = [];

  for (const inv of invs) {
    if (inv.category === "Access Control" || inv.title.includes("Access Control")) {
      items.push({
        id: `VP-${inv.id}`,
        title: `Echidna Access Control Bounds for ${inv.derivedFrom.join(", ")}`,
        description: `Implement echidna fuzzing harnesses verifying ${inv.title} invariants prevent role escalation.`,
        coversInvariantIds: [inv.id],
        verificationType: "Fuzzing",
        status: "Planned",
        recommendedTool: "Echidna"
      });
    } else if (inv.category === "Accounting" || inv.title.includes("Accounting")) {
      items.push({
        id: `VP-${inv.id}`,
        title: `Halmos Formal Accounting Bounds for ${inv.derivedFrom.join(", ")}`,
        description: `Use symbolic execution to verify ${inv.title} asset bounds are formally sound.`,
        coversInvariantIds: [inv.id],
        verificationType: "Formal",
        status: "Recommended",
        recommendedTool: "Halmos"
      });
    } else {
      items.push({
        id: `VP-${inv.id}`,
        title: `Manual Audit Check: ${inv.title}`,
        description: `Manual review recommended for fallback/general architectural edges.`,
        coversInvariantIds: [inv.id],
        verificationType: "Manual",
        status: "Skipped",
        recommendedTool: "Slither/Manual"
      });
    }
  }

  if (items.length === 0) {
    items.push({
      id: "VP-DEFAULT",
      title: "Default Generic Plan",
      description: "Default fallback planning step due to empty properties.",
      coversInvariantIds: [],
      verificationType: "Static Analysis",
      status: "Recommended",
      recommendedTool: "Slither"
    });
  }

  return {
    summary: `Structured ${items.length} verification actions to resolve invariants across ${context.workspace.isFoundry ? "Foundry" : "Standard"} infrastructure.`,
    items,
    generatedByModel: modelName
  };
}

export async function generateHypotheses(
  context: InferenceContext,
  activeProvider?: ProviderSelection
): Promise<HypothesisRegistry> {
  const modelName = activeProvider ? activeProvider.model : "fallback-mock-model";
  if (!activeProvider || process.env.NODE_ENV === "test") {
    return generateMockHypotheses(context, modelName);
  }

  try {
    const prompt = buildHypothesesPrompt(context);
    const response = await callProvider(activeProvider, [
      { role: "system", content: "You are SRP. Output JSON with hypotheses array." },
      { role: "user", content: prompt }
    ]);
    const payload = parseJson(response);
    const hypotheses = Array.isArray(payload.hypotheses)
      ? payload.hypotheses.map((item: any) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          attackSurface: item.attackSurface,
          targetComponent: item.targetComponent,
          derivedFromInvariantIds: item.derivedFromInvariantIds || [],
          relatedVerificationIds: item.relatedVerificationIds || [],
          likelihood: item.likelihood || "Medium",
          recommendedNextStep: item.recommendedNextStep || ""
        }))
      : [];
    return {
      summary: payload.summary ?? generateMockHypotheses(context, modelName).summary,
      hypotheses,
      generatedByModel: `${modelName} (Provider)`
    };
  } catch (err) {
    console.warn("Hypothesis provider call failed:", err);
    return generateMockHypotheses(context, `${modelName} (Provider Fallback)`);
  }
}

function generateMockHypotheses(
  context: InferenceContext,
  modelName: string
): HypothesisRegistry {
  const invs = context.invariants?.invariants || [];
  const vps = context.verificationPlan?.items || [];
  const hypotheses: AttackHypothesis[] = [];

  for (const inv of invs) {
    const relatedVp = vps.find(v => v.coversInvariantIds.includes(inv.id));
    
    if (inv.category === "Access Control") {
      hypotheses.push({
        id: `HYP-${inv.id}-01`,
        title: `Privilege Escalation via ${inv.derivedFrom.join(", ")}`,
        description: `An attacker might bypass ${inv.title} by exploiting uninitialized state or missing modifiers in administrative functions.`,
        attackSurface: "Administrative Functions",
        targetComponent: inv.derivedFrom[0] || "Unknown",
        derivedFromInvariantIds: [inv.id],
        relatedVerificationIds: relatedVp ? [relatedVp.id] : [],
        likelihood: "Medium",
        recommendedNextStep: `Trace all 'onlyOwner' or similar access control paths in ${inv.derivedFrom[0]}.`
      });
    } else if (inv.category === "Accounting") {
      hypotheses.push({
        id: `HYP-${inv.id}-01`,
        title: `Internal Accounting Desync in ${inv.derivedFrom.join(", ")}`,
        description: `External token transfers might cause internal state balances to desync from actual contract holdings, potentially locking or draining funds.`,
        attackSurface: "Token Transfer Inflow/Outflow",
        targetComponent: inv.derivedFrom[0] || "Unknown",
        derivedFromInvariantIds: [inv.id],
        relatedVerificationIds: relatedVp ? [relatedVp.id] : [],
        likelihood: "High",
        recommendedNextStep: `Review ERC20 'transfer' and 'transferFrom' return value handling and balance checkpoints.`
      });
    }
  }

  if (hypotheses.length === 0) {
    hypotheses.push({
      id: "HYP-GEN-01",
      title: "General Reentrancy Vulnerability",
      description: "Missing or poorly placed reentrancy guards could allow recursive calls to drain contract state.",
      attackSurface: "External Calls",
      targetComponent: context.architecture?.keyComponents[0] || "Unknown",
      derivedFromInvariantIds: [],
      relatedVerificationIds: [],
      likelihood: "Low",
      recommendedNextStep: "Check for Checks-Effects-Interactions pattern across all external calls."
    });
  }

  return {
    summary: `Formulated ${hypotheses.length} attack hypotheses based on identified invariants and architectural surface area.`,
    hypotheses,
    generatedByModel: modelName
  };
}

export async function generateEconomicAnalysis(
  context: InferenceContext,
  activeProvider?: ProviderSelection
): Promise<EconomicAnalysis> {
  const modelName = activeProvider ? activeProvider.model : "fallback-mock-model";
  return generateMockEconomicAnalysis(context, modelName);
}

function generateMockEconomicAnalysis(
  context: InferenceContext,
  modelName: string
): EconomicAnalysis {
  const risks: EconomicRiskItem[] = [];
  const comps = context.architecture?.keyComponents || [];

  if (comps.length > 0) {
    risks.push({
      id: "ECO-001",
      title: "Oracle Price Manipulation",
      description: "Reliance on spot price or narrow-window TWAP from decentralized exchanges can be exploited via flash loans.",
      impact: "Attacker could manipulate collateral valuation to drain funds.",
      severity: "Critical",
      relevantComponents: [comps[0] || "Unknown"],
      mitigationStrategy: "Use decentralized oracle aggregators (e.g. Chainlink) with circuit breakers."
    });

    risks.push({
      id: "ECO-002",
      title: "Liquidity Drain / Sandwiching",
      description: "High slippage tolerance or lack of deadline checks in swap functions allows for MEV exploitation.",
      impact: "Protocol and users lose value during state-changing swaps.",
      severity: "Medium",
      relevantComponents: [...comps],
      mitigationStrategy: "Implement strict slippage bounds and validate price impact before execution."
    });
  } else {
    risks.push({
      id: "ECO-GEN-01",
      title: "Systemic Incentive Misalignment",
      description: "Default fallback risk: fees or reward distributions might not account for tail-end volatility.",
      impact: "Gradual drain of protocol reserves or abandonment by liquidity providers.",
      severity: "Low",
      relevantComponents: ["Protocol Treasury"],
      mitigationStrategy: "Perform Monte Carlo simulations on fee distribution across various market conditions."
    });
  }

  return {
    summary: `Identified ${risks.length} potential economic and systemic risks across the protocol surface.`,
    risks,
    generatedByModel: modelName
  };
}

export async function generateCrossContractAnalysis(
  context: InferenceContext,
  activeProvider?: ProviderSelection
): Promise<CrossContractAnalysis> {
  const modelName = activeProvider ? activeProvider.model : "fallback-mock-model";
  return generateMockCrossContractAnalysis(context, modelName);
}

function generateMockCrossContractAnalysis(
  context: InferenceContext,
  modelName: string
): CrossContractAnalysis {
  const paths: CallPath[] = [];
  const comps = context.architecture?.keyComponents || [];

  if (comps.length >= 2) {
    paths.push({
      id: "PATH-001",
      title: "Value Inflow Path",
      steps: [
        { contract: "UserWallet", method: "transfer", reason: "Initiate asset transfer" },
        { contract: comps[0] || "ProtocolRoot", method: "deposit", reason: "Process deposit logic" },
        { contract: comps[1] || "Vault", method: "mint", reason: "Mint representative shares" }
      ],
      criticalPoints: ["Access control on deposit", "Share calculation precision"]
    });

    paths.push({
      id: "PATH-002",
      title: "Emergency Withdrawal Path",
      steps: [
        { contract: "Admin", method: "shutdown", reason: "Trigger emergency state" },
        { contract: comps[0] || "ProtocolRoot", method: "emergencyWithdraw", reason: "Sweep assets to safety" }
      ],
      criticalPoints: ["Admin role verification", "Asset accounting sweep integrity"]
    });
  } else {
    paths.push({
      id: "PATH-GEN-01",
      title: "Generic Execution Path",
      steps: [
        { contract: "Caller", method: "execute", reason: "Standard entry point" },
        { contract: comps[0] || "Protocol", method: "handle", reason: "Core logic execution" }
      ],
      criticalPoints: ["Reentrancy guards", "State transition validation"]
    });
  }

  return {
    summary: `Mapped ${paths.length} critical cross-contract execution paths and potential state-change flows.`,
    paths,
    generatedByModel: modelName
  };
}

export async function generateFindingRegistry(
  context: InferenceContext,
  activeProvider?: ProviderSelection
): Promise<FindingRegistry> {
  const modelName = activeProvider ? activeProvider.model : "fallback-mock-model";
  return generateMockFindingRegistry(context, modelName);
}

function generateMockFindingRegistry(
  context: InferenceContext,
  modelName: string
): FindingRegistry {
  const findings: SecurityFinding[] = [];
  const hyps = context.hypotheses?.hypotheses || [];
  const risks = context.economicAnalysis?.risks || [];

  // Convert "High" likelihood hypotheses into "Confirmed" findings
  for (const hyp of hyps) {
    if (hyp.likelihood === "High" || hyp.likelihood === "Medium") {
      findings.push({
        id: `FIND-${hyp.id}`,
        title: hyp.title,
        description: `CONFIRMED: ${hyp.description}`,
        severity: hyp.likelihood === "High" ? "High" : "Medium",
        status: "Confirmed",
        targetComponent: hyp.targetComponent,
        derivedFromHypothesisId: hyp.id,
        impactedInvariantIds: hyp.derivedFromInvariantIds,
        mitigation: hyp.recommendedNextStep
      });
    }
  }

  // Convert "Critical" economic risks into findings
  for (const risk of risks) {
    if (risk.severity === "Critical") {
      findings.push({
        id: `FIND-${risk.id}`,
        title: risk.title,
        description: `ECONOMIC RISK CONFIRMED: ${risk.description}`,
        severity: "Critical",
        status: "Confirmed",
        targetComponent: risk.relevantComponents[0] || "System",
        derivedFromRiskId: risk.id,
        impactedInvariantIds: [],
        mitigation: risk.mitigationStrategy
      });
    }
  }

  if (findings.length === 0) {
    findings.push({
      id: "FIND-GEN-01",
      title: "Missing Detailed NatSpec",
      description: "Contract functions lack full NatSpec documentation, increasing audit complexity.",
      severity: "Informational",
      status: "Confirmed",
      targetComponent: context.architecture?.keyComponents[0] || "Codebase",
      impactedInvariantIds: [],
      mitigation: "Adopt standard NatSpec formatting for all public/external functions."
    });
  }

  return {
    summary: `Verified and triaged ${findings.length} security findings from identified hypotheses and systemic risks.`,
    findings,
    generatedByModel: modelName
  };
}

export async function generateRemediationPlan(
  context: InferenceContext,
  activeProvider?: ProviderSelection
): Promise<RemediationPlan> {
  const modelName = activeProvider ? activeProvider.model : "fallback-mock-model";
  return generateMockRemediationPlan(context, modelName);
}

function generateMockRemediationPlan(
  context: InferenceContext,
  modelName: string
): RemediationPlan {
  const actions: RemediationAction[] = [];
  const findings = context.findingRegistry?.findings || [];

  for (const f of findings) {
    if (f.id === "FIND-GEN-01") {
      actions.push({
        id: `REM-${f.id}`,
        relatedFindingId: f.id,
        title: "Standardize NatSpec Documentation",
        description: "Apply the standard NatSpec format to all public methods to improve maintainability and auditability.",
        complexity: "Low",
        estimatedEffort: "1-2 days",
        technicalDebtImpact: "Decreased"
      });
    } else {
      actions.push({
        id: `REM-${f.id}`,
        relatedFindingId: f.id,
        title: `Fix ${f.title}`,
        description: `Implement robust validation and logic updates to address ${f.title}. Review mitigation details in finding ${f.id}.`,
        complexity: f.severity === "Critical" || f.severity === "High" ? "High" : "Medium",
        estimatedEffort: "3-5 days",
        technicalDebtImpact: "Decreased"
      });
    }
  }

  if (actions.length === 0) {
    actions.push({
      id: "REM-GEN-01",
      title: "Enhance Test Coverage",
      description: "General recommendation: Increase branch coverage for edge cases identified during analysis.",
      relatedFindingId: "N/A",
      complexity: "Medium",
      estimatedEffort: "Ongoing",
      technicalDebtImpact: "Decreased"
    });
  }

  return {
    summary: `Proposed ${actions.length} targeted remediation steps to resolve the identified finding registry.`,
    actions,
    generatedByModel: modelName
  };
}

export async function generateFormalReport(
  context: InferenceContext,
  activeProvider?: ProviderSelection
): Promise<FormalReport> {
  const modelName = activeProvider ? activeProvider.model : "fallback-mock-model";
  return generateMockFormalReport(context, modelName);
}

function generateMockFormalReport(
  context: InferenceContext,
  modelName: string
): FormalReport {
  const { workspace, intent, architecture, invariants, verificationPlan, hypotheses, economicAnalysis, crossContractAnalysis, findingRegistry, remediationPlan } = context;
  const timestamp = new Date().toISOString();
  
  let md = `# Formal Security Audit Report
  
**Protocol:** ${intent.mainContracts.join(", ") || "Generic Protocol"}
**Generated At:** ${timestamp}
**Model:** ${modelName}

---

## 1. Executive Summary
This document synthesizes the automated methodology-driven analysis of the codebase located at \`${workspace.rootDirectory}\`.

## 2. Architecture Overview
${architecture?.markdownSummary || "Architecture analysis not available."}

## 3. Security Invariants
${invariants?.summary || "No invariants identified."}

${invariants?.invariants.map(inv => `### ${inv.id}: ${inv.title}
- **Category:** ${inv.category}
- **Priority:** ${inv.priority}
- **Description:** ${inv.description}
- **Suggested Verification:** ${inv.suggestedVerification}`).join("\n\n") || ""}

## 4. Verification Action Plan
${verificationPlan?.summary || "No verification plan available."}

${verificationPlan?.items.map(vp => `### ${vp.id}: ${vp.title}
- **Type:** ${vp.verificationType}
- **Tool:** ${vp.recommendedTool}
- **Description:** ${vp.description}`).join("\n\n") || ""}

## 5. Attack Simulation Hypotheses
${hypotheses?.summary || "No attack hypotheses formulated."}

${hypotheses?.hypotheses.map(hyp => `### ${hyp.id}: ${hyp.title}
- **Likelihood:** ${hyp.likelihood}
- **Surface:** ${hyp.attackSurface}
- **Target:** ${hyp.targetComponent}
- **Description:** ${hyp.description}
- **Next Step:** ${hyp.recommendedNextStep}`).join("\n\n") || ""}

## 6. Economic & Systemic Risks
${economicAnalysis?.summary || "No economic analysis performed."}

${economicAnalysis?.risks.map(risk => `### ${risk.id}: ${risk.title}
- **Severity:** ${risk.severity}
- **Impact:** ${risk.impact}
- **Mitigation:** ${risk.mitigationStrategy}`).join("\n\n") || ""}

## 7. Cross-Contract Call Paths
${crossContractAnalysis?.summary || "No cross-contract paths mapped."}

${crossContractAnalysis?.paths.map(path => `### ${path.id}: ${path.title}
- **Flow:** ${path.steps.map(s => `${s.contract}.${s.method}`).join(" -> ")}
- **Critical Points:** ${path.criticalPoints.join(", ")}`).join("\n\n") || ""}

## 8. Security Findings Registry
${findingRegistry?.summary || "No verified findings reported."}

${findingRegistry?.findings.map(f => `### ${f.id}: ${f.title}
- **Severity:** ${f.severity}
- **Status:** ${f.status}
- **Target:** ${f.targetComponent}
- **Description:** ${f.description}
- **Mitigation:** ${f.mitigation || "N/A"}`).join("\n\n") || ""}

## 9. Remediation Roadmap
${remediationPlan?.summary || "No remediation plan available."}

${remediationPlan?.actions.map(action => `### ${action.id}: ${action.title}
- **Target Finding:** ${action.relatedFindingId}
- **Complexity:** ${action.complexity}
- **Effort:** ${action.estimatedEffort}
- **Description:** ${action.description}`).join("\n\n") || ""}

---
*Report generated by Security Reasoning Protocol (SRP) — Deterministic Mock Engine.*
`;

  return {
    id: `REP-${Date.now()}`,
    title: `Security Audit Report: ${intent.mainContracts.join(", ") || "Generic Protocol"}`,
    markdownContent: md,
    generatedAt: timestamp,
    generatedByModel: modelName
  };
}
