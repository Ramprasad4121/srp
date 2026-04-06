import { LitElement, html, css } from "lit";
import { gatewayClient } from "../../api/client.js";
import "./chat-message.js";

export class ChatView extends LitElement {
  static override properties = {
    mode: { type: String },
    _chatInput: { state: true },
    _messages: { state: true },
    _isLoading: { state: true },
    _conversationId: { state: true },
    _showSettings: { state: true },
    _webSearchEnabled: { state: true },
    _attachedFile: { state: true }
  };

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #ffffff;
      color: #111827;
      overflow: hidden;
      font-family: 'Inter', system-ui, sans-serif;
    }

    /* Header Styling */
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #f3f4f6;
      background: #fff;
      z-index: 30;
    }

    .header-title {
      font-size: 13px;
      font-weight: 700;
      color: #111827;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .header-actions {
      display: flex;
      gap: 0.25rem;
    }

    .icon-btn {
      background: none;
      border: none;
      padding: 0.5rem;
      border-radius: 6px;
      color: #6b7280;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .icon-btn:hover {
      background: #f3f4f6;
      color: #111827;
    }

    /* Message List Area */
    .chat-container {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      padding: 1.5rem 1rem;
      scroll-behavior: smooth;
    }

    .message-list {
      display: flex;
      flex-direction: column;
      max-width: 800px;
      margin: 0 auto;
      width: 100%;
    }

    /* Empty State */
    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 2rem;
      color: #6b7280;
    }

    .empty-icon {
      font-size: 2.5rem;
      margin-bottom: 1rem;
      opacity: 0.5;
    }

    .empty-title {
      font-size: 1.1rem;
      font-weight: 700;
      color: #111827;
      margin-bottom: 0.5rem;
    }

    .empty-desc {
      font-size: 0.875rem;
      max-width: 280px;
      line-height: 1.5;
    }

    /* Input Area Styling */
    .input-area {
      padding: 1rem;
      border-top: 1px solid #f3f4f6;
      background: #fff;
      display: flex;
      justify-content: center;
    }

    .input-box {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 0.5rem;
      display: flex;
      flex-direction: column;
      transition: all 0.2s;
      width: 100%;
      max-width: 800px;
    }

    .input-box:focus-within {
      border-color: #0052FF;
      background: #fff;
      box-shadow: 0 0 0 3px rgba(0, 82, 255, 0.1);
    }

    .textarea-wrapper {
      display: flex;
      padding: 0.25rem 0.5rem;
    }

    textarea {
      flex: 1;
      border: none;
      background: transparent;
      padding: 0.5rem 0;
      font-size: 14px;
      font-family: inherit;
      line-height: 1.5;
      outline: none;
      resize: none;
      max-height: 160px;
      color: #111827;
    }

    textarea::placeholder {
      color: #9ca3af;
    }

    .input-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.25rem 0.5rem;
    }

    .btn-send {
      background: #0052FF;
      color: #fff;
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-send:hover:not(:disabled) {
      background: #0041cc;
      transform: scale(1.05);
    }

    .btn-send:disabled {
      background: #e5e7eb;
      color: #9ca3af;
      cursor: not-allowed;
    }

    .search-toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 8px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .search-toggle.active {
      background: #eff6ff;
      color: #0052FF;
    }

    .search-toggle.inactive {
      background: #f3f4f6;
      color: #6b7280;
    }

    /* Quick Actions Chips */
    .quick-actions {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
      overflow-x: auto;
      padding-bottom: 2px;
    }

    .quick-actions::-webkit-scrollbar {
      display: none;
    }

    .action-chip {
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      color: #4b5563;
      white-space: nowrap;
      cursor: pointer;
      transition: all 0.15s;
    }

    .action-chip:hover {
      background: #fff;
      border-color: #0052FF;
      color: #0052FF;
    }

    /* Settings Menu Popover */
    .settings-menu {
      position: absolute;
      top: 3.5rem;
      right: 1rem;
      width: 220px;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
      z-index: 100;
      padding: 0.5rem;
      animation: popIn 0.2s ease-out;
    }

    @keyframes popIn {
      from { opacity: 0; transform: scale(0.95) translateY(-10px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    .menu-item {
      padding: 0.6rem 0.75rem;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      color: #4b5563;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      cursor: pointer;
      transition: all 0.15s;
    }

    .menu-item:hover {
      background: #f9fafb;
      color: #111827;
    }

    .menu-item.danger {
      color: #ef4444;
    }

    .menu-item.danger:hover {
      background: #fef2f2;
    }

    .menu-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.4rem 0.75rem;
      border-bottom: 1px solid #f3f4f6;
      margin-bottom: 0.25rem;
    }

    .menu-title {
      font-size: 11px;
      font-weight: 700;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .menu-close {
      background: none;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      padding: 4px;
      display: flex;
      border-radius: 4px;
    }

    .menu-close:hover {
      background: #f3f4f6;
      color: #111827;
    }

    /* Loading state */
    .loading-pulse {
      display: flex;
      gap: 4px;
      padding: 1rem 0;
      align-self: flex-start;
    }

    .pulse-dot {
      width: 6px;
      height: 6px;
      background: #0052FF;
      border-radius: 50%;
      animation: pulseAnim 1.4s infinite ease-in-out both;
    }

    .pulse-dot:nth-child(1) { animation-delay: -0.32s; }
    .pulse-dot:nth-child(2) { animation-delay: -0.16s; }

    @keyframes pulseAnim {
      0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
      40% { transform: scale(1); opacity: 1; }
    }
  `;

  declare mode: "auditor" | "developer";
  declare _chatInput: string;
  declare _messages: Array<{id: string, role: "user"|"assistant"|"system", content: string, citations?: any[]}>;
  declare _isLoading: boolean;
  declare _conversationId: string | null;
  declare _showSettings: boolean;
  declare _webSearchEnabled: boolean;
  declare _attachedFile: { name: string, content: string } | null;

  constructor() {
    super();
    this.mode = "auditor";
    this._chatInput = "";
    this._messages = [];
    this._showSettings = false;
    this._webSearchEnabled = true;
    this._attachedFile = null;
  }

  override async firstUpdated() {
    await this.initConversation();
  }

  async initConversation() {
    try {
      this._isLoading = true;
      const res = await gatewayClient.getConversations();
      if (res.ok && res.data && res.data.length > 0) {
        const latest = res.data[res.data.length - 1];
        this._conversationId = latest.id;
        this._messages = latest.messages || [];
      } else {
        await this.createNewConversation();
      }
    } catch (e) {
      console.error("Failed to init conversation", e);
    } finally {
      this._isLoading = false;
      this.scrollToBottom();
    }
  }

  async createNewConversation() {
    try {
      const createRes = await gatewayClient.createConversation("New Analysis");
      if (createRes.ok) {
        this._conversationId = createRes.data.id;
        this._messages = createRes.data.messages || [];
      }
    } catch (e) {
      console.error("Failed to create conversation", e);
    }
  }

  async resetConversation() {
    if (confirm("Reset current audit chat? Your session history will be preserved in artifacts.")) {
      this._showSettings = false;
      this._isLoading = true;
      await this.createNewConversation();
      this._isLoading = false;
    }
  }

  async exportChat() {
    const markdown = this._messages
      .map(m => `### ${m.role.toUpperCase()}\n\n${m.content}\n`)
      .join("\n---\n\n");
    
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `srp-chat-export-${new Date().toISOString().slice(0,10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    this._chatInput = target.value;
    
    // Auto-resize
    target.style.height = 'auto';
    target.style.height = `${target.scrollHeight}px`;
  }

  private handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  }

  private async sendMessage(text?: string) {
    const content = text || this._chatInput.trim();
    if (!content || !this._conversationId || this._isLoading) return;
    
    const mode = this._webSearchEnabled ? "search" : "auto";
    this._chatInput = "";
    const textarea = this.shadowRoot?.querySelector('textarea');
    if (textarea) textarea.style.height = 'auto';

    this._isLoading = true;

    // 1. Add user message
    const userMsg = { id: Date.now().toString(), role: "user" as const, content };
    this._messages = [...this._messages, userMsg];
    
    // 2. Add empty assistant message for streaming
    const assistantId = (Date.now() + 1).toString();
    this._messages = [...this._messages, { id: assistantId, role: "assistant" as const, content: "" }];
    this.scrollToBottom();

    const fileContent = this._attachedFile ? `\n\n[ATTACHED_FILE: ${this._attachedFile.name}]\n${this._attachedFile.content.slice(0, 5000)}` : "";
    const fullContent = content + fileContent;
    this._attachedFile = null; // Clear after sending

    try {
      const response = await fetch(`/api/chat/conversations/${this._conversationId}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: fullContent, mode })
      });

      if (!response.ok) throw new Error("Stream request failed");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");
          
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.text) {
                  assistantText += data.text;
                  // Update the last message in real-time
                  this._messages = this._messages.map(m => 
                    m.id === assistantId ? { ...m, content: assistantText } : m
                  );
                }
                if (data.done) break;
              } catch (e) {
                // Ignore parse errors for partial chunks
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("Streaming failure", e);
      this._messages = [...this._messages, { 
        id: "err", 
        role: "system" as const, 
        content: "Connection failed. Please check your gateway." 
      }];
    } finally {
      this._isLoading = false;
      this.scrollToBottom();
    }
  }
  
  private async handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      this._attachedFile = { name: file.name, content };
      console.log(`File attached: ${file.name}`);
      this._chatInput = `Analyzing ${file.name}...\n` + this._chatInput;
    };
    reader.readAsText(file);
  }

  private scrollToBottom() {
    setTimeout(() => {
      const container = this.shadowRoot?.querySelector('.chat-container');
      if (container) {
         container.scrollTop = container.scrollHeight;
      }
    }, 50);
  }

  override render() {
    return html`
      <header>
        <div class="header-title">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
          </svg>
          SRP INTELLIGENCE
        </div>
        <div class="header-actions">
          <button class="icon-btn" title="Export Chat" @click=${this.exportChat}>
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
          </button>
          <button class="icon-btn" title="New Session" @click=${this.resetConversation}>
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
          </button>
          <button class="icon-btn" title="Settings" @click=${() => this._showSettings = !this._showSettings}>
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </button>
        </div>
      </header>

      ${this._showSettings ? html`
        <div class="settings-menu">
          <div class="menu-header">
            <span class="menu-title">Settings</span>
            <button class="menu-close" @click=${() => this._showSettings = false}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="menu-item" @click=${() => this._webSearchEnabled = !this._webSearchEnabled}>
            <span>🌐</span> 
            <span style="flex: 1;">Search Enabled</span>
            <div style="width: 24px; height: 14px; background: ${this._webSearchEnabled ? '#0052FF' : '#d1d5db'}; border-radius: 10px; position: relative;">
              <div style="width: 10px; height: 10px; background: #fff; border-radius: 50%; position: absolute; top: 2px; left: ${this._webSearchEnabled ? '12px' : '2px'}; transition: all 0.2s;"></div>
            </div>
          </div>
          <div class="menu-item" @click=${() => alert('SRP Persona: Senior Security Auditor')}>
            <span>👤</span> Senior Persona
          </div>
          <div class="menu-item danger" @click=${this.resetConversation}>
            <span>🗑️</span> Reset History
          </div>
        </div>
      ` : ''}

      <div class="chat-container">
        ${this._messages.length === 0 
          ? html`
            <div class="empty-state">
              <div class="empty-icon">🛡️</div>
              <div class="empty-title">Secure Reasoning Protocol</div>
              <div class="empty-desc">
                Your high-context companion for security analysis. 
                Ask me about invariants, codebase intent, or vulnerability surface.
              </div>
            </div>` 
          : html`
            <div class="message-list">
              ${this._messages.map(msg => html`
                <chat-message .role=${msg.role} .content=${msg.content} .citations=${msg.citations}></chat-message>
              `)}
              
              ${this._isLoading ? html`
                <div class="loading-pulse">
                  <div class="pulse-dot"></div>
                  <div class="pulse-dot"></div>
                  <div class="pulse-dot"></div>
                </div>
              ` : ''}
            </div>
          `
        }
      </div>

      <div class="input-area">
        <div class="input-box">
          <div class="textarea-wrapper">
            <textarea 
              rows="1"
              placeholder="Message SRP..." 
              .value=${this._chatInput}
              @input=${this.handleInput}
              @keydown=${this.handleKeydown}
              ?disabled=${this._isLoading}
            ></textarea>
          </div>
          <div class="input-footer">
            <div style="display: flex; gap: 8px;">
              <input type="file" id="fileInput" hidden @change=${this.handleFileChange} accept=".sol,.md,.pdf,.txt,.ts,.js">
              <div class="icon-btn" title="Attach File" @click=${() => (this.shadowRoot?.getElementById('fileInput') as HTMLInputElement).click()}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 11-2.828-2.828l6.414-6.586a4 2 0 015.656 5.656l-6.415 6.585a6 6 0 11-8.486-8.486L10.5 3.5"/>
                </svg>
              </div>
              <div class="search-toggle ${this._webSearchEnabled ? 'active' : 'inactive'}" @click=${() => this._webSearchEnabled = !this._webSearchEnabled}>
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
                </svg>
                Search
              </div>
            </div>
            <button class="btn-send" @click=${() => this.sendMessage()} ?disabled=${this._isLoading || !this._chatInput.trim()}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define("chat-view", ChatView);
