import { LitElement, html, css } from "lit";

export class ChatMessage extends LitElement {
  static override properties = {
    role: { type: String },
    content: { type: String }
  };

  static override styles = css`
    :host {
      display: block;
      margin-bottom: 1.5rem;
      font-family: 'Inter', system-ui, sans-serif;
    }

    .message {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .role-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 700;
    }

    .role-user {
      color: #000;
    }

    .role-assistant {
      color: #000;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .role-assistant::before {
      content: "";
      display: inline-block;
      width: 8px;
      height: 8px;
      background: #000;
      border-radius: 50%;
    }

    .content {
      font-size: 1rem;
      line-height: 1.6;
      color: #000;
      padding-left: 1rem;
      border-left: 2px solid #e1e3e8;
    }

    .content.user {
      border-left-color: #000;
      font-weight: 500;
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
    let name = this.role === 'assistant' ? 'AI Assistant' : 'You';
    if (this.role === 'system') name = 'System';
    
    return html`
      <div class="message">
        <div class="role-label role-${this.role}">
          ${name}
        </div>
        <div class="content ${this.role}">
          ${this.content}
        </div>
      </div>
    `;
  }
}

customElements.define("chat-message", ChatMessage);
