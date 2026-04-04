import { LitElement, html, css } from "lit";

export class ChatMessage extends LitElement {
  static override properties = {
    role: { type: String },
    content: { type: String }
  };

  static override styles = css`
    :host {
      display: block;
      margin-bottom: 2.5rem;
      animation: fadeIn 0.3s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .message-container {
      display: flex;
      gap: 1.25rem;
    }

    .avatar {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 14px;
      font-weight: 700;
    }

    .avatar-user {
      background: #f3f4f6;
      color: #6b7280;
      border: 1px solid #e5e7eb;
    }

    .avatar-assistant {
      background: #111827;
      color: #fff;
    }

    .avatar-system {
      background: #fef3c7;
      color: #d97706;
    }

    .body {
      flex: 1;
      min-width: 0;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
    }

    .name {
      font-size: 13px;
      font-weight: 700;
      color: #111827;
    }

    .time {
      font-size: 11px;
      color: #9ca3af;
      font-weight: 500;
    }

    .content {
      font-size: 15px;
      line-height: 1.6;
      color: #374151;
      white-space: pre-wrap;
      word-break: break-word;
    }

    /* Markdown-ish styling */
    .content code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      background: #f3f4f6;
      padding: 2px 4px;
      border-radius: 4px;
      color: #111827;
    }

    .content pre {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      margin: 1rem 0;
    }

    .content pre code {
      background: transparent;
      padding: 0;
    }

    .tool-call {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: #f0f7ff;
      border: 1px solid #cce3ff;
      color: #0052FF;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      margin: 0.5rem 0;
      font-family: 'JetBrains Mono', monospace;
    }
  `;

  declare role: "user" | "assistant" | "system";
  declare content: string;

  constructor() {
    super();
    this.role = "user";
    this.content = "";
  }

  override render() {
    let name = this.role === 'assistant' ? 'SRP Agent' : 'You';
    if (this.role === 'system') name = 'Protocol System';
    
    const isTool = this.content.startsWith('[TOOL:');
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return html`
      <div class="message-container">
        <div class="avatar avatar-${this.role}">
          ${this.role === 'assistant' ? 'S' : (this.role === 'system' ? 'P' : 'U')}
        </div>
        <div class="body">
          <div class="header">
            <span class="name">${name}</span>
            <span class="time">${timestamp}</span>
          </div>
          ${isTool 
            ? html`<div class="tool-call">🛠️ ${this.content}</div>`
            : html`<div class="content">${this.content}</div>`
          }
        </div>
      </div>
    `;
  }


}

customElements.define("chat-message", ChatMessage);
