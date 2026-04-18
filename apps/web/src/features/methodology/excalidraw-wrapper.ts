import { LitElement, html, css } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import React from "react";
import { createRoot, Root } from "react-dom/client";
import { Excalidraw, MainMenu, WelcomeScreen } from "@excalidraw/excalidraw";
// @ts-ignore
import excalidrawCss from "@excalidraw/excalidraw/index.css?inline";

/**
 * A Lit wrapper for the Excalidraw React component.
 */
export class ExcalidrawWrapper extends LitElement {
  static override properties = {
    elements: { type: Array },
    appState: { type: Object }
  };

  declare elements: any[];
  declare appState: any;

  private _container!: HTMLDivElement;
  private _root?: Root;
  private _excalidrawApi: any;
  private _lastSceneHash = "";

  override createRenderRoot() {
    return this; // Render in light DOM so React events fire correctly for canvas
  }

  private _injectGlobalCSS() {
    // Inject Excalidraw CSS into document.head so toolbars/menus/portals render correctly
    if (!document.querySelector('#excalidraw-global-css')) {
      const style = document.createElement('style');
      style.id = 'excalidraw-global-css';
      style.textContent = excalidrawCss;
      document.head.appendChild(style);
    }
  }

  override firstUpdated() {
    this._injectGlobalCSS();
    this._container = this.querySelector("#container") as HTMLDivElement;
    if (this._container) {
      this._root = createRoot(this._container);
      this._renderReact();
    }
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

    // Defense: JSON serialization of AppState can turn collaborators Map into an Object
    // which causes Excalidraw to crash during initialization.
    const sanitizedState = { ...(this.appState || {}) };
    if (sanitizedState.collaborators && !(sanitizedState.collaborators instanceof Map)) {
      delete sanitizedState.collaborators;
    }
    // Strip transient state that breaks toolbar/menu visibility
    delete sanitizedState.selectedElementIds;
    delete sanitizedState.selectedGroupIds;
    delete sanitizedState.editingElement;
    delete sanitizedState.editingGroupId;
    delete sanitizedState.editingLinearElement;

    this._root.render(
      React.createElement(Excalidraw, {
        initialData: {
          elements: this.elements || [],
          appState: {
            ...sanitizedState,
            viewBackgroundColor: "#ffffff",
            currentItemFontFamily: 3, // Monospace
            theme: "light",
            // CRITICAL: Force these to false so toolbar and menu always render
            viewModeEnabled: false,
            zenModeEnabled: false,
            gridModeEnabled: false,
          }
        },
        // Explicitly ensure these props are set at the component level too
        viewModeEnabled: false,
        zenModeEnabled: false,
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

    const nextHash = this._createSceneHash(this.elements || [], this.appState || {});
    if (nextHash === this._lastSceneHash) {
      return;
    }

    this._lastSceneHash = nextHash;
    this._excalidrawApi.updateScene({
      elements: this.elements || [],
      appState: {
        ...(this.appState || {}),
        viewBackgroundColor: "#ffffff",
        theme: "light"
      }
    });
  }

  private _createSceneHash(elements: readonly any[], appState: any) {
    try {
      return JSON.stringify({
        elements: elements || [],
        appState: appState || {}
      });
    } catch {
      return `${(elements || []).length}:${Object.keys(appState ?? {}).length}`;
    }
  }

  override render() {
    return html`
      <style>
        excalidraw-wrapper {
          display: block;
          width: 100%;
          height: 100%;
        }
        .excalidraw-container-wrapper {
          width: 100%;
          height: 100%;
          display: block;
        }
        #container {
          width: 100%;
          height: 100%;
          min-height: 400px;
          display: block;
        }
      </style>
      <style>${excalidrawCss}</style>
      <div class="excalidraw-container-wrapper">
        <div id="container"></div>
      </div>
    `;
  }
}

customElements.define("excalidraw-wrapper", ExcalidrawWrapper);
