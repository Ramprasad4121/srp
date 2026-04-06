import { LitElement, html, css } from "lit";

export class ChatMessage extends LitElement {
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

    .citation-list {
      margin-top: 1rem;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .citation-item {
      font-size: 12px;
      color: #6b7280;
      display: flex;
      align-items: flex-start;
      gap: 6px;
      background: #f9fafb;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }

    .citation-index {
      background: #e5e7eb;
      color: #374151;
      width: 16px;
      height: 16px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 800;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .citation-link {
      color: #0052FF;
      text-decoration: none;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .citation-link:hover {
      text-decoration: underline;
    }
  `;

  static override properties = {
    role: { type: String },
    content: { type: String },
    citations: { type: Array }
  };

  declare role: "user" | "assistant" | "system";
  declare content: string;
  declare citations?: any[];

  constructor() {
    super();
    this.role = "user";
    this.content = "";
    this.citations = [];
  }

  override render() {
    let name = this.role === 'assistant' ? 'SRP Agent' : 'You';
    if (this.role === 'system') name = 'Protocol System';
    
    // Filter out internal jargon like [TOOL: ...] from final display
    let displayContent = this.content;
    const isTool = this.content.startsWith('[TOOL:');
    
    if (this.role === 'assistant' && !isTool) {
      displayContent = this.content.replace(/\[TOOL: [^\]]+\]/g, '').trim();
    }

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
            : html`
                <div class="content">${displayContent}</div>
                ${this.role === 'assistant' && this.citations && this.citations.length > 0 ? html`
                  <div class="citation-list">
                    ${this.citations.map((c, i) => html`
                      <div class="citation-item">
                        <div class="citation-index">${i + 1}</div>
                        <div style="flex: 1; overflow: hidden;">
                          <div style="font-weight: 700; color: #111827; margin-bottom: 2px;">${c.title}</div>
                          <a href="${c.url}" target="_blank" class="citation-link">${c.url}</a>
                        </div>
                      </div>
                    `)}
                  </div>
                ` : ''}
              `
          }
        </div>
      </div>
    `;
  }
}

customElements.define("chat-message", ChatMessage);
