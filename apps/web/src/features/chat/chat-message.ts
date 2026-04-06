import { LitElement, html, css } from "lit";

export class ChatMessage extends LitElement {
  static override styles = css`
    :host {
      display: block;
      margin-bottom: 1.5rem;
      animation: messageSlideIn 0.3s cubic-bezier(0, 0.55, 0.45, 1);
    }

    @keyframes messageSlideIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .message-row {
      display: flex;
      gap: 0.75rem;
      max-width: 100%;
    }

    .message-row.user {
      flex-direction: row-reverse;
    }

    .avatar {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 11px;
      font-weight: 700;
      margin-top: 2px;
    }

    .avatar-user {
      background: #f3f4f6;
      color: #6b7280;
      border: 1px solid #e5e7eb;
    }

    .avatar-assistant {
      background: #0052FF;
      color: #fff;
    }

    .avatar-system {
      background: #fffbeb;
      color: #d97706;
      border: 1px solid #fef3c7;
    }

    .bubble-wrapper {
      display: flex;
      flex-direction: column;
      max-width: calc(100% - 40px);
      gap: 0.25rem;
    }

    .message-row.user .bubble-wrapper {
      align-items: flex-end;
    }

    .bubble {
      padding: 0.75rem 1rem;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.55;
      position: relative;
      word-break: break-word;
    }

    .bubble-assistant {
      background: #f9fafb;
      color: #111827;
      border: 1px solid #f3f4f6;
      border-top-left-radius: 2px;
    }

    .bubble-user {
      background: #0052FF;
      color: #fff;
      border-top-right-radius: 2px;
    }

    .bubble-system {
      background: #fffbeb;
      color: #92400e;
      border: 1px solid #fef3c7;
      font-size: 12px;
      font-family: monospace;
    }

    .meta {
      font-size: 10px;
      font-weight: 600;
      color: #9ca3af;
      margin: 0 0.25rem;
    }

    /* Content styling */
    .content {
      white-space: pre-wrap;
    }

    .content code {
      font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
      font-size: 0.85em;
      background: rgba(0, 0, 0, 0.05);
      padding: 0.1rem 0.3rem;
      border-radius: 4px;
    }

    .bubble-user .content code {
      background: rgba(255, 255, 255, 0.2);
    }

    .content pre {
      background: #1e293b;
      color: #f8fafc;
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      margin: 0.75rem 0;
      font-size: 13px;
      line-height: 1.45;
    }

    .content pre code {
      background: transparent;
      padding: 0;
      color: inherit;
      font-size: inherit;
    }

    .tool-tag {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: #eff6ff;
      color: #1d4ed8;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      font-family: monospace;
      margin: 0.5rem 0;
      border: 1px solid #dbeafe;
    }

    .citations-section {
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid #f3f4f6;
    }

    .citation-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .citation-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #fff;
      border: 1px solid #e5e7eb;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      color: #4b5563;
      text-decoration: none;
      transition: all 0.15s;
    }

    .citation-chip:hover {
      border-color: #0052FF;
      color: #0052FF;
      background: #f0f7ff;
    }

    .citation-num {
      width: 14px;
      height: 14px;
      background: #f3f4f6;
      border-radius: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      font-weight: 800;
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
    const isAssistant = this.role === 'assistant';
    const isUser = this.role === 'user';
    const isSystem = this.role === 'system';
    
    // Filter internal tool calls
    let displayContent = this.content;
    const isTool = this.content.startsWith('[TOOL:');
    
    if (isAssistant && !isTool) {
      displayContent = this.content.replace(/\[TOOL: [^\]]+\]/g, '').trim();
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return html`
      <div class="message-row ${this.role}">
        <div class="avatar avatar-${this.role}">
          ${isAssistant ? 'AI' : (isSystem ? 'SY' : 'ME')}
        </div>
        <div class="bubble-wrapper">
          <div class="meta">${isAssistant ? 'SRP AGENT' : (isSystem ? 'SYSTEM' : 'YOU')} • ${timestamp}</div>
          <div class="bubble bubble-${this.role}">
            ${isTool 
              ? html`<div class="tool-tag"><span>⚙️</span> ${this.content.replace('[TOOL: ', '').replace(']', '')}</div>`
              : html`
                  <div class="content">${displayContent}</div>
                  ${isAssistant && this.citations && this.citations.length > 0 ? html`
                    <div class="citations-section">
                      <div class="citation-chips">
                        ${this.citations.map((c, i) => html`
                          <a href="${c.url}" target="_blank" class="citation-chip">
                            <span class="citation-num">${i + 1}</span>
                            <span>${new URL(c.url).hostname}</span>
                          </a>
                        `)}
                      </div>
                    </div>
                  ` : ''}
                `
            }
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define("chat-message", ChatMessage);
