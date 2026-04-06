import { LitElement, html, css } from "lit";

export class ChatMessage extends LitElement {
  static override styles = css`
    :host {
      display: block;
      margin-bottom: 2.5rem;
      animation: physicsEntry 0.45s cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    @keyframes physicsEntry {
      from { opacity: 0; transform: translateY(16px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .message-container {
      display: flex;
      gap: 1.25rem;
      max-width: 100%;
    }

    .avatar {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 14px;
      font-weight: 800;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      position: relative;
      overflow: hidden;
    }

    .avatar-user {
      background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
      color: #6b7280;
      border: 1px solid rgba(0,0,0,0.05);
    }

    .avatar-assistant {
      background: linear-gradient(135deg, #111827 0%, #374151 100%);
      color: #fff;
    }
    
    .avatar-assistant::after {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 20% 20%, rgba(255,255,255,0.15) 0%, transparent 50%);
    }

    .avatar-system {
      background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
      color: #d97706;
      border: 1px solid rgba(217, 119, 6, 0.1);
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
      opacity: 0.8;
    }

    .name {
      font-size: 13px;
      font-weight: 700;
      color: #111827;
      letter-spacing: -0.01em;
    }

    .time {
      font-size: 11px;
      color: #9ca3af;
      font-weight: 600;
      letter-spacing: 0.02em;
    }

    .content {
      font-size: 15px;
      line-height: 1.65;
      color: #1f2937;
      white-space: pre-wrap;
      word-break: break-word;
      font-feature-settings: "cv02", "cv03", "cv04", "ss01";
    }

    /* Professional Markdown Styling */
    .content code {
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 13px;
      background: #f1f5f9;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      color: #0f172a;
      font-weight: 500;
    }

    .content pre {
      background: #0f172a;
      border: 1px solid rgba(255,255,255,0.1);
      padding: 1.25rem;
      border-radius: 12px;
      overflow-x: auto;
      margin: 1.25rem 0;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    }

    .content pre code {
      background: transparent;
      padding: 0;
      color: #e2e8f0;
    }

    .tool-call {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      background: rgba(0, 82, 255, 0.04);
      border: 1px solid rgba(0, 82, 255, 0.1);
      color: #0052FF;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      margin: 0.75rem 0;
      font-family: 'JetBrains Mono', monospace;
      letter-spacing: -0.01em;
    }

    .citation-list {
      margin-top: 1.5rem;
      padding: 1rem;
      background: #f8fafc;
      border-radius: 12px;
      border: 1px solid #f1f5f9;
    }

    .citation-item {
      font-size: 12px;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0.5rem 0;
      transition: color 0.2s;
    }
    
    .citation-item:not(:last-child) {
      border-bottom: 1px solid rgba(0,0,0,0.03);
    }

    .citation-index {
      background: #fff;
      color: #0052FF;
      width: 18px;
      height: 18px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 800;
      flex-shrink: 0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,82,255,0.1);
    }

    .citation-link {
      color: #334155;
      text-decoration: none;
      font-weight: 700;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      transition: color 0.15s;
    }

    .citation-link:hover {
      color: #0052FF;
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
                    <div style="font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Intelligence Sources</div>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                      ${this.citations.map((c, i) => html`
                        <div class="citation-item" style="padding: 6px 10px; flex: 0 1 auto; min-width: 120px; max-width: 200px;">
                          <div class="citation-index">${i + 1}</div>
                          <div style="overflow: hidden; text-overflow: ellipsis;">
                            <a href="${c.url}" target="_blank" class="citation-link" style="font-size: 11px;">${new URL(c.url).hostname}</a>
                          </div>
                        </div>
                      `)}
                    </div>
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
