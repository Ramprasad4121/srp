import { LitElement, html, css } from "lit";

export class ChatMessage extends LitElement {
  static override properties = {
    role: { type: String },
    content: { type: String }
  };

  static override styles = css`
    :host {
      display: block;
      margin: 0;
      border-bottom: 1px solid #f5f5f5;
      font-family: 'JetBrains Mono', 'Roboto Mono', monospace;
    }

    .message {
      display: flex;
      flex-direction: column;
      padding: 20px 24px;
    }

    .role-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      font-weight: 700;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .role-user {
      color: #0052FF;
    }

    .role-assistant {
      color: #000;
    }

    .role-system {
      color: #f59e0b;
    }
    
    .timestamp {
      color: #ccc;
      font-weight: normal;
    }

    .content {
      font-size: 13px;
      line-height: 1.7;
      color: #444;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .content.user {
      color: #000;
    }

    .role-assistant::before {
      content: "●";
      font-size: 8px;
    }

    .role-user::before {
      content: "○";
      font-size: 8px;
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
    let name = this.role === 'assistant' ? 'SRP_AGENT' : 'REMOTE_OPERATOR';
    if (this.role === 'system') name = 'PROTOCOL_SYSTEM';
    
    const timestamp = new Date().toLocaleTimeString([], { hour12: false });

    return html`
      <div class="message">
        <div class="role-label role-${this.role}">
          ${name} <span class="timestamp">[${timestamp}]</span>
        </div>
        <div class="content ${this.role}">
          ${this.content}
        </div>
      </div>
    `;
  }

}

customElements.define("chat-message", ChatMessage);
