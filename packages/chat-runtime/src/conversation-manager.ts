import type { ChatMessage, Conversation, ConversationMetadata, ChatRole } from "@srp/shared-types";
import { randomUUID } from "node:crypto";

export class ConversationManager {
  private readonly conversations: Map<string, Conversation> = new Map();

  create(title: string, runId?: string, projectId?: string): Conversation {
    const now = new Date().toISOString();
    const id = `conv_${randomUUID()}`;
    const conversation: Conversation = {
      id,
      title,
      createdAt: now,
      updatedAt: now,
      ...(runId ? { runId } : {}),
      ...(projectId ? { projectId } : {}),
      messages: []
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  get(id: string): Conversation | undefined {
    return this.conversations.get(id);
  }

  list(): readonly ConversationMetadata[] {
    return Array.from(this.conversations.values()).map(({ messages, ...meta }) => meta);
  }

  addMessage(
    id: string,
    role: ChatRole,
    content: string,
    options: {
      readonly citations?: ChatMessage["citations"];
      readonly toolCalls?: ChatMessage["toolCalls"];
    } = {}
  ): ChatMessage | undefined {
    const conversation = this.conversations.get(id);
    if (!conversation) return undefined;

    const message: ChatMessage = {
      id: `msg_${randomUUID()}`,
      role,
      content,
      createdAt: new Date().toISOString(),
      ...(options.citations ? { citations: options.citations } : {}),
      ...(options.toolCalls ? { toolCalls: options.toolCalls } : {})
    };

    const updated: Conversation = {
      ...conversation,
      messages: [...conversation.messages, message],
      updatedAt: new Date().toISOString()
    };

    this.conversations.set(id, updated);
    return message;
  }

  delete(id: string): boolean {
    return this.conversations.delete(id);
  }
}
