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
    _webSearchEnabled: { state: true }
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
      mask-image: linear-gradient(to bottom, transparent, black 40px, black calc(100% - 120px), transparent);
      -webkit-mask-image: linear-gradient(to bottom, transparent, black 40px, black calc(100% - 120px), transparent);
    }



    .gear-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: #9ca3af;
      padding: 0.5rem;
      border-radius: 8px;
      display: flex;
      align-items: center;
      transition: all 0.2s;
      margin-bottom: 4px;
    }

    .gear-btn:hover {
      color: #111827;
      background: #f3f4f6;
    }

    .settings-overlay {
      position: absolute;
      bottom: 110px;
      right: 1.5rem;
      width: 260px;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(229, 231, 235, 0.5);
      border-radius: 14px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      z-index: 100;
      padding: 0.6rem;
      overflow: hidden;
    }

    .settings-item {
      padding: 0.75rem 1rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      color: #4b5563;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: all 0.15s;
    }

    .settings-item:hover {
      background: #f9fafb;
      color: #111827;
    }

    .settings-item.danger {
      color: #ef4444;
    }

    .settings-item.danger:hover {
      background: #fef2f2;
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
      padding: 2.5rem 1.5rem 2.5rem 1.5rem;
      z-index: 10;
      pointer-events: none;
    }

    .input-container {
      max-width: 800px;
      margin: 0 auto;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 20px;
      box-shadow: 0 12px 24px -6px rgba(0, 0, 0, 0.1), 0 4px 8px -4px rgba(0, 0, 0, 0.05);
      padding: 0.6rem;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: auto;
    }

    .input-container:focus-within {
      border-color: rgba(0, 82, 255, 0.3);
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 82, 255, 0.1);
      transform: translateY(-2px);
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

    .search-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 600;
      color: #0088ff;
      background: rgba(0, 136, 255, 0.08);
      padding: 4px 10px;
      border-radius: 8px;
      margin-left: 12px;
      margin-bottom: 8px;
      border: 1px solid rgba(0, 136, 255, 0.2);
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
    /* Neural Loading State */
    .neural-pulse {
      display: flex;
      gap: 6px;
      padding: 1.5rem 0;
      align-items: center;
    }

    .neural-dot {
      width: 6px;
      height: 6px;
      background: #0052FF;
      border-radius: 50%;
      opacity: 0.3;
      filter: blur(1px);
      animation: neuralPulse 1.8s infinite ease-in-out;
    }

    .neural-dot:nth-child(2) { animation-delay: 0.6s; }
    .neural-dot:nth-child(3) { animation-delay: 1.2s; }

    @keyframes neuralPulse {
      0%, 100% { transform: scale(1); opacity: 0.2; filter: blur(1px); }
      50% { transform: scale(1.5); opacity: 0.8; filter: blur(0px); box-shadow: 0 0 12px rgba(0, 82, 255, 0.4); }
    }
  `;

  declare mode: "auditor" | "developer";
  declare _chatInput: string;
  declare _messages: Array<{id: string, role: "user"|"assistant"|"system", content: string, citations?: any[]}>;
  declare _isLoading: boolean;
  declare _conversationId: string | null;
  declare _showSettings: boolean;
  declare _webSearchEnabled: boolean;

  constructor() {
    super();
    this.mode = "auditor";
    this._chatInput = "";
    this._messages = [];
    this._isLoading = false;
    this._conversationId = null;
    this._showSettings = false;
    this._webSearchEnabled = true; // Default to ON as requested
  }

  async resetConversation() {
    if (confirm("Are you sure you want to clear your current history and start a new audit session?")) {
      try {
        this._isLoading = true;
        const createRes = await gatewayClient.createConversation("New Analysis");
        if (createRes.ok) {
          this._conversationId = createRes.data.id;
          this._messages = createRes.data.messages || [];
          this._showSettings = false;
        }
      } catch (e) {
        console.error("Failed to reset conversation", e);
      } finally {
        this._isLoading = false;
      }
    }
  }

  toggleSettings() {
    this._showSettings = !this._showSettings;
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

    // Local state first for responsiveness
    const userMsg = { id: Date.now().toString(), role: "user" as const, content };
    this._messages = [...this._messages, userMsg];
    this.scrollToBottom();

    try {
      const res = await gatewayClient.addMessage(this._conversationId, content, { searchEnabled: this._webSearchEnabled });
      if (res.ok && res.data.assistantMessage) {
        // We replace or append. The server response is the source of truth.
        // If the server returns full history, we use it. 
        // For now, we append the specific assistant message.
        this._messages = [...this._messages, res.data.assistantMessage];
      } else if (!res.ok) {
        this._messages = [...this._messages, { id: "err", role: "system" as const, content: `System Error: ${res.error}` }];
      }
    } catch (e) {
      console.error("Network failure", e);
      this._messages = [...this._messages, { id: "err", role: "system" as const, content: "Network failure. Check gateway connection." }];
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
      ${this._showSettings ? html`
        <div class="settings-overlay">
          <div class="settings-item" style="justify-content: space-between;" @click=${() => this._webSearchEnabled = !this._webSearchEnabled}>
             <div style="display: flex; align-items: center; gap: 10px;">
                <span>🌐</span> Web Search
             </div>
             <div style="width: 32px; height: 18px; background: ${this._webSearchEnabled ? '#0052FF' : '#d1d5db'}; border-radius: 100px; position: relative; transition: all 0.2s;">
                <div style="width: 14px; height: 14px; background: #fff; border-radius: 50%; position: absolute; top: 2px; left: ${this._webSearchEnabled ? '16px' : '2px'}; transition: all 0.2s;"></div>
             </div>
          </div>
          <div class="settings-item" @click=${() => alert(`Role: ${this.mode}. Performance optimized.`)}>
             <span>👤</span> Persona: Security Senior
          </div>
          <div class="settings-item danger" @click=${this.resetConversation}>
            <span>🗑️</span> Reset History
          </div>
        </div>
      ` : ''}

      <main class="chat-layout">
        <div class="message-list">
          ${this._messages.length === 0 
            ? html`
              <div class="empty-state">
                <div class="empty-title">SRP Senior Analysis</div>
                <p class="empty-subtitle">
                   Real-time vulnerability reconnaissance and protocol auditing is active. Your session history is automatically preserved across modules.
                </p>
              </div>` 
            : this._messages.map(msg => html`
                <chat-message .role=${msg.role} .content=${msg.content} .citations=${msg.citations}></chat-message>
              `)
          }
          
          ${this._isLoading ? html`
            <div class="neural-pulse">
              <div class="neural-dot"></div>
              <div class="neural-dot"></div>
              <div class="neural-dot"></div>
            </div>
          ` : ''}
        </div>
      </main>

      <div class="input-wrapper">
        <div class="input-container">
          <div class="quick-actions">
            <div class="action-chip" @click=${() => this.sendMessage("/scan scope")}>/scan scope</div>
            <div class="action-chip" @click=${() => this.sendMessage("/list contracts")}>/list contracts</div>
            <div class="action-chip" @click=${() => this.sendMessage("Analyze Trust Boundaries")}>Analyze Trust Boundaries</div>
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
            <button class="gear-btn" @click=${this.toggleSettings}>
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </button>
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
