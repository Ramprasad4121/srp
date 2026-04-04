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
      font-family: 'Inter', system-ui, sans-serif;
      box-sizing: border-box;
      position: relative;
      background-color: transparent; /* Inherits from parent */
      color: #000;
      overflow: hidden;
    }

    /* Subtle background glows */
    .glow-top, .glow-bottom {
      position: absolute;
      left: 0;
      right: 0;
      height: 50vh;
      pointer-events: none;
      z-index: 0;
      opacity: 0.6;
    }

    .glow-top {
      top: -20vh;
      background: radial-gradient(ellipse at top, rgba(121, 158, 255, 0.4) 0%, transparent 60%);
    }

    .glow-bottom {
      bottom: -20vh;
      background: radial-gradient(ellipse at bottom, rgba(147, 126, 255, 0.3) 0%, transparent 60%);
    }

    .content-wrapper {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      height: calc(100% - 3rem);
      max-width: 750px;
      margin: 1.5rem auto;
      width: 100%;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 16px;
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.06);
      overflow: hidden;
    }

    /* Chat Area */
    .chat-container {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      padding: 1.5rem 1.5rem 2rem 1.5rem;
      scrollbar-gutter: stable;
    }

    .chat-history {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
    }

    .empty-state {
      text-align: center;
      font-family: 'JetBrains Mono', monospace;
      color: #666;
      margin: auto;
    }

    /* Chat Input Bar */
    .input-container {
      flex-shrink: 0;
      padding: 1rem 0 2rem 0;
    }

    .input-box {
      display: flex;
      align-items: center;
      background: #fff;
      border: 1px solid #000;
      border-radius: 8px;
      padding: 0.5rem 1rem;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.05);
      transition: box-shadow 0.2s ease;
    }

    .input-box.disabled {
      opacity: 0.6;
      pointer-events: none;
    }

    .input-box:focus-within {
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1), 0 0 0 2px rgba(0,0,0,0.1);
    }

    .input-box input {
      flex: 1;
      border: none;
      background: transparent;
      padding: 1rem 0;
      font-size: 1rem;
      font-family: 'Inter', system-ui, sans-serif;
      outline: none;
      color: #000;
    }

    .input-box input::placeholder {
      color: #999;
    }

    .btn-send {
      background: #000;
      color: #fff;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 4px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: background 0.2s ease;
    }

    .btn-send:hover {
      background: #333;
    }

    .btn-send:active {
      transform: scale(0.98);
    }
    
    .loading-indicator {
      display: inline-block;
      width: 1rem;
      height: 1rem;
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
      <div class="glow-top"></div>
      <div class="glow-bottom"></div>
      
      <div class="content-wrapper">
        <main class="chat-container">
          <div class="chat-history">
            ${this._messages.length === 0 
              ? html`<div class="empty-state">${this._isLoading ? 'Connecting to backend...' : 'System idle. Ready for input.'}</div>` 
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
              placeholder=${this._isLoading ? "Waiting for response..." : "Ask AI or input command... (e.g., /scan, /analyze, /audit)"} 
              .value=${this._chatInput}
              @input=${this.handleInput}
              @keydown=${this.handleKeydown}
              ?disabled=${this._isLoading}
            />
            <button class="btn-send" @click=${this.sendMessage} ?disabled=${this._isLoading}>
              ${this._isLoading ? html`<span class="loading-indicator"></span>` : 'Send ↗'}
            </button>
          </div>
        </footer>
      </div>
    `;
  }
}

customElements.define("chat-view", ChatView);
