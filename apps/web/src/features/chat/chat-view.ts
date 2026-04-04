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
      height: 100%;
      font-family: 'Inter', system-ui, sans-serif;
      background: #ffffff;
      color: #111827;
      overflow: hidden;
    }

    .chat-layout {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      scroll-behavior: smooth;
      padding-top: 2rem;
    }

    /* Centered content column */
    .message-list {
      flex: 1;
      max-width: 800px;
      margin: 0 auto;
      width: 100%;
      padding: 0 1.5rem 10rem 1.5rem;
      display: flex;
      flex-direction: column;
    }

    .empty-state {
      margin: auto;
      text-align: center;
      padding: 4rem 2rem;
    }

    .empty-title {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 0.5rem;
    }

    .empty-subtitle {
      font-size: 0.875rem;
      color: #6b7280;
      max-width: 400px;
      margin: 0 auto;
    }

    /* Action bar / Input */
    .input-wrapper {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(to top, #ffffff 70%, transparent);
      padding: 2rem 1.5rem 2rem 1.5rem;
      z-index: 10;
    }

    .input-container {
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      padding: 0.5rem;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .input-container:focus-within {
      border-color: #0052FF;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 0 0 3px rgba(0, 82, 255, 0.1);
    }

    .input-row {
      display: flex;
      align-items: flex-end;
      gap: 0.5rem;
    }

    textarea {
      flex: 1;
      border: none;
      background: transparent;
      padding: 0.75rem 1rem;
      font-size: 0.9375rem;
      font-family: inherit;
      line-height: 1.5;
      outline: none;
      resize: none;
      max-height: 200px;
      color: #111827;
    }

    textarea::placeholder {
      color: #9ca3af;
    }

    .btn-send {
      background: #111827;
      color: #fff;
      border: none;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.1s, background 0.2s;
      flex-shrink: 0;
      margin-bottom: 4px;
      margin-right: 4px;
    }

    .btn-send:hover {
      background: #374151;
    }

    .btn-send:active {
      transform: scale(0.95);
    }

    .btn-send:disabled {
      background: #f3f4f6;
      color: #d1d5db;
      cursor: not-allowed;
    }

    /* Quick suggestions */
    .quick-actions {
      display: flex;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      overflow-x: auto;
    }

    .action-chip {
      font-size: 11px;
      font-weight: 600;
      background: #f3f4f6;
      color: #4b5563;
      padding: 4px 10px;
      border-radius: 6px;
      white-space: nowrap;
      cursor: pointer;
      border: 1px solid transparent;
    }

    .action-chip:hover {
      background: #e5e7eb;
      color: #111827;
    }

    /* Loading state */
    .loading-dots {
      display: flex;
      gap: 4px;
      padding: 1rem;
    }

    .dot {
      width: 6px;
      height: 6px;
      background: #d1d5db;
      border-radius: 50%;
      animation: bounce 1.4s infinite ease-in-out;
    }

    .dot:nth-child(1) { animation-delay: -0.32s; }
    .dot:nth-child(2) { animation-delay: -0.16s; }

    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
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
        const latest = res.data[res.data.length - 1];
        this._conversationId = latest.id;
        this._messages = latest.messages || [];
      } else {
        const createRes = await gatewayClient.createConversation("New Analysis");
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
    
    this._chatInput = "";
    // Reset height if it was a textarea event
    const textarea = this.shadowRoot?.querySelector('textarea');
    if (textarea) textarea.style.height = 'auto';

    this._isLoading = true;

    this._messages = [
      ...this._messages, 
      { id: Date.now().toString(), role: "user", content }
    ];
    this.scrollToBottom();

    try {
      const res = await gatewayClient.addMessage(this._conversationId, content);
      if (res.ok && res.data.assistantMessage) {
        this._messages = [...this._messages, res.data.assistantMessage];
      } else if (!res.ok) {
        this._messages = [...this._messages, { id: "err", role: "system", content: `System Error: ${res.error}` }];
      }
    } catch (e) {
      console.error("Network failure", e);
    } finally {
      this._isLoading = false;
      this.scrollToBottom();
    }
  }
  
  private scrollToBottom() {
    setTimeout(() => {
      const layout = this.shadowRoot?.querySelector('.chat-layout');
      if (layout) {
         layout.scrollTop = layout.scrollHeight;
      }
    }, 50);
  }

  override render() {
    return html`
      <main class="chat-layout">
        <div class="message-list">
          ${this._messages.length === 0 
            ? html`
              <div class="empty-state">
                <div class="empty-title">Secure Reasoning Protocol</div>
                <p class="empty-subtitle">
                  Ask me to audit a contract, explain architecture, or generate exploit proofs. I'm connected to your local workspace and the internet.
                </p>
              </div>` 
            : this._messages.map(msg => html`
                <chat-message .role=${msg.role} .content=${msg.content}></chat-message>
              `)
          }
          
          ${this._isLoading ? html`
            <div class="loading-dots">
              <div class="dot"></div>
              <div class="dot"></div>
              <div class="dot"></div>
            </div>
          ` : ''}
        </div>
      </main>

      <div class="input-wrapper">
        <div class="input-container">
          <div class="quick-actions">
            <div class="action-chip" @click=${() => this.sendMessage("/scan scope")}>/scan scope</div>
            <div class="action-chip" @click=${() => this.sendMessage("/list contracts")}>/list contracts</div>
            <div class="action-chip" @click=${() => this.sendMessage("Explain trust boundaries")}>Explain trust boundaries</div>
          </div>
          <div class="input-row">
            <textarea 
              rows="1"
              placeholder="Message SRP Agent..." 
              .value=${this._chatInput}
              @input=${this.handleInput}
              @keydown=${this.handleKeydown}
              ?disabled=${this._isLoading}
            ></textarea>
            <button class="btn-send" @click=${() => this.sendMessage()} ?disabled=${this._isLoading || !this._chatInput.trim()}>
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }


}

customElements.define("chat-view", ChatView);
