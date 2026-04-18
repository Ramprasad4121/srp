import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import "./excalidraw-wrapper.js";

const STORAGE_KEY = "srp_whiteboard_data";

export class WhiteboardOverlay extends LitElement {
  static override properties = {
    open: { type: Boolean, reflect: true },
    _elements: { state: true },
    _appState: { state: true },
    _isMinimized: { state: true }
  };

  declare open: boolean;
  private _elements: any[] = [];
  private _appState: any = {};
  private _isMinimized = false;

  static override styles = css`
    :host {
      display: block !important;
      --whiteboard-width: min(960px, calc(100vw - 32px));
      --whiteboard-height: min(720px, calc(100vh - 120px));

      position: fixed;
      inset: 0;
      z-index: 11000 !important;
      pointer-events: none;
    }

    :host([open]) {
      pointer-events: auto;
    }

    .backdrop {
      position: absolute;
      inset: 0;
      background: rgba(17, 24, 39, 0.24);
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .container {
      position: absolute;
      right: 20px;
      bottom: 92px;
      width: var(--whiteboard-width);
      height: var(--whiteboard-height);
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1), 0 4px 10px rgba(0, 0, 0, 0.05);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      pointer-events: auto;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      transform-origin: bottom right;
    }

    .container.open {
      opacity: 1 !important;
      transform: scale(1) translateY(0) !important;
      pointer-events: auto !important;
      visibility: visible !important;
    }

    .container.closed {
      transform: scale(0.9) translateY(20px) !important;
      opacity: 0 !important;
      pointer-events: none !important;
      visibility: hidden !important;
    }

    :host([open]) .backdrop {
      opacity: 1;
    }

    .container.minimized {
      height: 48px;
      width: 200px;
    }

    .header {
      padding: 0 1rem;
      height: 48px;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: grab;
      user-select: none;
    }

    .title {
      font-size: 13px;
      font-weight: 700;
      color: #374151;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .controls {
      display: flex;
      gap: 0.5rem;
    }

    .control-btn {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: #9ca3af;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    }

    .control-btn:hover {
      background: #f3f4f6;
      color: #111827;
    }

    .canvas-area {
      flex: 1;
      position: relative;
    }

    excalidraw-wrapper {
      width: 100%;
      height: 100%;
      border: none;
      border-radius: 0;
    }

    .icon-pencil {
      width: 14px;
      height: 14px;
    }

    @media (max-width: 768px) {
      .container {
        right: 8px;
        bottom: 84px;
      }
    }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this._loadState();
  }

  private _loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        this._elements = data.elements || [];
        this._appState = data.appState || {};
      }
    } catch (e) {
      console.warn("Failed to load whiteboard history", e);
    }
  }

  private _saveState(elements: any[], appState: any) {
    try {
      const data = { elements, appState };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("Failed to save whiteboard history", e);
    }
  }

  private _handleExcalidrawChange(e: CustomEvent) {
    const { elements, state } = e.detail;
    this._elements = elements;
    this._appState = state;
    this._saveState(elements, state);
  }

  private _handleClose() {
    this.dispatchEvent(new CustomEvent("close-whiteboard", {
      bubbles: true,
      composed: true
    }));
  }

  private _toggleMinimize() {
    this._isMinimized = !this._isMinimized;
  }

  override updated(changedProps: Map<string, any>) {
    if (changedProps.has("open")) {
      console.log("WhiteboardOverlay: received open =", this.open);
      if (this.open) {
        this._loadState();
      }
    }
  }

  override render() {
    return html`
      <div class="backdrop" ?hidden=${!this.open} @click=${this._handleClose}></div>
      <div class="container ${this.open ? 'open' : 'closed'} ${this._isMinimized ? 'minimized' : ''}">
        <div class="header" @dblclick=${this._toggleMinimize}>
          <div class="title">
            <svg class="icon-pencil" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
            </svg>
            Audit Whiteboard
          </div>
          <div class="controls">
            <button class="control-btn" @click=${this._toggleMinimize} title=${this._isMinimized ? 'Restore' : 'Minimize'}>
              ${this._isMinimized 
                ? html`<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>`
                : html`<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 12H6"/></svg>`}
            </button>
            <button class="control-btn" @click=${this._handleClose} title="Close">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
        
        <div class="canvas-area" ?hidden=${this._isMinimized}>
          ${this.open ? html`
            <excalidraw-wrapper
              .elements=${this._elements}
              .appState=${this._appState}
              @excalidraw-change=${this._handleExcalidrawChange}
            >
              <div style="padding: 2rem; color: #666;">Initializing whiteboard engine...</div>
            </excalidraw-wrapper>
          ` : ''}
        </div>
      </div>
    `;
  }
}

customElements.define("whiteboard-overlay", WhiteboardOverlay);
