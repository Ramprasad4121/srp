import { LitElement, html, css } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import React from "react";
import { createRoot, Root } from "react-dom/client";
import { Excalidraw } from "@excalidraw/excalidraw";

/**
 * A Lit wrapper for the Excalidraw React component.
 */
@customElement("excalidraw-wrapper")
export class ExcalidrawWrapper extends LitElement {
  @property({ type: Array }) elements: any[] = [];
  @property({ type: Object }) appState: any = {};

  @query("#container") private _container!: HTMLDivElement;
  private _root?: Root;

  static override styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    #container {
      width: 100%;
      height: 100%;
    }
  `;

  override firstUpdated() {
    this._root = createRoot(this._container);
    this._renderReact();
  }

  override updated(changedProps: Map<string, any>) {
    if (changedProps.has("elements") || changedProps.has("appState")) {
      this._renderReact();
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._root?.unmount();
  }

  private _renderReact() {
    if (!this._root) return;

    this._root.render(
      React.createElement(Excalidraw, {
        initialData: {
          elements: this.elements,
          appState: {
            ...this.appState,
            viewBackgroundColor: "#ffffff",
            currentItemFontFamily: 3, // Monospace
            theme: "light", // TODO: Sync with global SRP theme state
          }
        },
        onChange: (elements: readonly any[], state: any) => {
          this.dispatchEvent(new CustomEvent("excalidraw-change", {
            detail: { elements, state },
            bubbles: true,
            composed: true
          }));
        }
      })
    );
  }

  override render() {
    return html`
      <div id="container"></div>
    `;
  }
}
