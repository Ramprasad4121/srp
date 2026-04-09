import { LitElement, html, css } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import React from "react";
import { createRoot, Root } from "react-dom/client";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

/**
 * A Lit wrapper for the Excalidraw React component.
 */
@customElement("excalidraw-wrapper")
export class ExcalidrawWrapper extends LitElement {
  @property({ type: Array }) elements: any[] = [];
  @property({ type: Object }) appState: any = {};

  @query("#container") private _container!: HTMLDivElement;
  private _root?: Root;
  private _excalidrawApi: any;
  private _lastSceneHash = "";

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
    if ((changedProps.has("elements") || changedProps.has("appState")) && this._excalidrawApi) {
      this._syncScene();
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
        excalidrawAPI: (api: any) => {
          this._excalidrawApi = api;
          this._syncScene();
        },
        onChange: (elements: readonly any[], state: any) => {
          this._lastSceneHash = this._createSceneHash(elements, state);
          this.dispatchEvent(new CustomEvent("excalidraw-change", {
            detail: { elements, state },
            bubbles: true,
            composed: true
          }));
        }
      })
    );
  }

  private _syncScene() {
    if (!this._excalidrawApi) {
      return;
    }

    const nextHash = this._createSceneHash(this.elements, this.appState);
    if (nextHash === this._lastSceneHash) {
      return;
    }

    this._lastSceneHash = nextHash;
    this._excalidrawApi.updateScene({
      elements: this.elements,
      appState: {
        ...this.appState,
        viewBackgroundColor: "#ffffff",
        theme: "light"
      }
    });
  }

  private _createSceneHash(elements: readonly any[], appState: any) {
    try {
      return JSON.stringify({
        elements,
        appState
      });
    } catch {
      return `${elements.length}:${Object.keys(appState ?? {}).length}`;
    }
  }

  override render() {
    return html`
      <div id="container"></div>
    `;
  }
}
