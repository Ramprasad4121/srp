export type ChatIntentType = "web_search" | "audit_context" | "read_code" | "general";

export interface ChatIntent {
  readonly type: ChatIntentType;
  readonly query?: string;
}

/**
 * Heuristic intent detector for security chat.
 */
export function detectIntent(message: string, mode: string = "auto"): ChatIntent {
  const msg = message.toLowerCase();

  // 1. Web Search Intent
  if (mode === "search" || msg.startsWith("search:") || msg.includes("find online")) {
    const query = message.replace(/^search:\s*/i, "").trim();
    return { type: "web_search", query: query || message };
  }

  // 2. Audit Context Intent
  const auditKeywords = ["finding", "vulnerability", "audit", "score", "report", "issue"];
  if (mode === "audit" || auditKeywords.some(kw => msg.includes(inv(kw)))) {
    return { type: "audit_context" };
  }

  // 3. Read Code Intent
  const codeKeywords = ["function", "contract", "line", "how does", "logic", "code", "implementation"];
  if (mode === "code" || codeKeywords.some(kw => msg.includes(inv(kw)))) {
    return { type: "read_code" };
  }

  return { type: "general" };
}

function inv(kw: string): string {
  return kw.toLowerCase();
}
