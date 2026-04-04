import { LitElement } from "lit";
import "./onboarding/setup-view.js";
export declare class SrpApp extends LitElement {
    static styles: import("lit").CSSResult;
    private _bootstrap;
    private _runtime;
    private _loading;
    private _path;
    private _error;
    constructor();
    firstUpdated(): Promise<void>;
    refresh(): Promise<void>;
    poll(): Promise<void>;
    render(): import("lit").TemplateResult<1>;
    private renderSetupRedirect;
    private navigate;
    private renderOverview;
    private renderActiveAudit;
    private startAudit;
}
//# sourceMappingURL=srp-app.d.ts.map