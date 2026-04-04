import type { IncomingMessage, ServerResponse } from "node:http";
import { chatManager } from "../runtime/chat-manager.js";
import { readJsonBody, sendError, sendJson } from "../http-utils.js";
import { generateChatResponse } from "../runtime/providers/inference-bridge.js";
import { getSessionState } from "../runtime/session-manager.js";
import { loadOrCreateSetupManifest } from "@srp/config";
import { buildChatGroundingContext } from "../runtime/chat-grounding.js";

export async function handleListConversations(
  _req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const list = chatManager.list();
  sendJson(res, 200, list);
}

export async function handleCreateConversation(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await readJsonBody<{ title: string; runId?: string; projectId?: string }>(req);
  if (!body || !body.title) {
    sendError(res, 400, "bad_request", "title is required");
    return;
  }

  const sessionState = getSessionState();
  const conversation = chatManager.create(
    body.title,
    body.runId ?? sessionState.runId ?? undefined,
    body.projectId
  );
  sendJson(res, 201, conversation);
}

export async function handleGetConversation(
  _req: IncomingMessage,
  res: ServerResponse,
  params: { id: string }
): Promise<void> {
  const conversation = chatManager.get(params.id);
  if (!conversation) {
    sendError(res, 404, "not_found", `Conversation ${params.id} not found`);
    return;
  }

  sendJson(res, 200, conversation);
}

export async function handleAddMessage(
  req: IncomingMessage,
  res: ServerResponse,
  params: { id: string },
  config: { rootDirectory: string }
): Promise<void> {
  const body = await readJsonBody<{ content: string }>(req);
  if (!body || !body.content) {
    sendError(res, 400, "bad_request", "content is required");
    return;
  }

  const userMessage = chatManager.addMessage(params.id, "user", body.content);
  if (!userMessage) {
    sendError(res, 404, "not_found", `Conversation ${params.id} not found`);
    return;
  }

  // Generate response
  const conversation = chatManager.get(params.id)!;
  const sessionState = getSessionState();
  const manifest = await loadOrCreateSetupManifest(config.rootDirectory);
  
  // Choose first enabled provider
  const activeProvider = manifest.state.providers.find(p => p.enabled);

  try {
    const grounding = await buildChatGroundingContext(conversation, sessionState, body.content);
    const assistantResponse = await generateChatResponse(
      conversation,
      sessionState,
      manifest.state.role,
      grounding,
      activeProvider
    );

    const assistantMessage = chatManager.addMessage(params.id, "assistant", assistantResponse.content, {
      citations: assistantResponse.citations
    });
    sendJson(res, 201, {
      userMessage,
      assistantMessage
    });
  } catch (err) {
    console.error("Failed to generate chat response:", err);
    sendError(res, 500, "internal_error", "Failed to generate chat response");
  }
}
