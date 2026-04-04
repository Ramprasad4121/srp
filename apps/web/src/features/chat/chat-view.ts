import { LitElement, html, css } from "lit";
import { gatewayClient } from "../../api/client.js";
import "./chat-message.js";

export class ChatView extends LitElement {
  static override properties = {
    mode: { type: String },
    _chatInput: { state: true },
    _messages: { state: true },
    _isLoading: { state: true },
    _conversationId: { state: true }
  };

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      font-family: 'JetBrains Mono', 'Roboto Mono', monospace;
      box-sizing: border-box;
      position: relative;
      background-color: transparent;
      color: #000;
      overflow: hidden;
    }

    .content-wrapper {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      height: 100%;
      max-width: 900px;
      margin: 0 auto;
      width: 100%;
      background: #fff;
      border-left: 1px solid #eee;
      border-right: 1px solid #eee;
      overflow: hidden;
    }

    /* x402 Style Header */
    .x402-header {
      padding: 12px 20px;
      border-bottom: 1px solid #eee;
      font-size: 11px;
      display: flex;
      justify-content: space-between;
      letter-spacing: 2px;
      color: #999;
      text-transform: uppercase;
    }

    .status-dot {
      display: inline-block;
      width: 6px;
      height: 6px;
      background: #0052FF;
      border-radius: 50%;
      margin-right: 8px;
    }

    /* Chat Area */
    .chat-container {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      padding: 0;
      scrollbar-width: thin;
      scrollbar-color: #eee #fff;
    }

    .chat-history {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .empty-state {
      text-align: center;
      color: #ccc;
      margin: auto;
      font-size: 13px;
      letter-spacing: 1px;
    }

    /* Chat Input Bar */
    .input-container {
      flex-shrink: 0;
      padding: 24px;
      background: #fff;
      border-top: 1px solid #f5f5f5;
    }

    .input-box {
      display: flex;
      align-items: center;
      background: #fcfcfc;
      border: 1px solid #eee;
      padding: 4px 4px 4px 16px;
      transition: border-color 0.2s ease;
    }

    .input-box.disabled {
      opacity: 0.5;
      pointer-events: none;
    }

    .input-box:focus-within {
      border-color: #ddd;
    }

    .input-box input {
      flex: 1;
      border: none;
      background: transparent;
      padding: 12px 0;
      font-size: 14px;
      font-family: 'JetBrains Mono', monospace;
      outline: none;
      color: #000;
    }

    .input-box input::placeholder {
      color: #bbb;
    }

    .btn-send {
      background: #000;
      color: #fff;
      border: none;
      padding: 10px 20px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: 'JetBrains Mono', monospace;
      text-transform: uppercase;
    }

    .btn-send:hover {
      background: #333;
    }

    .btn-send:active {
      background: #444;
    }
    
    .loading-indicator {
      display: inline-block;
      width: 12px;
      height: 12px;
      border: 2px solid #fff;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;

  declare mode: "auditor" | "developer";
  declare _chatInput: string;
  declare _messages: Array<{id: string, role: "user"|"assistant"|"system", content: string, citations?: any[]}>;
  declare _isLoading: boolean;
  declare _conversationId: string | null;

  constructor() {
    super();
    this.mode = "auditor";
    this._chatInput = "";
    this._messages = [];
    this._isLoading = false;
    this._conversationId = null;
  }

  override async firstUpdated() {
    await this.initConversation();
  }

  async initConversation() {
    try {
      this._isLoading = true;
      const res = await gatewayClient.getConversations();
      if (res.ok && res.data && res.data.length > 0) {
        // Use latest conversation
        const latest = res.data[res.data.length - 1];
        this._conversationId = latest.id;
        this._messages = latest.messages || [];
      } else {
        // Create new
        const createRes = await gatewayClient.createConversation("Default Audit Thread");
        if (createRes.ok) {
          this._conversationId = createRes.data.id;
          this._messages = createRes.data.messages || [];
        }
      }
    } catch (e) {
      console.error("Failed to init conversation", e);
    } finally {
      this._isLoading = false;
      this.scrollToBottom();
    }
  }

  private handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    this._chatInput = target.value;
  }

  private handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  }

  private async sendMessage() {
    if (!this._chatInput.trim() || !this._conversationId || this._isLoading) return;
    
    const content = this._chatInput.trim();
    this._chatInput = "";
    this._isLoading = true;

    // Optimistic UI update
    this._messages = [
      ...this._messages, 
      { id: Date.now().toString(), role: "user", content }
    ];
    this.scrollToBottom();

    try {
      const res = await gatewayClient.addMessage(this._conversationId, content);
      if (res.ok) {
        if (res.data.assistantMessage) {
           this._messages = [
             ...this._messages,
             res.data.assistantMessage
           ];
        }
      } else {
        console.error("Failed to send message", res.error);
        this._messages = [
          ...this._messages,
          { id: "err", role: "system", content: `Error: ${res.error} - ${res.detail}` }
        ];
      }
    } catch (e) {
      console.error("Network failure sending message", e);
    } finally {
      this._isLoading = false;
      this.scrollToBottom();
    }
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
      <div class="content-wrapper">
        <header class="x402-header">
          <div><span class="status-dot"></span>SRP_NETWORK_ACTIVE</div>
          <div>PROTOCOL_V1.0</div>
        </header>

        <main class="chat-container">
          <div class="chat-history">
            ${this._messages.length === 0 
              ? html`<div class="empty-state">${this._isLoading ? 'INITIALIZING_PROTOCOL...' : 'SYSTEM_IDLE: READY_FOR_COMMAND'}</div>` 
              : this._messages.map(msg => html`
                  <chat-message .role=${msg.role} .content=${msg.content}></chat-message>
                `)
            }
          </div>
        </main>

        <footer class="input-container">
          <div class="input-box ${this._isLoading ? 'disabled' : ''}">
            <input 
              type="text" 
              placeholder=${this._isLoading ? "WAITING_FOR_RESPONSE..." : "EXECUTE_COMMAND (e.g., /scan, /analyze, /audit)..."} 
              .value=${this._chatInput}
              @input=${this.handleInput}
              @keydown=${this.handleKeydown}
              ?disabled=${this._isLoading}
            />
            <button class="btn-send" @click=${this.sendMessage} ?disabled=${this._isLoading}>
              ${this._isLoading ? html`<span class="loading-indicator"></span>` : html`↵`}
            </button>
          </div>
        </footer>
      </div>
    `;
  }

}

customElements.define("chat-view", ChatView);
