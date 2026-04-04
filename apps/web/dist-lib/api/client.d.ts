import type { AppBootstrapResult, RuntimeSessionState, SetupManifest, RuntimeMode } from "@srp/shared-types";
export declare class GatewayClient {
    private readonly baseUrl;
    constructor(baseUrl?: string);
    private request;
    getBootstrap(): Promise<AppBootstrapResult>;
    getSetup(): Promise<{
        manifest: SetupManifest;
    }>;
    getRuntime(): Promise<RuntimeSessionState>;
    startRuntime(mode: RuntimeMode): Promise<void>;
}
export declare const gatewayClient: GatewayClient;
//# sourceMappingURL=client.d.ts.map